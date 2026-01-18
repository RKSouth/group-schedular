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

  // participant fields flattened by your /api/cycles/[cycleId]/participants route
  id: number
  name: string
  email: string | null
  phone_number: string | null
  has_reading: boolean
  created_at?: string
}

function labelAttendance(a: AttendanceStatus | undefined) {
  switch (a ?? 'unknown') {
    case 'yes':
      return { text: 'Attending', tone: 'good' as const }
    case 'no':
      return { text: 'Not attending', tone: 'bad' as const }
    case 'maybe':
      return { text: 'Maybe', tone: 'warn' as const }
    case 'unknown':
    default:
      return { text: 'RSVP needed', tone: 'neutral' as const }
  }
}

function labelReading(r: ReadingStatus | undefined) {
  switch (r ?? 'unassigned') {
    case 'pending':
      return { text: 'Up next', tone: 'warn' as const }
    case 'confirmed':
      return { text: 'Confirmed', tone: 'good' as const }
    case 'deferred':
      return { text: 'Deferred', tone: 'neutral' as const }
    case 'unassigned':
    default:
      return { text: 'Not scheduled', tone: 'neutral' as const }
  }
}

function Badge({
  text,
  tone = 'neutral',
}: {
  text: string
  tone?: 'neutral' | 'good' | 'warn' | 'bad'
}) {
  const toneClass =
    tone === 'good'
      ? 'bg-green-100 text-green-800 border-green-200'
      : tone === 'warn'
      ? 'bg-amber-100 text-amber-900 border-amber-200'
      : tone === 'bad'
      ? 'bg-red-100 text-red-800 border-red-200'
      : 'bg-gray-100 text-gray-800 border-gray-200'

  return (
    <span
      className={`inline-flex items-center rounded-full border px-2 py-0.5 text-xs font-medium ${toneClass}`}
    >
      {text}
    </span>
  )
}

