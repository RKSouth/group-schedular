// app/api/participants/route.ts
import { NextResponse } from 'next/server'
import { supabase } from '@/lib/supabaseClient'

// GET /api/participants
export async function GET() {
  try {
    const { data, error } = await supabase
      .from('participants')
      .select('id, name, email, phone_number, has_reading, created_at')
      .order('id', { ascending: true })

    if (error) {
      console.error('Supabase GET error:', error)
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    return NextResponse.json(data ?? [], { status: 200 })
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unknown server error'
    console.error('Unexpected GET error:', message)
    return NextResponse.json({ error: message }, { status: 500 })
  }
}

// POST /api/participants
export async function POST(request: Request) {
  try {
    const body: {
      name?: unknown
      email?: unknown
      phoneNumber?: unknown
      hasReading?: unknown
    } = await request.json()

    const name = typeof body.name === 'string' ? body.name.trim() : ''
    const email =
      typeof body.email === 'string' ? body.email.trim() : ''
    const phoneNumber =
      typeof body.phoneNumber === 'string' ? body.phoneNumber.trim() : ''
    const hasReading = typeof body.hasReading === 'boolean' ? body.hasReading : false

    if (!name) {
      return NextResponse.json({ error: 'Name is required' }, { status: 400 })
    }

    const { data, error } = await supabase
      .from('participants')
      .insert([
        {
          name,
          email: email || null,
          phone_number: phoneNumber || null,
          has_reading: hasReading,
        },
      ])
      .select('id, name, email, phone_number, has_reading, created_at')
      .single()

    if (error) {
      console.error('Supabase POST error:', error)
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    return NextResponse.json(data, { status: 201 })
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unknown server error'
    console.error('Unexpected POST error:', message)
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
