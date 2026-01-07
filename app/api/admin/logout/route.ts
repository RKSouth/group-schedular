import { NextResponse } from 'next/server'
import { clearAdminAuthed } from '@/lib/adminAuth'

export async function POST() {
  clearAdminAuthed()
  return NextResponse.json({ ok: true }, { status: 200 })
}
