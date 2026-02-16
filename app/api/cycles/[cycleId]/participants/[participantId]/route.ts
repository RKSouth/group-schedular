// app/api/cycles/[cycleId]/participants/[participantId]/route.ts
import { NextResponse } from 'next/server'
import { supabase } from '@/lib/supabaseClient'

type Params = { cycleId: string; participantId: string }

type Attendance = 'unknown' | 'yes' | 'no' | 'maybe'
type Reading = 'unassigned' | 'pending' | 'confirmed' | 'deferred'

type PatchBody = {
  attendance?: Attendance
  reading?: Reading

  // NEW: weekly reading note (<= 300 chars)
  reading_description?: string | null
}

type Updates = Partial<{
  attendance: Attendance
  reading: Reading
  responded_at: string

  // NEW
  reading_description: string | null
}>

const VALID_ATTENDANCE: Attendance[] = ['unknown', 'yes', 'no', 'maybe']
const VALID_READING: Reading[] = ['unassigned', 'pending', 'confirmed', 'deferred']

const READING_DESC_MAX = 300

function isAttendance(v: unknown): v is Attendance {
  return typeof v === 'string' && (VALID_ATTENDANCE as string[]).includes(v)
}

function isReading(v: unknown): v is Reading {
  return typeof v === 'string' && (VALID_READING as string[]).includes(v)
}

function normalizeReadingDescription(v: unknown): string | null | undefined {
  // undefined => "not provided" (don't update)
  // null => explicit clear
  // string => trimmed + clamped (empty => null)
  if (v === undefined) return undefined
  if (v === null) return null
  if (typeof v !== 'string') return undefined

  const trimmed = v.trim().slice(0, READING_DESC_MAX)
  return trimmed.length > 0 ? trimmed : null
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

    // NEW: reading_description (weekly)
    const normalizedDesc = normalizeReadingDescription(raw.reading_description)
    if (normalizedDesc !== undefined) {
      updates.reading_description = normalizedDesc
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
      .select('cycle_id, participant_id, attendance, reading, reading_description, responded_at')
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
