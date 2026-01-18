'use client'

import { useEffect, useMemo, useState } from 'react'
import { makeGroups } from '../lib/grouping'

// Keep your existing types
type AttendanceStatus = 'unknown' | 'yes' | 'no' | 'maybe'
type ReadingStatus = 'unassigned' | 'pending' | 'confirmed' | 'deferred'

type CycleParticipant = {
  cycle_id: string
  attendance: AttendanceStatus
  reading: ReadingStatus
  responded_at: string | null

  id: number
  name: string
  email: string | null
  phone_number: string | null
  has_reading: boolean
}

// ✅ This is the ONLY new type you needed: it stops `r` from being `unknown`
type RosterApiRow = {
  cycle_id?: string
  id: number
  name: string | null
  email?: string | null
  phone_number?: string | null
  has_reading?: boolean
  attendance?: unknown
  reading?: unknown
  responded_at?: string | null
}

// Keep these exact parsers (no opinion changes)
function asAttendanceStatus(v: unknown): AttendanceStatus {
  if (v === 'unknown' || v === 'yes' || v === 'no' || v === 'maybe') return v
  return 'unknown'
}

function asReadingStatus(v: unknown): ReadingStatus {
  if (v === 'unassigned' || v === 'pending' || v === 'confirmed' || v === 'deferred') return v
  return 'unassigned'
}

export default function Page() {
  const [cycleId, setCycleId] = useState<string | null>(null)
  const [roster, setRoster] = useState<CycleParticipant[]>([])
  const [selectedId, setSelectedId] = useState<number | null>(null)

  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState<string | null>(null)

  const selected = useMemo(() => roster.find(p => p.id === selectedId) ?? null, [roster, selectedId])

  // ✅ keep your existing grouping logic call
  const groups = useMemo(() => makeGroups(roster), [roster])

  // ✅ fix optional chaining (this was a real JS bug)
  const isUpNext =
    !!selected &&
    (groups.upNext?.table?.id === selected.id || groups.upNext?.lounge?.id === selected.id)

  async function loadRoster() {
    try {
      setLoading(true)
      setError(null)
      setSuccess(null)

      const cycleRes = await fetch('/api/cycles/current')
      if (!cycleRes.ok) throw new Error('Failed to load cycle')

      const cycle = (await cycleRes.json()) as { id: string }
      setCycleId(cycle.id)

      const syncRes = await fetch(`/api/cycles/${cycle.id}/sync`, { method: 'POST' })
      if (!syncRes.ok) throw new Error('Failed to sync roster')

      const rosterRes = await fetch(`/api/cycles/${cycle.id}/participants`)
      if (!rosterRes.ok) throw new Error('Failed to load roster')

      // ✅ This is the key fix: not unknown[]
      const raw = (await rosterRes.json()) as RosterApiRow[]

      const normalized: CycleParticipant[] = (raw ?? []).map(r => ({
        cycle_id: String(r.cycle_id ?? cycle.id),

        id: Number(r.id),
        name: String(r.name ?? ''),
        email: r.email ?? null,
        phone_number: r.phone_number ?? null,
        has_reading: !!r.has_reading,

        attendance: asAttendanceStatus(r.attendance),
        reading: asReadingStatus(r.reading),
        responded_at: r.responded_at ?? null,
      }))

      setRoster(normalized)

      if (selectedId !== null && !normalized.some(p => p.id === selectedId)) {
        setSelectedId(null)
      }
    } catch (e) {
      const msg = e instanceof Error ? e.message : 'Unknown error'
      setError(msg)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    loadRoster()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // ⬇️ IMPORTANT:
  // Everything below is intentionally "boring": keep your existing layout/styles.
  // If you already had a different layout, paste your old JSX back in here and keep ONLY:
  // - the state/hooks above
  // - the loadRoster() normalization fix
  // - the isUpNext optional chaining fix
  return (
    <main className="min-h-screen bg-[url('/canadianFlags.jpg')] bg-cover bg-no-repeat bg-center">
      {/* top right admin button */}
      <a href="/admin/login" className="fixed top-4 right-4 rounded border bg-white/80 px-3 py-1">
        Admin
      </a>

      <h1 className="pt-10 text-gray-900 text-[4rem] bold flex items-center justify-center mb-4 mx-4">
        Do Write Scheduler
      </h1>

      <div className="flex flex-col sm:flex-row gap-4 items-stretch p-4 rounded-md">
        {/* LEFT: picker */}
        <div className="flex-1 flex flex-col p-4 bg-gray-400 text-gray-50 rounded-md">
          <h2 className="font-bold text-black text-xl mb-2">Check In</h2>

          {cycleId && <div className="text-xs text-black/70 mb-2">This week: {cycleId}</div>}

          <div className="mb-3">
            <label className="block text-black font-medium mb-1">Select your name</label>

            <select
              className="w-full rounded-md bg-white text-black px-2 py-2"
              value={selectedId ?? ''}
              onChange={e => setSelectedId(e.target.value ? Number(e.target.value) : null)}
              disabled={loading}
            >
              <option value="">— Choose —</option>
              {roster.map(p => (
                <option key={p.id} value={p.id}>
                  {p.name}
                </option>
              ))}
            </select>
          </div>

          <button
            className="self-start rounded-md bg-white px-3 py-2 text-black"
            onClick={loadRoster}
            disabled={loading}
          >
            {loading ? 'Loading…' : 'Refresh'}
          </button>

          {error && <p className="mt-3 text-red-700 bg-white/80 rounded p-2">{error}</p>}
          {success && <p className="mt-3 text-green-700 bg-white/80 rounded p-2">{success}</p>}
        </div>

        {/* RIGHT: what to do */}
        <div className="flex-1 flex flex-col p-4 bg-gray-400 text-gray-50 rounded-md">
          <h2 className="font-bold text-black text-xl mb-2">This Week</h2>

          <div className="bg-white/80 rounded-md p-3 text-black">
            <div className="text-sm text-black/70 mb-2">
              Attending this week: {roster.filter(p => (p.attendance ?? 'unknown') !== 'no').length} /{' '}
              {roster.length}
            </div>

            <div className="font-semibold mb-2">Up Next</div>

            <div className="text-sm">
              <div>
                <span className="font-medium">Table:</span>{' '}
                {groups.upNext?.table?.name ?? 'No one up next.'}
              </div>
              <div>
                <span className="font-medium">Lounge:</span>{' '}
                {groups.upNext?.lounge?.name ?? 'No one up next.'}
              </div>
            </div>
          </div>

          {/* Only ask pages if they are up next */}
          <div className="mt-4 bg-white/80 rounded-md p-3 text-black">
            <div className="font-semibold mb-2">Your turn</div>

            {!selected ? (
              <div className="text-sm text-black/70">Pick your name first.</div>
            ) : !isUpNext ? (
              <div className="text-sm text-black/70">
                You’re not up in the rotation right now. No action needed.
              </div>
            ) : (
              <div className="text-sm">
                <div className="mb-2">
                  Hi <span className="font-semibold">{selected.name}</span> — are you able to read
                  this week?
                </div>

                <div className="flex flex-wrap gap-2">
                  <button
                    className="rounded-md bg-white px-3 py-2 text-black border"
                        onClick={loadRoster}
                        disabled={loading}
                  >
                    Yes, I have pages
                  </button>

                  <button
                    className="rounded-md bg-white px-3 py-2 text-black border"
                        onClick={loadRoster}
                        disabled={loading}
                  >
                    No pages this week
                  </button>
                </div>

                <div className="mt-2 text-xs text-black/60">
                  (This only appears when you’re up next.)
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </main>
  )
}
