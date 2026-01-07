import { NextResponse } from 'next/server'
import { supabase } from '@/lib/supabaseClient'

type Params = { cycleId: string; participantId: string }

type Attendance = 'unknown' | 'yes' | 'no' | 'maybe'
type Reading = 'unassigned' | 'pending' | 'confirmed' | 'deferred'

type PatchBody = {
  attendance?: Attendance
  reading?: Reading
}

type Updates = Partial<{
  attendance: Attendance
  reading: Reading
  responded_at: string
}>

const VALID_ATTENDANCE: Attendance[] = ['unknown', 'yes', 'no', 'maybe']
const VALID_READING: Reading[] = ['unassigned', 'pending', 'confirmed', 'deferred']

function isAttendance(v: unknown): v is Attendance {
  return typeof v === 'string' && (VALID_ATTENDANCE as string[]).includes(v)
}

function isReading(v: unknown): v is Reading {
  return typeof v === 'string' && (VALID_READING as string[]).includes(v)
}

export async function PATCH(req: Request, ctx: { params: Promise<Params> }) {
  try {
    const { cycleId, participantId } = await ctx.params
    const pid = Number(participantId)

    if (!Number.isFinite(pid)) {
      return NextResponse.json({ error: 'Invalid participantId' }, { status: 400 })
    }

    const raw = (await req.json()) as Partial<PatchBody>
    const updates: Updates = {}

    if (raw.attendance !== undefined) {
      if (!isAttendance(raw.attendance)) {
        return NextResponse.json(
          { error: `Invalid attendance. Must be one of: ${VALID_ATTENDANCE.join(', ')}` },
          { status: 400 }
        )
      }
      updates.attendance = raw.attendance
    }

    if (raw.reading !== undefined) {
      if (!isReading(raw.reading)) {
        return NextResponse.json(
          { error: `Invalid reading. Must be one of: ${VALID_READING.join(', ')}` },
          { status: 400 }
        )
      }
      updates.reading = raw.reading
    }

    if (Object.keys(updates).length === 0) {
      return NextResponse.json({ error: 'No fields to update' }, { status: 400 })
    }

    // mark that they responded (RSVP/confirm/defer/etc.)
    updates.responded_at = new Date().toISOString()

    const { data, error } = await supabase
      .from('cycle_participants')
      .update(updates)
      .eq('cycle_id', cycleId)
      .eq('participant_id', pid)
      .select('cycle_id, participant_id, attendance, reading, responded_at')
      .single()

    if (error) {
      console.error('PATCH /api/cycles/[cycleId]/participants/[participantId] error:', error)
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    return NextResponse.json(data, { status: 200 })
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unknown server error'
    console.error('PATCH unexpected error:', message)
    return NextResponse.json({ error: message }, { status: 500 })
  }
}

export async function DELETE(_req: Request, ctx: { params: Promise<Params> }) {
  try {
    const { cycleId, participantId } = await ctx.params
    const pid = Number(participantId)

    if (!Number.isFinite(pid)) {
      return NextResponse.json({ error: 'Invalid participantId' }, { status: 400 })
    }

    const { error } = await supabase
      .from('cycle_participants')
      .delete()
      .eq('cycle_id', cycleId)
      .eq('participant_id', pid)

    if (error) {
      console.error('DELETE /api/cycles/[cycleId]/participants/[participantId] error:', error)
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    return NextResponse.json({ success: true }, { status: 200 })
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unknown server error'
    console.error('DELETE unexpected error:', message)
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
