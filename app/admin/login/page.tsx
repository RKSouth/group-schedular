'use client'

import { useState } from 'react'

export default function AdminLoginPage() {
  const [username, setUsername] = useState('admin')
  const [password, setPassword] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError(null)
    setLoading(true)

    try {
      const res = await fetch('/api/admin/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username, password }),
      })

      if (!res.ok) {
        const data = await res.json().catch(() => null)
        setError(data?.error ?? 'Login failed')
        setLoading(false)
        return
      }

      // IMPORTANT: force full reload so cookie is definitely present
      window.location.href = '/admin'
    } catch (err) {
      console.error(err)
      setError('Something went wrong')
      setLoading(false)
    }
  }

  return (
    <main className="min-h-screen flex items-center justify-center p-6">
      <form onSubmit={onSubmit} className="w-full max-w-sm rounded-md border bg-white p-6 shadow">
        <h1 className="text-xl text-black font-semibold mb-4">Admin Login</h1>

        <label className="block text-sm mb-3">
          Username
          <input
            className="mt-1 w-full rounded border p-2"
            value={username}
            onChange={(e) => setUsername(e.target.value)}
            autoComplete="username"
          />
        </label>

        <label className="block text-sm mb-4">
          Password
          <input
            className="mt-1 w-full rounded border p-2"
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            autoComplete="current-password"
          />
        </label>

        <button
          type="submit"
          disabled={loading}
          className="w-full rounded bg-blue-600 text-white py-2 disabled:opacity-50"
        >
          {loading ? 'Signing in…' : 'Sign in'}
        </button>

        {error && <div className="mt-3 text-sm text-red-600">{error}</div>}
      </form>
    </main>
  )
}
