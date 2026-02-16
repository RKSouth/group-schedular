'use client'

import { useEffect, useMemo, useState } from 'react'
import { makeGroups } from '../lib/grouping'

type AttendanceStatus = 'unknown' | 'yes' | 'no' | 'maybe'
type ReadingStatus = 'unassigned' | 'pending' | 'confirmed' | 'deferred'

type CycleParticipant = {
  cycle_id: string
  attendance: AttendanceStatus
  reading: ReadingStatus
  responded_at: string | null
  reading_description: string | null

  id: number
  name: string
  email: string | null
  phone_number: string | null
  has_reading: boolean
}

// stops `r` from being `unknown`
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
  reading_description?: unknown
}

function asAttendanceStatus(v: unknown): AttendanceStatus {
  if (v === 'unknown' || v === 'yes' || v === 'no' || v === 'maybe') return v
  return 'unknown'
}

function asReadingStatus(v: unknown): ReadingStatus {
  if (v === 'unassigned' || v === 'pending' || v === 'confirmed' || v === 'deferred') return v
  return 'unassigned'
}

function asReadingDescription(v: unknown): string | null {
  if (v === null || v === undefined) return null
  if (typeof v !== 'string') return null
  const trimmed = v.trim()
  return trimmed.length ? trimmed : null
}

const STORAGE_KEY_SELECTED_ID = 'do-write-selected-participant-id'
const READING_DESC_MAX = 300

function nextTuesdayDate(from: Date): Date {
  // JS: 0=Sun ... 2=Tue ... 6=Sat
  const day = from.getDay()
  const daysUntilTue = (2 - day + 7) % 7
  const add = daysUntilTue === 0 ? 7 : daysUntilTue // “next Tuesday”, not “today if Tuesday”
  const d = new Date(from)
  d.setDate(from.getDate() + add)
  d.setHours(0, 0, 0, 0)
  return d
}

