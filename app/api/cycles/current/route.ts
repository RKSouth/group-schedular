import { NextResponse } from 'next/server'
import { supabase } from '@/lib/supabaseClient'

function startOfWeekTuesday(d: Date) {
  const date = new Date(Date.UTC(
    d.getUTCFullYear(),
    d.getUTCMonth(),
    d.getUTCDate()
  ))

  const day = date.getUTCDay() // 0 Sun .. 6 Sat
  const diff = (day + 5) % 7   // Tuesday = 0

  date.setUTCDate(date.getUTCDate() - diff)
  return date.toISOString().slice(0, 10) // YYYY-MM-DD
}


export async function GET() {
  const week_start = startOfWeekTuesday(new Date())

  // fetch existing
  const { data: existing, error: findErr } = await supabase
    .from('cycles')
    .select('id, week_start, created_at')
    .eq('week_start', week_start)
    .maybeSingle()

  if (findErr) return NextResponse.json({ error: findErr.message }, { status: 500 })
  if (existing) return NextResponse.json(existing, { status: 200 })

  // create new
  const { data: created, error: createErr } = await supabase
    .from('cycles')
    .insert([{ week_start }])
    .select('id, week_start, created_at')
    .single()

  if (createErr) return NextResponse.json({ error: createErr.message }, { status: 500 })
  return NextResponse.json(created, { status: 201 })
}
