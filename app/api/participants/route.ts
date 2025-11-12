// app/api/participants/route.ts
import { NextResponse } from 'next/server'
import { supabase } from '@/lib/supabaseClient'

// GET /api/participants
export async function GET() {
  try {
    const { data, error } = await supabase
      .from('participants')
      .select('id, name, has_reading')

    if (error) {
      console.error('Supabase GET error:', error)
      return NextResponse.json(
        { error: error.message },
        { status: 500 }
      )
    }

    return NextResponse.json(data ?? [], { status: 200 })
  } catch (err) {
    const message =
      err instanceof Error ? err.message : 'Unknown server error'

    console.error('Unexpected GET error:', message)
    return NextResponse.json({ error: message }, { status: 500 })
  }
}

// POST /api/participants
export async function POST(request: Request) {
  try {
    const body = await request.json()

    const name = typeof body.name === 'string' ? body.name : ''
    const hasReading = Boolean(body.hasReading)

    if (!name.trim()) {
      return NextResponse.json(
        { error: 'Name is required' },
        { status: 400 }
      )
    }

    const { data, error } = await supabase
      .from('participants')
      .insert([{ name: name.trim(), has_reading: hasReading }])
      .select('id, name, has_reading')
      .single()

    if (error) {
      console.error('Supabase POST error:', error)
      return NextResponse.json(
        { error: error.message },
        { status: 500 }
      )
    }

    return NextResponse.json(data, { status: 201 })
  } catch (err) {
    const message =
      err instanceof Error ? err.message : 'Unknown server error'

    console.error('Unexpected POST error:', message)
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
