// app/api/cycles/[cycleId]/participants/route.ts
import { NextResponse } from 'next/server'
import { supabase } from '@/lib/supabaseClient'

type Params = { cycleId: string }

type AttendanceStatus = 'unknown' | 'yes' | 'no' | 'maybe'
type ReadingStatus = 'unassigned' | 'pending' | 'confirmed' | 'deferred'

type ParticipantRow = {
  id: number
  name: string
  email: string | null
  phone_number: string | null
  has_reading: boolean
  created_at: string
}

type CycleParticipantRow = {
  cycle_id: string
  attendance: AttendanceStatus
  reading: ReadingStatus
  responded_at: string | null
  reading_description: string | null
  participants: ParticipantRow | null
}

type CycleParticipantFlat = {
  cycle_id: string
  attendance: AttendanceStatus
  reading: ReadingStatus
  responded_at: string | null
  reading_description: string | null
} & Partial<ParticipantRow>

export async function GET(_req: Request, ctx: { params: Promise<Params> }) {
  try {
    const { cycleId } = await ctx.params

    const { data, error } = await supabase
      .from('cycle_participants')
      .select(
        `
        cycle_id,
        attendance,
        reading,
        responded_at,
        reading_description,
        participants:participant_id (
          id, name, email, phone_number, has_reading, created_at
        )
      `
      )
      .eq('cycle_id', cycleId)
      .returns<CycleParticipantRow[]>()

    if (error) {
      console.error('GET /api/cycles/[cycleId]/participants error:', error)
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    // Flatten shape for client (participants fields at top-level)
    const flattened: CycleParticipantFlat[] = (data ?? []).map(row => ({
      cycle_id: row.cycle_id,
      attendance: row.attendance,
      reading: row.reading,
      responded_at: row.responded_at,
      reading_description: row.reading_description,
      ...(row.participants ?? {}),
    }))

    // Stable order by name then id
    flattened.sort((a, b) => {
      const an = (a.name ?? '').toLowerCase()
      const bn = (b.name ?? '').toLowerCase()
      if (an < bn) return -1
      if (an > bn) return 1
      return (a.id ?? 0) - (b.id ?? 0)
    })

    return NextResponse.json(flattened, { status: 200 })
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unknown server error'
    console.error('GET /api/cycles/[cycleId]/participants unexpected error:', message)
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