function formatMeetingDate(d: Date): string {
  return new Intl.DateTimeFormat('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  }).format(d)
}

export default function Page() {
  const [cycleId, setCycleId] = useState<string | null>(null)
  const [roster, setRoster] = useState<CycleParticipant[]>([])
  const [selectedId, setSelectedId] = useState<number | null>(null)

  const [hasProceeded, setHasProceeded] = useState(false)

  // form state
  const [attendanceChoice, setAttendanceChoice] = useState<'yes' | 'no' | 'maybe' | ''>('')
  // we reuse reading status for “I have pages / I do not have pages”
  const [readingChoice, setReadingChoice] = useState<'confirmed' | 'deferred' | ''>('')
  const [readingDescription, setReadingDescription] = useState('')

  const [loading, setLoading] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState<string | null>(null)

  const selected = useMemo(
    () => roster.find((p) => p.id === selectedId) ?? null,
    [roster, selectedId]
  )

  const groups = useMemo(() => makeGroups(roster), [roster])

  const isUpNext =
    !!selected &&
    (groups.upNext?.table?.id === selected.id || groups.upNext?.lounge?.id === selected.id)

  const meetingDateLabel = useMemo(() => {
    const d = nextTuesdayDate(new Date())
    return formatMeetingDate(d)
  }, [])

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

      const raw = (await rosterRes.json()) as RosterApiRow[]

      const normalized: CycleParticipant[] = (raw ?? []).map((r) => ({
        cycle_id: String(r.cycle_id ?? cycle.id),

        id: Number(r.id),
        name: String(r.name ?? ''),
        email: r.email ?? null,
        phone_number: r.phone_number ?? null,
        has_reading: !!r.has_reading,

        attendance: asAttendanceStatus(r.attendance),
        reading: asReadingStatus(r.reading),
        responded_at: typeof r.responded_at === 'string' ? r.responded_at : null,

        // ✅ actually store it
        reading_description: asReadingDescription(r.reading_description),
      }))

      setRoster(normalized)

      // If selection vanished, reset
      if (selectedId !== null && !normalized.some((p) => p.id === selectedId)) {
        setSelectedId(null)
        setHasProceeded(false)
      }
    } catch (e) {
      const msg = e instanceof Error ? e.message : 'Unknown error'
      setError(msg)
    } finally {
      setLoading(false)
    }
  }

  function persistSelectedId(id: number | null) {
    try {
      if (id === null) localStorage.removeItem(STORAGE_KEY_SELECTED_ID)
      else localStorage.setItem(STORAGE_KEY_SELECTED_ID, String(id))
    } catch {
      // ignore
    }
  }

  useEffect(() => {
    try {
      const cached = localStorage.getItem(STORAGE_KEY_SELECTED_ID)
      if (cached) {
        const n = Number(cached)
        if (Number.isFinite(n)) setSelectedId(n)
      }
    } catch {
      // ignore
    }

    loadRoster()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // reset flow + form on selection change
  useEffect(() => {
    persistSelectedId(selectedId)
    setHasProceeded(false)
    setAttendanceChoice('')
    setReadingChoice('')

    const p = roster.find((x) => x.id === selectedId)
    setReadingDescription(p?.reading_description ?? '')
  }, [selectedId, roster])

  async function patchCycleParticipant(participantId: number, patch: Record<string, unknown>) {
    if (!cycleId) return

    const res = await fetch(`/api/cycles/${cycleId}/participants/${participantId}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(patch),
    })

    if (!res.ok) {
      const text = await res.text()
      throw new Error(text || 'Failed to update')
    }
  }

  async function handleSubmit() {
    if (!selected) return
    if (!cycleId) return

    setError(null)
    setSuccess(null)

    if (attendanceChoice !== 'yes' && attendanceChoice !== 'no' && attendanceChoice !== 'maybe') {
      setError('Please select whether you are going.')
      return
    }

    try {
      setSubmitting(true)

      const patch: Record<string, unknown> = {
        attendance: attendanceChoice,
      }

      // Allow “I have pages / no pages” even if not up next.
      // Only send reading fields if they picked one, AND they’re attending yes.
      if (
        attendanceChoice === 'yes' &&
        (readingChoice === 'confirmed' || readingChoice === 'deferred')
      ) {
        patch.reading = readingChoice

        if (readingChoice === 'confirmed') {
          patch.reading_description = readingDescription.slice(0, READING_DESC_MAX)
        } else {
          // ✅ clear in DB
          patch.reading_description = null
        }
      }

      await patchCycleParticipant(selected.id, patch)
      await loadRoster()

      setSuccess('Saved!')
      window.alert('Saved! ✅')
      setHasProceeded(false)
      setAttendanceChoice('')
      setReadingChoice('')
      setReadingDescription('')
    } catch (e) {
      const msg = e instanceof Error ? e.message : 'Unknown error'
      setError(msg)
    } finally {
      setSubmitting(false)
    }
  }

  // Prefill form when they hit Continue (no inline helper functions)
  useEffect(() => {
    if (!hasProceeded || !selected) return

    // if they already responded previously this cycle, prefill from stored values
    if (
      selected.attendance === 'yes' ||
      selected.attendance === 'no' ||
      selected.attendance === 'maybe'
    ) {
      setAttendanceChoice(selected.attendance)
    }

    if (selected.reading === 'confirmed' || selected.reading === 'deferred') {
      setReadingChoice(selected.reading)
    }

    if (selected.reading_description) {
      setReadingDescription(selected.reading_description.slice(0, READING_DESC_MAX))
    }
  }, [hasProceeded, selected])

  return (
    <main className="min-h-screen bg-[url('/canadianFlags.jpg')] bg-cover bg-no-repeat bg-center">
      <a
        href="/admin/login"
        className="fixed top-4 right-4 rounded border text-black bg-white/80 px-3 py-1"
      >
        Admin
      </a>

      <div className="mx-auto w-full max-w-2xl px-6 sm:px-12 py-10">
        <div className="mb-5 text-center">
          <h1 className="text-gray-900 text-[2.5rem] sm:text-[3rem] font-bold">
            Do Write Scheduler
          </h1>

          {/* BIG SPINNING LOBSTER BELOW TITLE */}
          <div
            className="mt-3 text-7xl sm:text-8xl animate-spin"
            style={{ animationDuration: '4s' }}
            aria-hidden="true"
          >
            🦞
          </div>

          <div className="mt-3 text-sm text-black/80">
            Meeting: <span className="font-semibold">{meetingDateLabel}</span>
          </div>

          {cycleId && <div className="mt-1 text-xs text-black/60">Cycle code: {cycleId}</div>}
        </div>

        <div className="rounded-2xl bg-white/85 border shadow-sm p-5 sm:p-6">
          <div className="mb-4">
            <label className="block text-black font-medium mb-1">Select your name</label>

            <select
              className="w-full rounded-md bg-white text-black px-3 py-2 border"
              value={selectedId ?? ''}
              onChange={(e) => setSelectedId(e.target.value ? Number(e.target.value) : null)}
              disabled={loading || submitting}
            >
              <option value="">— Choose —</option>
              {roster.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name}
                </option>
              ))}
            </select>

            <div className="mt-3 flex flex-wrap gap-2 justify-center">
              <button
                className="rounded-md bg-black/90 px-4 py-2 text-white"
                onClick={() => setHasProceeded(true)}
                disabled={loading || submitting || !selected}
              >
                Continue
              </button>

              <button
                className="rounded-md bg-white px-4 py-2 text-black border"
                onClick={loadRoster}
                disabled={loading || submitting}
              >
                {loading ? 'Loading…' : 'Refresh'}
              </button>
            </div>

            {error && <p className="mt-3 text-red-700 bg-red-50 rounded p-2 border">{error}</p>}
            {success && (
              <p className="mt-3 text-green-700 bg-green-50 rounded p-2 border">{success}</p>
            )}
          </div>

          <hr className="my-4" />

          {!hasProceeded || !selected ? (
            <div className="rounded-md p-3 text-black bg-gray-50 border">
              <div className="text-sm text-black/70">
                Select your name and click <span className="font-medium">Continue</span>.
              </div>
            </div>
          ) : (
            <div className="text-black">
              <div className="font-semibold mb-2 text-lg">{selected.name}</div>

              <div className="text-sm mb-3">
                <div className="mb-1">
                  <a href="#" className="underline">
                    Meetup link
                  </a>
                </div>
                <div>Instructions: Please RSVP below.</div>
              </div>

              {/* Attendance */}
              <div className="mb-4">
                <div className="font-medium mb-1">Are you going?</div>
                <label className="flex items-center gap-2 mb-1">
                  <input
                    type="radio"
                    name="attendance"
                    value="yes"
                    checked={attendanceChoice === 'yes'}
                    onChange={() => setAttendanceChoice('yes')}
                    disabled={submitting}
                  />
                  Yes
                </label>
                <label className="flex items-center gap-2 mb-1">
                  <input
                    type="radio"
                    name="attendance"
                    value="no"
                    checked={attendanceChoice === 'no'}
                    onChange={() => setAttendanceChoice('no')}
                    disabled={submitting}
                  />
                  No
                </label>
                <label className="flex items-center gap-2">
                  <input
                    type="radio"
                    name="attendance"
                    value="maybe"
                    checked={attendanceChoice === 'maybe'}
                    onChange={() => setAttendanceChoice('maybe')}
                    disabled={submitting}
                  />
                  Maybe
                </label>
              </div>

              <hr className="my-4" />

              {/* Reading availability (for everyone) */}
              <div className="mb-2">
                <div className="font-medium">Reading</div>
                {isUpNext ? (
                  <div className="text-xs text-black/60">You are up next in the rotation.</div>
                ) : (
                  <div className="text-xs text-black/60">
                    If you have pages, add a short summary (optional).
                  </div>
                )}
              </div>

              <div className="mb-3">
                <div className="text-sm mb-1">Do you have pages this week?</div>

                <label className="flex items-center gap-2 mb-1">
                  <input
                    type="radio"
                    name="readingAvailability"
                    value="confirmed"
                    checked={readingChoice === 'confirmed'}
                    onChange={() => setReadingChoice('confirmed')}
                    disabled={submitting || attendanceChoice !== 'yes'}
                  />
                  Yes — I have pages
                </label>

                <label className="flex items-center gap-2">
                  <input
                    type="radio"
                    name="readingAvailability"
                    value="deferred"
                    checked={readingChoice === 'deferred'}
                    onChange={() => setReadingChoice('deferred')}
                    disabled={submitting || attendanceChoice !== 'yes'}
                  />
                  No — I do not have pages
                </label>

                {attendanceChoice !== 'yes' && (
                  <div className="mt-2 text-xs text-black/60">
                    Reading is only relevant if you’re attending.
                  </div>
                )}
              </div>

              {/* Reading summary appears when they say “Yes I have pages” */}
              {attendanceChoice === 'yes' && readingChoice === 'confirmed' ? (
                <div className="mb-4">
                  <div className="font-medium mb-1">What are you reading?</div>
                  <textarea
                    className="w-full rounded-md bg-white text-black px-3 py-2 border"
                    value={readingDescription}
                    onChange={(e) =>
                      setReadingDescription(e.target.value.slice(0, READING_DESC_MAX))
                    }
                    maxLength={READING_DESC_MAX}
                    rows={3}
                    disabled={submitting}
                  />
                  <div className="text-xs text-black/60 mt-1">
                    {readingDescription.length}/{READING_DESC_MAX}
                  </div>
                </div>
              ) : null}

              <div className="flex justify-center">
                <button
                  className="rounded-md bg-black/90 px-4 py-2 text-white"
                  onClick={handleSubmit}
                  disabled={submitting}
                >
                  {submitting ? 'Submitting…' : 'Submit'}
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </main>
  )
}
