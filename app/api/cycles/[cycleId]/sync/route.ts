import { NextResponse } from 'next/server'
import { supabase } from '@/lib/supabaseClient'

type Params = { cycleId: string }

export async function POST(_req: Request, ctx: { params: Promise<Params> }) {
  try {
    const { cycleId } = await ctx.params

    if (!cycleId || typeof cycleId !== 'string') {
      return NextResponse.json({ error: 'Invalid cycleId' }, { status: 400 })
    }

    // Get all participants
    const { data: participants, error: pErr } = await supabase
      .from('participants')
      .select('id')

    if (pErr) {
      console.error('Sync cycle participants: load participants error:', pErr)
      return NextResponse.json({ error: pErr.message }, { status: 500 })
    }

    // IMPORTANT:
    // Only include the PK columns so existing rows are NOT overwritten.
    // DB defaults will apply for newly inserted rows.
    const rows = (participants ?? []).map(p => ({
      cycle_id: cycleId,
      participant_id: p.id,
    }))

    if (rows.length === 0) {
      return NextResponse.json({ inserted: 0 }, { status: 200 })
    }

    const { error: upErr } = await supabase
      .from('cycle_participants')
      .upsert(rows, {
        onConflict: 'cycle_id,participant_id',
      })

    if (upErr) {
      console.error('Sync cycle participants: upsert error:', upErr)
      return NextResponse.json({ error: upErr.message }, { status: 500 })
    }

    // NOTE: "inserted" here means "attempted to ensure existence"
    // (some may already exist).
    return NextResponse.json({ ensured: rows.length }, { status: 200 })
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unknown server error'
    console.error('Sync cycle participants unexpected error:', message)
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
