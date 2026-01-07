import { NextResponse } from 'next/server'
import { setAdminAuthed } from '@/lib/adminAuth'

export async function POST(request: Request) {
  const { username, password } = await request.json()

  if (username !== 'admin') {
    return NextResponse.json({ error: 'Invalid login' }, { status: 401 })
  }

  const correct = process.env.ADMIN_PASSWORD
  if (!correct) {
    return NextResponse.json(
      { error: 'ADMIN_PASSWORD env var not set' },
      { status: 500 }
    )
  }

  if (password !== correct) {
    return NextResponse.json({ error: 'Invalid login' }, { status: 401 })
  }
  console.log('Login success, setting cookie')

   await setAdminAuthed()
  return NextResponse.json({ ok: true }, { status: 200 })
  
}
