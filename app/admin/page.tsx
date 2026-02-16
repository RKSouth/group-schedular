// app/admin/page.tsx
'use client'

import { useEffect, useMemo, useState } from 'react'
import { makeGroups } from '../../lib/grouping'
import { ParticipantDetails } from './participantDetails'
import { basicButton, participantButton, seatingButton } from '../components/buttonStyles'

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
  return phone
}

/* -------------------------
   Reader schedule helpers (UI only)
-------------------------- */

function firstNameKey(fullName: string) {
  const trimmed = (fullName ?? '').trim().toLowerCase()
  if (!trimmed) return { first: '', full: '' }
  const first = trimmed.split(/\s+/)[0] ?? ''
  return { first, full: trimmed }
}

function sortByFirstName<T extends { id: number; name: string }>(arr: T[]): T[] {
  return [...arr].sort((a, b) => {
    const ka = firstNameKey(a.name)
    const kb = firstNameKey(b.name)
    if (ka.first !== kb.first) return ka.first.localeCompare(kb.first)
    const fullCmp = ka.full.localeCompare(kb.full)
    if (fullCmp !== 0) return fullCmp
    return a.id - b.id
  })
}

function takeWithWrap<T>(list: T[], startIndex: number, count: number): T[] {
  const n = list.length
  if (n === 0 || count <= 0) return []
  const start = ((startIndex % n) + n) % n
  const out: T[] = []
  for (let i = 0; i < count && out.length < n; i++) {
    out.push(list[(start + i) % n])
  }
  return out
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

  // click-to-expand on seating rows (right side)
  const [openId, setOpenId] = useState<number | null>(null)

  // click-to-expand on master participant list (left side)
  const [openParticipantId, setOpenParticipantId] = useState<number | null>(null)

  const seatedParticipants = useMemo(() => {
    return cycleParticipants.filter((person) => (person.attendance ?? 'unknown') === 'yes')
  }, [cycleParticipants])

  const groups = useMemo(() => makeGroups(seatedParticipants), [seatedParticipants])

  const attendingCount = useMemo(() => {
    return cycleParticipants.filter((person) => (person.attendance ?? 'unknown') === 'yes').length
  }, [cycleParticipants])

  const cycleByParticipantId = useMemo(() => {
    const map = new Map<number, CycleParticipant>()
    for (const person of cycleParticipants) map.set(person.id, person)
    return map
  }, [cycleParticipants])

  // ---------
  // Reader schedule view-model (derived; no JSX functions)
  const readerSchedule = useMemo(() => {
    const combined = sortByFirstName([...groups.rosters.table, ...groups.rosters.lounge])

    const start = groups.rosters.startIndex?.tableStartIndex ?? 0

    const THIS_WEEK_COUNT = 6
    const MAIN_COUNT = 4

    const thisWeekAll = takeWithWrap(combined, start, THIS_WEEK_COUNT)
    const nextWeekAll = takeWithWrap(combined, start + THIS_WEEK_COUNT, THIS_WEEK_COUNT)

    return {
      all: combined,
      thisWeek: {
        main: thisWeekAll.slice(0, MAIN_COUNT),
        bonus: thisWeekAll.slice(MAIN_COUNT),
      },
      nextWeek: {
        main: nextWeekAll.slice(0, MAIN_COUNT),
        bonus: nextWeekAll.slice(MAIN_COUNT),
      },
    }
  }, [groups.rosters.table, groups.rosters.lounge, groups.rosters.startIndex])

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

      // If the open participant disappeared, close the panel
      if (openParticipantId !== null && !data.some((person) => person.id === openParticipantId)) {
        setOpenParticipantId(null)
      }
    } catch (err) {
      console.error('Error loading participants', err)
    }
  }

  async function handleAdd() {
    if (!name.trim()) return

    setIsLoading(true)
    try {
      const res = await fetch('/api/participants', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: name.trim(),
          email: email.trim() || null,
          phoneNumber: phoneNumber.trim() || null,
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

      await loadParticipants()
      await loadCycleRoster()
    } catch (err) {
      console.error('Error adding participant', err)
    } finally {
      setIsLoading(false)
    }
  }

  async function logout() {
    await fetch('/admin/logout', { method: 'POST' })
    window.location.href = '/'
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

      const cycleRes = await fetch('/api/cycles/current')
      if (!cycleRes.ok) {
        setCycleError('Failed to load current cycle')
        return
      }
      const cycle = (await cycleRes.json()) as { id: string }
      setCycleId(cycle.id)

      const syncRes = await fetch(`/api/cycles/${cycle.id}/sync`, { method: 'POST' })
      if (!syncRes.ok) {
        const text = await syncRes.text()
        console.error('Failed to sync cycle roster:', text)
      }

      const rosterRes = await fetch(`/api/cycles/${cycle.id}/participants`)
      if (!rosterRes.ok) {
        const text = await rosterRes.text()
        console.error('Failed to load cycle roster:', text)
        setCycleError('Failed to load cycle roster')
        return
      }
      const roster = (await rosterRes.json()) as CycleParticipant[]
      setCycleParticipants(roster)

      // If the open person disappeared, close the panel
      if (openId !== null && !roster.some((person) => person.id === openId)) {
        setOpenId(null)
      }
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
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  return (
    <main className="min-h-screen bg-[url('/canadianFlags.jpg')] bg-cover bg-no-repeat bg-center">
      <button className="fixed top-4 right-4 rounded border bg-white/80 px-3 py-1" onClick={logout}>
        Logout
      </button>

      <h1 className="pt-10 text-gray-900 text-[3rem] font-bold flex items-center justify-center mb-4 mx-4">
        Administrator Page
      </h1>

      <div className="flex flex-col sm:flex-row gap-4 items-stretch p-4">
        {/* LEFT: Folks */}
        <div className="flex-1 flex flex-col p-4 bg-gray-400 text-gray-50 rounded-md">
          <h2 className="font-bold text-black text-2xl mb-2">Folks</h2>
          <p className="text-sm text-black/80">
            Add, update, or delete participants (master list).
          </p>
          <hr className="my-2 border-black/20" />
          <h3 className="font-semibold text-lg mb-2 text-white">Add Participant</h3>
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
                onChange={(e) => setName(e.target.value)}
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
                onChange={(e) => setEmail(e.target.value)}
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
                onChange={(e) => setPhoneNumber(e.target.value)}
                className="ml-2 px-2 bg-white text-black rounded-md"
              />
            </div>

            <button
              className={basicButton}
              onClick={handleAdd}
              disabled={isLoading || !name.trim()}
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
              {participants.map((person) => {
                const isOpen = openParticipantId === person.id
                const cycleInfo = cycleByParticipantId.get(person.id)
                const going = labelAttendance(cycleInfo?.attendance)

                return (
                  <li key={person.id} className="rounded-md p-3 text-sm bg-white/10">
                    <div className="flex items-start gap-3">
                      <button
                        type="button"
                        className={participantButton}
                        onClick={() => setOpenParticipantId(isOpen ? null : person.id)}
                      >
                        {person.name}
                      </button>
                      <div className="flex items-center gap-3 ml-auto">
                        <Badge text={going.text} tone={going.tone} />

                        <button
                          type="button"
                          className={basicButton}
                          onClick={() => deleteParticipant(person.id)}
                        >
                          Delete
                        </button>
                      </div>
                    </div>

                    {/* Details shown BELOW the name */}
                    {openParticipantId === person.id && (
                      <ParticipantDetails
                        person={person}
                        onPatch={patchCycleParticipant}
                        showAttendance={true}
                        showReading={true}
                        formatPhone={formatPhone}
                      />
                    )}
                  </li>
                )
              })}
            </ul>
          )}
        </div>

        {/* RIGHT: This Week */}
        <div className="flex-1 flex flex-col p-4 bg-white/85 rounded-md">
          <div className="mb-3">
            <h2 className="text-2xl font-bold text-gray-900">This Week</h2>
            {cycleId && <div className="text-xs text-gray-600">Cycle: {cycleId}</div>}
            <div className="text-sm text-gray-700 mt-1">
              Attending: <span className="font-semibold">{attendingCount}</span> /{' '}
              {cycleParticipants.length}{' '}
              <span className="text-xs text-gray-500">(Only “Attending” people are seated.)</span>
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
                    {groups.table.map((person) => {
                      const a = labelAttendance(person.attendance)
                      const pages = person.has_reading
                        ? { text: 'Has pages', tone: 'good' as const }
                        : { text: 'No pages', tone: 'neutral' as const }
                      const r = labelReading(person.reading)

                      return (
                        <li key={person.id} className="rounded-lg border bg-white p-3">
                          <div className="flex items-start justify-between gap-3">
                            <div className="min-w-0">
                              <button
                                type="button"
                                className={seatingButton}
                                onClick={() => setOpenId(openId === person.id ? null : person.id)}
                              >
                                {person.name}
                              </button>
                            </div>

                            <div className="flex flex-col items-end gap-1">
                              <div className="flex flex-wrap justify-end gap-2">
                                <Badge text={pages.text} tone={pages.tone} />
                              </div>
                              <div className="flex flex-wrap justify-end gap-2"></div>
                            </div>
                          </div>
                          {/* Details shown BELOW the name */}
                          {openId === person.id && (
                            <ParticipantDetails
                              person={person}
                              onPatch={patchCycleParticipant}
                              showAttendance={true}
                              showReading={true}
                              formatPhone={formatPhone}
                            />
                          )}
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
                    {groups.lounge.map((person) => {
                      const a = labelAttendance(person.attendance)
                      const pages = person.has_reading
                        ? { text: 'Has pages', tone: 'good' as const }
                        : { text: 'No pages', tone: 'neutral' as const }
                      const r = labelReading(person.reading)

                      return (
                        <li key={person.id} className="rounded-lg border bg-white p-3">
                          <div className="flex items-start justify-between gap-3">
                            <div className="min-w-0">
                              <button
                                type="button"
                                className="font-semibold text-gray-900 underline decoration-black/30 hover:decoration-black"
                                onClick={() => setOpenId(openId === person.id ? null : person.id)}
                              >
                                {person.name}
                              </button>
                            </div>

                            <div className="flex flex-col items-end gap-1">
                              <div className="flex flex-wrap justify-end gap-2">
                                <Badge text={pages.text} tone={pages.tone} />
                              </div>
                              <div className="flex flex-wrap justify-end gap-2"></div>
                            </div>
                          </div>
                          {/* Details shown BELOW the name */}
                          {openId === person.id && (
                            <ParticipantDetails
                              person={person}
                              onPatch={patchCycleParticipant}
                              showAttendance={true}
                              showReading={true}
                              formatPhone={formatPhone}
                            />
                          )}
                        </li>
                      )
                    })}
                  </ul>
                )}
              </div>
            </div>
          </div>

          {/* Reader Schedule (UPDATED ONLY) */}
          <div className="flex-1 flex flex-col p-4 bg-white/85 rounded-md">
            <h3 className="text-lg font-semibold text-gray-900 mb-2">Reader Schedule</h3>

            <div className="gap-4">
              {/* Up this week + up next week */}
              <div className="rounded-xl border bg-white p-3">
                <div className="font-semibold text-gray-900 mb-2">Up this week</div>

                {readerSchedule.thisWeek.main.length + readerSchedule.thisWeek.bonus.length ===
                0 ? (
                  <div className="text-sm text-gray-600">No eligible readers.</div>
                ) : (
                  <ul className="flex flex-col gap-1">
                    {readerSchedule.thisWeek.main.map((person) => {
                      const rs = labelReading(person.reading)
                      return (
                        <li
                          key={`this-main-${person.id}`}
                          className="flex items-center justify-between text-sm"
                        >
                          <button
                            type="button"
                            className="text-gray-900 underline decoration-black/30 hover:decoration-black"
                            onClick={() => setOpenId(openId === person.id ? null : person.id)}
                          >
                            {person.name}
                          </button>
                          <div className="flex items-center gap-2">
                            <Badge text="Main" tone="warn" />
                            <Badge text={rs.text} tone={rs.tone} />
                          </div>
                        </li>
                      )
                    })}

                    {readerSchedule.thisWeek.bonus.map((person) => {
                      const rs = labelReading(person.reading)
                      return (
                        <li
                          key={`this-bonus-${person.id}`}
                          className="flex items-center justify-between text-sm"
                        >
                          <button
                            type="button"
                            className="text-gray-900 underline decoration-black/30 hover:decoration-black"
                            onClick={() => setOpenId(openId === person.id ? null : person.id)}
                          >
                            {person.name}
                          </button>
                          <div className="flex items-center gap-2">
                            <Badge text="Bonus" tone="neutral" />
                            <Badge text={rs.text} tone={rs.tone} />
                          </div>
                        </li>
                      )
                    })}
                  </ul>
                )}

                <hr className="my-3 border-black/10" />

                <div className="font-semibold text-gray-900 mb-2">Up next week</div>

                {readerSchedule.nextWeek.main.length + readerSchedule.nextWeek.bonus.length ===
                0 ? (
                  <div className="text-sm text-gray-600">No eligible readers.</div>
                ) : (
                  <ul className="flex flex-col gap-1">
                    {readerSchedule.nextWeek.main.map((person) => {
                      const rs = labelReading(person.reading)
                      return (
                        <li
                          key={`next-main-${person.id}`}
                          className="flex items-center justify-between text-sm"
                        >
                          <button
                            type="button"
                            className="text-gray-900 underline decoration-black/30 hover:decoration-black"
                            onClick={() => setOpenId(openId === person.id ? null : person.id)}
                          >
                            {person.name}
                          </button>
                          <div className="flex items-center gap-2">
                            <Badge text="Main" tone="warn" />
                            <Badge text={rs.text} tone={rs.tone} />
                          </div>
                        </li>
                      )
                    })}

                    {readerSchedule.nextWeek.bonus.map((person) => {
                      const rs = labelReading(person.reading)
                      return (
                        <li
                          key={`next-bonus-${person.id}`}
                          className="flex items-center justify-between text-sm"
                        >
                          <button
                            type="button"
                            className="text-gray-900 underline decoration-black/30 hover:decoration-black"
                            onClick={() => setOpenId(openId === person.id ? null : person.id)}
                          >
                            {person.name}
                          </button>
                          <div className="flex items-center gap-2">
                            <Badge text="Bonus" tone="neutral" />
                            <Badge text={rs.text} tone={rs.tone} />
                          </div>
                        </li>
                      )
                    })}
                  </ul>
                )}
              </div>

              {/* Full roster list */}
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
