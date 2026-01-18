'use client'

import { useEffect, useMemo, useState } from 'react'
import { makeGroups } from '../../lib/grouping'

type Participant = {
  id: number
  name: string
  email: string | null
  phone_number: string | null
  has_reading: boolean
  created_at?: string
}

type AttendanceStatus = 'unknown' | 'yes' | 'no' | 'maybe'
type ReadingStatus = 'unassigned' | 'pending' | 'confirmed' | 'deferred'

type CycleParticipant = {
  cycle_id: string
  attendance: AttendanceStatus
  reading: ReadingStatus
  responded_at: string | null

  // participant fields flattened by your API
  id: number
  name: string
  email: string | null
  phone_number: string | null
  has_reading: boolean
  created_at?: string
}

function isAttending(p: CycleParticipant) {
  return (p.attendance ?? 'unknown') !== 'no'
}

export default function Page() {
  // LEFT COLUMN: master participants list (CRUD)
  const [participants, setParticipants] = useState<Participant[]>([])
  const [name, setName] = useState('')
  const [email, setEmail] = useState('')
  const [phoneNumber, setPhoneNumber] = useState('')
  const [hasReading, setHasReading] = useState(false)
  const [isLoading, setIsLoading] = useState(false)

  // RIGHT COLUMN: weekly roster + schedule
  const [cycleId, setCycleId] = useState<string | null>(null)
  const [cycleParticipants, setCycleParticipants] = useState<CycleParticipant[]>([])
  const [cycleError, setCycleError] = useState<string | null>(null)

  // Groups from weekly roster
  const groups = useMemo(() => makeGroups(cycleParticipants), [cycleParticipants])

  const attendingCount = useMemo(
    () => cycleParticipants.filter(isAttending).length,
    [cycleParticipants]
  )

  // ---------
  // CRUD: master participants

  async function loadParticipants() {
    try {
      const res = await fetch('/api/participants')
      if (!res.ok) {
        console.error('Failed to load participants')
        return
      }
      const data: Participant[] = await res.json()
      setParticipants(data)
    } catch (err) {
      console.error('Error loading participants', err)
    }
  }

  async function handleAdd() {
    if (!name.trim()) return
    if (!email.trim()) return
    if (!phoneNumber.trim()) return

    setIsLoading(true)
    try {
      const res = await fetch('/api/participants', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: name.trim(),
          email: email.trim(),
          phoneNumber: phoneNumber.trim(),
          hasReading,
        }),
      })

      if (!res.ok) {
        console.error('Failed to add participant')
        return
      }

      setName('')
      setEmail('')
      setPhoneNumber('')
      setHasReading(false)

      await loadParticipants()
      await loadCycleRoster()
    } catch (err) {
      console.error('Error adding participant', err)
    } finally {
      setIsLoading(false)
    }
  }

  async function deleteParticipant(id: number) {
    const res = await fetch(`/api/participants/${id}`, { method: 'DELETE' })
    if (!res.ok) {
      const text = await res.text()
      console.error('Failed to delete participant:', text)
      return
    }
    await loadParticipants()
    await loadCycleRoster()
  }

  async function updateHasReading(id: number, value: boolean) {
    const res = await fetch(`/api/participants/${id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ hasReading: value }),
    })
    if (!res.ok) {
      console.error('Failed to update participant')
      return
    }
    await loadParticipants()
    await loadCycleRoster()
  }

  // ---------
  // Weekly cycle roster

  async function loadCycleRoster() {
    try {
      setCycleError(null)

      // 1) get/create current cycle
      const cycleRes = await fetch('/api/cycles/current')
      if (!cycleRes.ok) {
        setCycleError('Failed to load current cycle')
        return
      }
      const cycle = (await cycleRes.json()) as { id: string }
      setCycleId(cycle.id)

      // 2) ensure roster rows exist (join table)
      const syncRes = await fetch(`/api/cycles/${cycle.id}/sync`, { method: 'POST' })
      if (!syncRes.ok) {
        console.error('Failed to sync cycle roster')
      }

      // 3) load roster (cycle participants flattened)
      const rosterRes = await fetch(`/api/cycles/${cycle.id}/participants`)
      if (!rosterRes.ok) {
        setCycleError('Failed to load cycle roster')
        return
      }
      const roster = (await rosterRes.json()) as CycleParticipant[]
      setCycleParticipants(roster)
    } catch (err) {
      console.error('Error loading cycle roster:', err)
      setCycleError('Unexpected error loading cycle roster')
    }
  }

  async function patchCycleParticipant(
    participantId: number,
    patch: Partial<Pick<CycleParticipant, 'attendance' | 'reading'>>
  ) {
    if (!cycleId) return

    const res = await fetch(`/api/cycles/${cycleId}/participants/${participantId}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(patch),
    })

    if (!res.ok) {
      const text = await res.text()
      console.error('Failed to update cycle participant:', text)
      return
    }

    await loadCycleRoster()
  }

  useEffect(() => {
    loadParticipants()
    loadCycleRoster()
  }, [])

  return (
    <main className="min-h-screen bg-[url('/canadianFlags.jpg')] bg-cover bg-no-repeat bg-center">
      <a
        href="/admin/logout"
        className="fixed top-4 right-4 rounded border bg-white/80 px-3 py-1"
      >
        Logout
      </a>

      <h1 className="absolute-bottom pt-10 text-gray-900 text-[3rem] bold flex items-center justify-center mb-4 mr-20text-xl mx-4">
        Administrator Page
      </h1>

      <div className="flex flex-col sm:flex-row gap-4 items-stretch p-4 rounded-md -4">
        {/* LEFT: Folks (CRUD) */}
        <div className="flex-1 flex flex-col p-4 bg-gray-400 text-gray-50 rounded-md">
          <h2 className="font-bold text-black text-xl mb-2">Folks</h2>
          <h4>Instructions: Here is where you can add, update or delete participants.</h4>

          <div style={{ marginBottom: 12 }}>
            <div className="mb-2">
              <div className="mb-2">
                <label htmlFor="name" className="font-medium text-black">
                  Name:
                </label>
                <input
                  type="text"
                  value={name}
                  placeholder="Enter your name"
                  onChange={e => setName(e.target.value)}
                  className="ml-2 px-2 bg-white text-black rounded-md"
                />
              </div>

              <div className="mb-2">
                <label htmlFor="email" className="font-medium text-black">
                  Email:
                </label>
                <input
                  type="text"
                  value={email}
                  placeholder="Enter your email"
                  onChange={e => setEmail(e.target.value)}
                  className="ml-2 px-2 bg-white text-black rounded-md"
                />
              </div>

              <div className="mb-2">
                <label htmlFor="phoneNumber" className="font-medium text-black">
                  Cell:
                </label>
                <input
                  type="text"
                  value={phoneNumber}
                  placeholder="1234567890"
                  onChange={e => setPhoneNumber(e.target.value)}
                  className="ml-2 px-2 bg-white text-black rounded-md"
                />
              </div>
            </div>

            <label style={{ display: 'block', marginBottom: 8 }}>
              <input
                type="checkbox"
                checked={hasReading}
                onChange={e => setHasReading(e.target.checked)}
                className="ml-2 px-2 bg-white text-black rounded-md"
              />{' '}
              Pages
            </label>

            <button
              className="ml-2 px-2 bg-white text-black rounded-md"
              onClick={handleAdd}
              disabled={isLoading || !name.trim()}
            >
              {isLoading ? 'Adding…' : 'Add'}
            </button>
          </div>

          <hr className="my-1" />

          <h3 className="font-semibold text-lg mb-2">
            All participants ({participants.length})
          </h3>

          {participants.length === 0 ? (
            <p>No one yet.</p>
          ) : (
            <ul className="flex flex-col gap-2">
              {participants.map(p => (
                <li key={p.id} className="flex items-center gap-4 rounded-md p-3 text-sm">
                  <span className="font-semibold">{p.name}</span>

                  <span>{p.has_reading ? '(pages)' : 'no pages'}</span>

                  <label className="flex items-center gap-2">
                    <input
                      type="checkbox"
                      checked={p.has_reading}
                      onChange={e => updateHasReading(p.id, e.target.checked)}
                    />
                    pages
                  </label>

                  <span className="text-gray-700">{p.email ?? '—'}</span>
                  <span className="text-gray-700">{p.phone_number ?? '—'}</span>

                  <button
                    className="ml-auto rounded-md bg-white px-2 py-1 text-black"
                    onClick={() => deleteParticipant(p.id)}
                  >
                    Delete
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>

        {/* RIGHT: Weekly seating + schedule */}
<div className="flex-1 flex flex-col gap-4 p-4 bg-white/80 rounded-xl shadow-sm border border-black/5">
  <div className="flex items-start justify-between gap-4">
    <div>
      <h2 className="text-2xl font-semibold text-gray-900">This Week</h2>
      {cycleId && (
        <div className="text-xs text-gray-600 mt-1">
          Cycle: <span className="font-mono">{cycleId}</span>
        </div>
      )}
    </div>

    <div className="text-sm text-gray-700 bg-white rounded-lg px-3 py-2 border border-black/5 shadow-sm">
      Attending: <span className="font-semibold">{attendingCount}</span> / {cycleParticipants.length}
    </div>
  </div>

  {(cycleError || groups.error) && (
    <div className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
      {cycleError ?? groups.error}
    </div>
  )}

  {/* Seating */}
  <div className="bg-white rounded-xl border border-black/5 shadow-sm p-4">
    <div className="flex items-center justify-between mb-3">
      <h3 className="text-lg font-semibold text-gray-900">Seating</h3>
      <div className="text-xs text-gray-500">Non-attendees are excluded</div>
    </div>

    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
      {/* Table */}
      <div className="rounded-lg border border-black/5 p-3">
        <div className="flex items-center justify-between mb-2">
          <div className="font-medium text-gray-900">Table</div>
          <div className="text-xs text-gray-600">{groups.table.length} people</div>
        </div>

        {groups.table.length === 0 ? (
          <div className="text-sm text-gray-600">No one at the table.</div>
        ) : (
          <ul className="space-y-2">
            {groups.table.map(p => (
              <li key={p.id} className="flex items-center justify-between gap-2 rounded-lg bg-gray-50 px-3 py-2">
                <div className="min-w-0">
                  <div className="font-medium text-gray-900 truncate">{p.name}</div>
                  <div className="text-xs text-gray-500 truncate">
                    {p.email ?? '—'} • {p.phone_number ?? '—'}
                  </div>
                </div>

                <div className="flex flex-wrap items-center justify-end gap-1">
                  <span className="text-xs rounded-full bg-white border border-black/10 px-2 py-0.5 text-gray-700">
                    {p.attendance ?? 'unknown'}
                  </span>
                  <span
                    className={`text-xs rounded-full border px-2 py-0.5 ${
                      p.has_reading
                        ? 'bg-emerald-50 border-emerald-200 text-emerald-800'
                        : 'bg-gray-100 border-black/10 text-gray-700'
                    }`}
                  >
                    {p.has_reading ? 'pages' : 'no pages'}
                  </span>
                  <span className="text-xs rounded-full bg-white border border-black/10 px-2 py-0.5 text-gray-700">
                    {p.reading ?? 'unassigned'}
                  </span>
                </div>
              </li>
            ))}
          </ul>
        )}
      </div>

      {/* Lounge */}
      <div className="rounded-lg border border-black/5 p-3">
        <div className="flex items-center justify-between mb-2">
          <div className="font-medium text-gray-900">Lounge</div>
          <div className="text-xs text-gray-600">{groups.lounge.length} people</div>
        </div>

        {groups.lounge.length === 0 ? (
          <div className="text-sm text-gray-600">No one in the lounge.</div>
        ) : (
          <ul className="space-y-2">
            {groups.lounge.map(p => (
              <li key={p.id} className="flex items-center justify-between gap-2 rounded-lg bg-gray-50 px-3 py-2">
                <div className="min-w-0">
                  <div className="font-medium text-gray-900 truncate">{p.name}</div>
                  <div className="text-xs text-gray-500 truncate">
                    {p.email ?? '—'} • {p.phone_number ?? '—'}
                  </div>
                </div>

                <div className="flex flex-wrap items-center justify-end gap-1">
                  <span className="text-xs rounded-full bg-white border border-black/10 px-2 py-0.5 text-gray-700">
                    {p.attendance ?? 'unknown'}
                  </span>
                  <span
                    className={`text-xs rounded-full border px-2 py-0.5 ${
                      p.has_reading
                        ? 'bg-emerald-50 border-emerald-200 text-emerald-800'
                        : 'bg-gray-100 border-black/10 text-gray-700'
                    }`}
                  >
                    {p.has_reading ? 'pages' : 'no pages'}
                  </span>
                  <span className="text-xs rounded-full bg-white border border-black/10 px-2 py-0.5 text-gray-700">
                    {p.reading ?? 'unassigned'}
                  </span>
                </div>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  </div>

  {/* Up Next */}
  <div className="bg-white rounded-xl border border-black/5 shadow-sm p-4">
    <h3 className="text-lg font-semibold text-gray-900 mb-3">Up Next</h3>

    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
      {(['table', 'lounge'] as const).map(side => {
        const person = groups.upNext?.[side] ?? null
        return (
          <div key={side} className="rounded-lg border border-black/5 p-3">
            <div className="font-medium text-gray-900 mb-2">
              {side === 'table' ? 'Table' : 'Lounge'}
            </div>

            {!person ? (
              <div className="text-sm text-gray-600">No one up next.</div>
            ) : (
              <div className="flex items-center justify-between gap-3">
                <div className="min-w-0">
                  <div className="font-medium text-gray-900 truncate">{person.name}</div>
                  <div className="text-xs text-gray-500">
                    {person.has_reading ? 'pages' : 'no pages'} • {person.reading ?? 'unassigned'}
                  </div>
                </div>

                <div className="flex items-center gap-2 shrink-0">
                  <button
                    className="rounded-lg bg-gray-900 text-white px-3 py-1.5 text-sm hover:bg-gray-800"
                    onClick={() => patchCycleParticipant(person.id, { reading: 'confirmed' })}
                  >
                    Confirm
                  </button>
                  <button
                    className="rounded-lg bg-white border border-black/10 text-gray-900 px-3 py-1.5 text-sm hover:bg-gray-50"
                    onClick={() => patchCycleParticipant(person.id, { reading: 'deferred' })}
                  >
                    Defer
                  </button>
                </div>
              </div>
            )}
          </div>
        )
      })}
    </div>
  </div>

  {/* Readers */}
  <div className="bg-white rounded-xl border border-black/5 shadow-sm p-4">
    <h3 className="text-lg font-semibold text-gray-900 mb-3">Readers</h3>

    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
      <div className="rounded-lg border border-black/5 p-3">
        <div className="font-medium text-gray-900 mb-2">Table</div>

        <div className="text-sm text-gray-700 mb-2">Scheduled</div>
        {groups.readers.table.scheduled.length === 0 ? (
          <div className="text-sm text-gray-600">None.</div>
        ) : (
          <ul className="space-y-1">
            {groups.readers.table.scheduled.map(p => (
              <li key={p.id} className="text-sm text-gray-900">
                {p.name} <span className="text-xs text-gray-500">({p.reading ?? 'unassigned'})</span>
              </li>
            ))}
          </ul>
        )}

        <div className="text-sm text-gray-700 mt-4 mb-2">Bonus</div>
        {groups.readers.table.bonus.length === 0 ? (
          <div className="text-sm text-gray-600">None.</div>
        ) : (
          <ul className="space-y-1">
            {groups.readers.table.bonus.map(p => (
              <li key={p.id} className="text-sm text-gray-900">
                {p.name} <span className="text-xs text-gray-500">({p.reading ?? 'unassigned'})</span>
              </li>
            ))}
          </ul>
        )}
      </div>

      <div className="rounded-lg border border-black/5 p-3">
        <div className="font-medium text-gray-900 mb-2">Lounge</div>

        <div className="text-sm text-gray-700 mb-2">Scheduled</div>
        {groups.readers.lounge.scheduled.length === 0 ? (
          <div className="text-sm text-gray-600">None.</div>
        ) : (
          <ul className="space-y-1">
            {groups.readers.lounge.scheduled.map(p => (
              <li key={p.id} className="text-sm text-gray-900">
                {p.name} <span className="text-xs text-gray-500">({p.reading ?? 'unassigned'})</span>
              </li>
            ))}
          </ul>
        )}

        <div className="text-sm text-gray-700 mt-4 mb-2">Bonus</div>
        {groups.readers.lounge.bonus.length === 0 ? (
          <div className="text-sm text-gray-600">None.</div>
        ) : (
          <ul className="space-y-1">
            {groups.readers.lounge.bonus.map(p => (
              <li key={p.id} className="text-sm text-gray-900">
                {p.name} <span className="text-xs text-gray-500">({p.reading ?? 'unassigned'})</span>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  </div>
</div>

      </div>
    </main>
  )
}
