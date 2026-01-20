// app/api/participants/[id]/route.ts
import { NextResponse } from 'next/server'
import { supabase } from '../../../../lib/supabaseClient'

type Params = { id: string }

type PatchBody = {
  name?: string
  email?: string | null
  phoneNumber?: string | null
  hasReading?: boolean
}

export async function PATCH(
  request: Request,
  context: { params: Promise<Params> }
) {
  const { id: idStr } = await context.params
  const id = Number(idStr)

  if (!Number.isFinite(id)) {
    return NextResponse.json({ error: 'Invalid id' }, { status: 400 })
  }

  const body = (await request.json()) as PatchBody

  // Build the update object using your DB column names

  
  const updates: {
    name?: string
    email?: string | null
    phone_number?: string | null
    has_reading?: boolean
  } = {}

  if (typeof body.name === 'string') {
    const trimmed = body.name.trim()
    if (trimmed.length > 0) updates.name = trimmed
  }

  if (typeof body.email === 'string') {
    updates.email = body.email.trim() || null
  } else if (body.email === null) {
    updates.email = null
  }

  if (typeof body.phoneNumber === 'string') {
    // Store raw or trimmed; you can normalize later
    updates.phone_number = body.phoneNumber.trim() || null
  } else if (body.phoneNumber === null) {
    updates.phone_number = null
  }

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
    .select('id, name, email, phone_number, has_reading, created_at')
    .single()

  if (error) {
    console.error('PATCH /api/participants/[id] error:', error)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  return NextResponse.json(data, { status: 200 })
}

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
