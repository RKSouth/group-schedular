import { cookies } from 'next/headers'

const COOKIE_NAME = 'gs_admin'

export async function isAdminAuthed() {
  const cookieStore = await cookies()
  return cookieStore.get(COOKIE_NAME)?.value === '1'
}

export async function setAdminAuthed() {
  const cookieStore = await cookies()
  cookieStore.set(COOKIE_NAME, '1', {
    httpOnly: true,
    sameSite: 'lax',
    secure: process.env.NODE_ENV === 'production',
    path: '/',
    maxAge: 60 * 60 * 24 * 30, // 30 days
  })
}

export async function clearAdminAuthed() {
  const cookieStore = await cookies()
  cookieStore.set(COOKIE_NAME, '', {
    httpOnly: true,
    sameSite: 'lax',
    secure: process.env.NODE_ENV === 'production',
    path: '/',
    maxAge: 0,
  })
}