function formatPhone(phone: string | null | undefined) {
  if (!phone) return '—'
  // keep simple; you can fancy-format later
  return phone
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

  const groups = useMemo(() => makeGroups(cycleParticipants), [cycleParticipants])

  const attendingCount = useMemo(() => {
    return cycleParticipants.filter(p => (p.attendance ?? 'unknown') !== 'no').length
  }, [cycleParticipants])

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
        const text = await res.text()
        console.error('Failed to add participant:', text)
        return
      }

      setName('')
      setEmail('')
      setPhoneNumber('')
      setHasReading(false)

      // Reload master list AND re-sync cycle roster
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
      const text = await res.text()
      console.error('Failed to update participant:', text)
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

      // 2) ensure roster rows exist
      const syncRes = await fetch(`/api/cycles/${cycle.id}/sync`, { method: 'POST' })
      if (!syncRes.ok) {
        const text = await syncRes.text()
        console.error('Failed to sync cycle roster:', text)
        // proceed anyway
      }

      // 3) load roster
      const rosterRes = await fetch(`/api/cycles/${cycle.id}/participants`)
      if (!rosterRes.ok) {
        const text = await rosterRes.text()
        console.error('Failed to load cycle roster:', text)
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
      <a href="/admin/logout" className="fixed top-4 right-4 rounded border bg-white/80 px-3 py-1">
        Logout
      </a>

      <h1 className="pt-10 text-gray-900 text-[3rem] font-bold flex items-center justify-center mb-4 mx-4">
        Administrator Page
      </h1>

      {/* LEFT: Folks (leave mostly the same, just tiny cleanup) */}
      <div className="flex flex-col sm:flex-row gap-4 items-stretch p-4">
        <div className="flex-1 flex flex-col p-4 bg-gray-400 text-gray-50 rounded-md">
          <h2 className="font-bold text-black text-xl mb-2">Folks</h2>
          <p className="text-sm text-black/80 mb-3">
            Add, update, or delete participants (master list).
          </p>

          <div className="mb-3">
            <div className="mb-2">
              <label htmlFor="name" className="font-medium text-black">
                Name:
              </label>
              <input
                id="name"
                type="text"
                value={name}
                placeholder="Enter name"
                onChange={e => setName(e.target.value)}
                className="ml-2 px-2 bg-white text-black rounded-md"
              />
            </div>

            <div className="mb-2">
              <label htmlFor="email" className="font-medium text-black">
                Email:
              </label>
              <input
                id="email"
                type="text"
                value={email}
                placeholder="Enter email"
                onChange={e => setEmail(e.target.value)}
                className="ml-2 px-2 bg-white text-black rounded-md"
              />
            </div>

            <div className="mb-2">
              <label htmlFor="cell" className="font-medium text-black">
                Cell:
              </label>
              <input
                id="cell"
                type="text"
                value={phoneNumber}
                placeholder="1234567890"
                onChange={e => setPhoneNumber(e.target.value)}
                className="ml-2 px-2 bg-white text-black rounded-md"
              />
            </div>

            <label className="block mb-2 text-black">
              <input
                type="checkbox"
                checked={hasReading}
                onChange={e => setHasReading(e.target.checked)}
                className="mr-2"
              />
              Pages (eligible to read)
            </label>

            <button
              className="rounded-md bg-white px-3 py-1 text-black"
              onClick={handleAdd}
              disabled={isLoading || !name.trim() || !email.trim() || !phoneNumber.trim()}
            >
              {isLoading ? 'Adding…' : 'Add'}
            </button>
          </div>

          <hr className="my-2 border-black/20" />

          <h3 className="font-semibold text-lg mb-2 text-white">
            All participants ({participants.length})
          </h3>

          {participants.length === 0 ? (
            <p className="text-white/90">No one yet.</p>
          ) : (
            <ul className="flex flex-col gap-2">
              {participants.map(p => (
                <li key={p.id} className="flex items-center gap-3 rounded-md p-3 text-sm bg-white/10">
                  <div className="min-w-0 flex-1">
                    <div className="font-semibold">{p.name}</div>
                    <div className="text-xs text-white/80">
                      {p.email ?? '—'} • {formatPhone(p.phone_number)}
                    </div>
                  </div>

                  <label className="flex items-center gap-2 text-xs">
                    <input
                      type="checkbox"
                      checked={p.has_reading}
                      onChange={e => updateHasReading(p.id, e.target.checked)}
                    />
                    Pages
                  </label>

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

        {/* RIGHT: This Week */}
        <div className="flex-1 flex flex-col p-4 bg-white/85 rounded-md">
          <div className="mb-3">
            <h2 className="text-2xl font-bold text-gray-900">This Week</h2>
            {cycleId && <div className="text-xs text-gray-600">Cycle: {cycleId}</div>}
            <div className="text-sm text-gray-700 mt-1">
              Attending: <span className="font-semibold">{attendingCount}</span> / {cycleParticipants.length}{' '}
              <span className="text-xs text-gray-500">(Anyone not marked “Not attending” is seated.)</span>
            </div>
          </div>

          {cycleError && <p className="text-red-600 mb-3">{cycleError}</p>}
          {groups.error && <p className="text-red-600 mb-3">{groups.error}</p>}

          {/* Seating */}
          <div className="mb-6">
            <h3 className="text-lg font-semibold text-gray-900 mb-2">Seating</h3>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {/* TABLE */}
              <div className="rounded-xl border bg-white p-3">
                <div className="flex items-center justify-between mb-2">
                  <div className="font-semibold text-gray-900">Table</div>
                  <div className="text-xs text-gray-600">{groups.table.length} people</div>
                </div>

                {groups.table.length === 0 ? (
                  <div className="text-sm text-gray-600">No one at the table.</div>
                ) : (
                  <ul className="flex flex-col gap-2">
                    {groups.table.map(p => {
                      const a = labelAttendance(p.attendance)
                      const pages = p.has_reading
                        ? { text: 'Has pages', tone: 'good' as const }
                        : { text: 'No pages', tone: 'neutral' as const }
                      const r = labelReading(p.reading)

                      return (
                        <li key={p.id} className="rounded-lg border bg-white p-3">
                          <div className="flex items-start justify-between gap-3">
                            <div className="min-w-0">
                              <div className="font-semibold text-gray-900">{p.name}</div>
                              <div className="text-xs text-gray-500">
                                {p.email ?? '—'} • {formatPhone(p.phone_number)}
                              </div>
                            </div>

                            <div className="flex flex-col items-end gap-1">
                              <div className="flex flex-wrap justify-end gap-2">
                                <Badge text={a.text} tone={a.tone} />
                                <Badge text={pages.text} tone={pages.tone} />
                              </div>
                              <div className="flex flex-wrap justify-end gap-2">
                                <Badge text={r.text} tone={r.tone} />
                              </div>
                            </div>
                          </div>

                          {/* RSVP controls (optional but makes "unknown" go away fast) */}
                          <div className="mt-2 flex flex-wrap gap-2">
                            <button
                              className="rounded-md border bg-white px-2 py-1 text-xs"
                              onClick={() => patchCycleParticipant(p.id, { attendance: 'yes' })}
                            >
                              Mark attending
                            </button>
                            <button
                              className="rounded-md border bg-white px-2 py-1 text-xs"
                              onClick={() => patchCycleParticipant(p.id, { attendance: 'maybe' })}
                            >
                              Mark maybe
                            </button>
                            <button
                              className="rounded-md border bg-white px-2 py-1 text-xs"
                              onClick={() => patchCycleParticipant(p.id, { attendance: 'no' })}
                            >
                              Mark not attending
                            </button>
                          </div>
                        </li>
                      )
                    })}
                  </ul>
                )}
              </div>

              {/* LOUNGE */}
              <div className="rounded-xl border bg-white p-3">
                <div className="flex items-center justify-between mb-2">
                  <div className="font-semibold text-gray-900">Lounge</div>
                  <div className="text-xs text-gray-600">{groups.lounge.length} people</div>
                </div>

                {groups.lounge.length === 0 ? (
                  <div className="text-sm text-gray-600">No one in the lounge.</div>
                ) : (
                  <ul className="flex flex-col gap-2">
                    {groups.lounge.map(p => {
                      const a = labelAttendance(p.attendance)
                      const pages = p.has_reading
                        ? { text: 'Has pages', tone: 'good' as const }
                        : { text: 'No pages', tone: 'neutral' as const }
                      const r = labelReading(p.reading)

                      return (
                        <li key={p.id} className="rounded-lg border bg-white p-3">
                          <div className="flex items-start justify-between gap-3">
                            <div className="min-w-0">
                              <div className="font-semibold text-gray-900">{p.name}</div>
                              <div className="text-xs text-gray-500">
                                {p.email ?? '—'} • {formatPhone(p.phone_number)}
                              </div>
                            </div>

                            <div className="flex flex-col items-end gap-1">
                              <div className="flex flex-wrap justify-end gap-2">
                                <Badge text={a.text} tone={a.tone} />
                                <Badge text={pages.text} tone={pages.tone} />
                              </div>
                              <div className="flex flex-wrap justify-end gap-2">
                                <Badge text={r.text} tone={r.tone} />
                              </div>
                            </div>
                          </div>

                          <div className="mt-2 flex flex-wrap gap-2">
                            <button
                              className="rounded-md border bg-white px-2 py-1 text-xs"
                              onClick={() => patchCycleParticipant(p.id, { attendance: 'yes' })}
                            >
                              Mark attending
                            </button>
                            <button
                              className="rounded-md border bg-white px-2 py-1 text-xs"
                              onClick={() => patchCycleParticipant(p.id, { attendance: 'maybe' })}
                            >
                              Mark maybe
                            </button>
                            <button
                              className="rounded-md border bg-white px-2 py-1 text-xs"
                              onClick={() => patchCycleParticipant(p.id, { attendance: 'no' })}
                            >
                              Mark not attending
                            </button>
                          </div>
                        </li>
                      )
                    })}
                  </ul>
                )}
              </div>
            </div>
          </div>

          {/* Up Next */}
          <div className="mb-6">
            <h3 className="text-lg font-semibold text-gray-900 mb-2">Up For Next Week</h3>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="rounded-xl border bg-white p-3">
                <div className="font-semibold text-gray-900 mb-2">Table</div>
                {groups.upNext?.table ? (
                  <div className="flex items-center justify-between gap-3">
                    <div className="min-w-0">
                      <div className="font-medium text-gray-900">{groups.upNext.table.name}</div>
                      <div className="text-xs text-gray-500">
                        {groups.upNext.table.has_reading ? 'Has pages' : 'No pages'}
                      </div>
                    </div>
                    <div className="flex gap-2">
                      <button
                        className="rounded-md bg-gray-900 px-2 py-1 text-xs text-white"
                        onClick={() =>
                          patchCycleParticipant(groups.upNext!.table!.id, { reading: 'confirmed' })
                        }
                      >
                        Confirm
                      </button>
                      <button
                        className="rounded-md border bg-white px-2 py-1 text-xs"
                        onClick={() =>
                          patchCycleParticipant(groups.upNext!.table!.id, { reading: 'deferred' })
                        }
                      >
                        Defer
                      </button>
                      <button
                        className="rounded-md border bg-white px-2 py-1 text-xs"
                        onClick={() =>
                          patchCycleParticipant(groups.upNext!.table!.id, { reading: 'pending' })
                        }
                      >
                        Set pending
                      </button>
                    </div>
                  </div>
                ) : (
                  <div className="text-sm text-gray-600">No one up next.</div>
                )}
              </div>

              <div className="rounded-xl border bg-white p-3">
                <div className="font-semibold text-gray-900 mb-2">Lounge</div>
                {groups.upNext?.lounge ? (
                  <div className="flex items-center justify-between gap-3">
                    <div className="min-w-0">
                      <div className="font-medium text-gray-900">{groups.upNext.lounge.name}</div>
                      <div className="text-xs text-gray-500">
                        {groups.upNext.lounge.has_reading ? 'Has pages' : 'No pages'}
                      </div>
                    </div>
                    <div className="flex gap-2">
                      <button
                        className="rounded-md bg-gray-900 px-2 py-1 text-xs text-white"
                        onClick={() =>
                          patchCycleParticipant(groups.upNext!.lounge!.id, { reading: 'confirmed' })
                        }
                      >
                        Confirm
                      </button>
                      <button
                        className="rounded-md border bg-white px-2 py-1 text-xs"
                        onClick={() =>
                          patchCycleParticipant(groups.upNext!.lounge!.id, { reading: 'deferred' })
                        }
                      >
                        Defer
                      </button>
                      <button
                        className="rounded-md border bg-white px-2 py-1 text-xs"
                        onClick={() =>
                          patchCycleParticipant(groups.upNext!.lounge!.id, { reading: 'pending' })
                        }
                      >
                        Set pending
                      </button>
                    </div>
                  </div>
                ) : (
                  <div className="text-sm text-gray-600">No one up next.</div>
                )}
              </div>
            </div>
          </div>

          {/* Scheduled / Bonus */}
          <div>
            <h3 className="text-lg font-semibold text-gray-900 mb-2">Reader Schedule</h3>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="rounded-xl border bg-white p-3">
                <div className="font-semibold text-gray-900 mb-2">Table</div>

                <div className="mb-3">
                  <div className="text-sm font-medium text-gray-800 mb-1">Scheduled</div>
                  {groups.readers.table.scheduled.length === 0 ? (
                    <div className="text-sm text-gray-600">No scheduled readers.</div>
                  ) : (
                    <ul className="flex flex-col gap-1">
                      {groups.readers.table.scheduled.map(p => {
                        const rs = labelReading(p.reading)
                        return (
                          <li key={p.id} className="flex items-center justify-between text-sm">
                            <span className="text-gray-900">{p.name}</span>
                            <Badge text={rs.text} tone={rs.tone} />
                          </li>
                        )
                      })}
                    </ul>
                  )}
                </div>

                <div>
                  <div className="text-sm font-medium text-gray-800 mb-1">Bonus</div>
                  {groups.readers.table.bonus.length === 0 ? (
                    <div className="text-sm text-gray-600">No bonus readers.</div>
                  ) : (
                    <ul className="flex flex-col gap-1">
                      {groups.readers.table.bonus.map(p => {
                        const rs = labelReading(p.reading)
                        return (
                          <li key={p.id} className="flex items-center justify-between text-sm">
                            <span className="text-gray-900">{p.name}</span>
                            <Badge text={rs.text} tone={rs.tone} />
                          </li>
                        )
                      })}
                    </ul>
                  )}
                </div>
              </div>

              <div className="rounded-xl border bg-white p-3">
                <div className="font-semibold text-gray-900 mb-2">Lounge</div>

                <div className="mb-3">
                  <div className="text-sm font-medium text-gray-800 mb-1">Scheduled</div>
                  {groups.readers.lounge.scheduled.length === 0 ? (
                    <div className="text-sm text-gray-600">No scheduled readers.</div>
                  ) : (
                    <ul className="flex flex-col gap-1">
                      {groups.readers.lounge.scheduled.map(p => {
                        const rs = labelReading(p.reading)
                        return (
                          <li key={p.id} className="flex items-center justify-between text-sm">
                            <span className="text-gray-900">{p.name}</span>
                            <Badge text={rs.text} tone={rs.tone} />
                          </li>
                        )
                      })}
                    </ul>
                  )}
                </div>

                <div>
                  <div className="text-sm font-medium text-gray-800 mb-1">Bonus</div>
                  {groups.readers.lounge.bonus.length === 0 ? (
                    <div className="text-sm text-gray-600">No bonus readers.</div>
                  ) : (
                    <ul className="flex flex-col gap-1">
                      {groups.readers.lounge.bonus.map(p => {
                        const rs = labelReading(p.reading)
                        return (
                          <li key={p.id} className="flex items-center justify-between text-sm">
                            <span className="text-gray-900">{p.name}</span>
                            <Badge text={rs.text} tone={rs.tone} />
                          </li>
                        )
                      })}
                    </ul>
                  )}
                </div>
              </div>
            </div>
          </div>

          <div className="mt-4 text-xs text-gray-600">
            Tip: “RSVP needed” just means attendance is still unknown for this cycle.
          </div>
        </div>
      </div>
    </main>
  )
}
