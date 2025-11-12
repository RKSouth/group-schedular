// app/api/participants/[id]/route.ts
import { NextResponse } from 'next/server'
import { supabase } from '../../../../lib/supabaseClient' // adjust if your path is different


type Params = { id: string }

// PATCH /api/participants/:id -> update has_reading, etc.
export async function PATCH(
  request: Request,
  context: { params: Promise<Params> }
) {
  const { id: idStr } = await context.params
  const id = Number(idStr)

  if (!Number.isFinite(id)) {
    return NextResponse.json({ error: 'Invalid id' }, { status: 400 })
  }

  const body = await request.json()

  const updates: { has_reading?: boolean } = {}

  if (typeof body.hasReading === 'boolean') {
    updates.has_reading = body.hasReading
  }

  if (Object.keys(updates).length === 0) {
    return NextResponse.json(
      { error: 'No valid fields to update' },
      { status: 400 }
    )
  }

  const { data, error } = await supabase
    .from('participants')
    .update(updates)
    .eq('id', id)
    .select('id, name, has_reading')
    .single()

  if (error) {
    console.error('PATCH /api/participants/[id] error:', error)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  return NextResponse.json(data, { status: 200 })
}

// DELETE /api/participants/:id -> delete a participant
export async function DELETE(
  _request: Request,
  context: { params: Promise<Params> }
) {
  const { id: idStr } = await context.params
  const id = Number(idStr)

  if (!Number.isFinite(id)) {
    return NextResponse.json({ error: 'Invalid id' }, { status: 400 })
  }

  const { error } = await supabase
    .from('participants')
    .delete()
    .eq('id', id)

  if (error) {
    console.error('DELETE /api/participants/[id] error:', error)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  return NextResponse.json({ success: true }, { status: 200 })
}