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

const STORAGE_KEY_SELECTED_ID = 'do-write-selected-participant-id'
// character limit: change this number if you want (this is the only place)
const READING_DESC_MAX = 280

export default function Page() {
  const [cycleId, setCycleId] = useState<string | null>(null)
  const [roster, setRoster] = useState<CycleParticipant[]>([])
  const [selectedId, setSelectedId] = useState<number | null>(null)

  // flow state: user must pick name, then click button to proceed
  const [hasProceeded, setHasProceeded] = useState(false)

  // form state
  const [attendanceChoice, setAttendanceChoice] = useState<'yes' | 'no' | 'maybe' | ''>('')
  const [readerChoice, setReaderChoice] = useState<'confirmed' | 'deferred' | ''>('')
  const [readingDescription, setReadingDescription] = useState('')

  const [loading, setLoading] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState<string | null>(null)

  const selected = useMemo(
    () => roster.find((p) => p.id === selectedId) ?? null,
    [roster, selectedId]
  )

  // ✅ keep your existing grouping logic call
  const groups = useMemo(() => makeGroups(roster), [roster])

  // ✅ fix optional chaining (this was a real JS bug)
  const isUpNext =
    !!selected &&
    (groups.upNext?.table?.id === selected.id || groups.upNext?.lounge?.id === selected.id)

  const isAttendingCounted = (p: CycleParticipant) => (p.attendance ?? 'unknown') !== 'no'

  const shouldShowReaderForm = !!selected && isUpNext
  const shouldShowNonReaderForm = !!selected && !isUpNext

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

      const normalized: CycleParticipant[] = (raw ?? []).map((r) => ({
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
      if (id === null) {
        localStorage.removeItem(STORAGE_KEY_SELECTED_ID)
      } else {
        localStorage.setItem(STORAGE_KEY_SELECTED_ID, String(id))
      }
    } catch {
      // ignore
    }
  }

  // load once: roster + cached selection
  useEffect(() => {
    // cached selection (optional)
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

  // if user changes selection, reset flow + form, and cache it
  useEffect(() => {
    persistSelectedId(selectedId)
    setHasProceeded(false)
    setAttendanceChoice('')
    setReaderChoice('')
    setReadingDescription('')
  }, [selectedId])

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

    // must pick attendance before submit
    if (attendanceChoice !== 'yes' && attendanceChoice !== 'no' && attendanceChoice !== 'maybe') {
      setError('Please select whether you are going.')
      return
    }

    // if they are up next, they must confirm or defer
    if (shouldShowReaderForm) {
      if (readerChoice !== 'confirmed' && readerChoice !== 'deferred') {
        setError('Please confirm or defer your reading.')
        return
      }
    }

    try {
      setSubmitting(true)

      const patch: Record<string, unknown> = {
        attendance: attendanceChoice,
      }

      // Only include reading fields when they are up next
      if (shouldShowReaderForm) {
        patch.reading = readerChoice

        // send description too (server can ignore if not stored yet)
        patch.reading_description = readingDescription.slice(0, READING_DESC_MAX)
      }

      await patchCycleParticipant(selected.id, patch)

      // refresh roster so the “who’s attending/reading” reflects immediately
      await loadRoster()

      setSuccess('Saved!')
      window.alert('Saved! ✅')
      setHasProceeded(false)
      setAttendanceChoice('')
      setReaderChoice('')
      setReadingDescription('')
    } catch (e) {
      const msg = e instanceof Error ? e.message : 'Unknown error'
      setError(msg)
    } finally {
      setSubmitting(false)
    }
  }

  // “This only appears after they RSVP and are directed back”
  // -> we show the roster lists when the selected person has a responded_at, OR after a save (success)
  const selectedHasResponded = !!selected?.responded_at
  const showFrontPageInfo = selectedHasResponded || !!success

  return (
    <main className="min-h-screen bg-[url('/canadianFlags.jpg')] bg-cover bg-no-repeat bg-center">
      {/* top right admin button */}
      <a
        href="/admin/login"
        className="fixed top-4 right-4 rounded border text-black bg-white/80 px-3 py-1"
      >
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
          </div>

          <button
            className="self-start rounded-md bg-white px-3 py-2 text-black"
            onClick={() => setHasProceeded(true)}
            disabled={loading || submitting || !selected}
          >
            Continue
          </button>

          <button
            className="mt-3 self-start rounded-md bg-white px-3 py-2 text-black"
            onClick={loadRoster}
            disabled={loading || submitting}
          >
            {loading ? 'Loading…' : 'Refresh'}
          </button>

          {error && <p className="mt-3 text-red-700 bg-white/80 rounded p-2">{error}</p>}
          {success && <p className="mt-3 text-green-700 bg-white/80 rounded p-2">{success}</p>}
        </div>

        {/* RIGHT: form + (after RSVP) front page info */}
        <div className="flex-1 flex flex-col p-4 bg-gray-400 text-gray-50 rounded-md">
          <h2 className="font-bold text-black text-xl mb-2">This Week</h2>

          {!hasProceeded || !selected ? (
            <div className="bg-white/80 rounded-md p-3 text-black">
              <div className="text-sm text-black/70">
                Select your name and click <span className="font-medium">Continue</span>.
              </div>
            </div>
          ) : (
            <div className="bg-white/80 rounded-md p-3 text-black">
              {/* name at top */}
              <div className="font-semibold mb-2">{selected.name}</div>

              {/* link to meet up + basic instructions */}
              <div className="text-sm mb-3">
                <div className="mb-1">
                  <a href="#" className="underline">
                    Meetup link
                  </a>
                </div>
                <div>Instructions: Please RSVP below.</div>
              </div>

              {/* attendance radio */}
              <div className="mb-3">
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

              {/* reader form only when they are up next */}
              {shouldShowReaderForm ? (
                <>
                  <hr className="my-3" />

                  <div className="mb-2">
                    <div className="font-medium">Reading</div>
                    <div className="text-xs text-black/60">You are up next in the rotation.</div>
                  </div>

                  <div className="mb-3">
                    <label className="flex items-center gap-2 mb-1">
                      <input
                        type="radio"
                        name="reading"
                        value="confirmed"
                        checked={readerChoice === 'confirmed'}
                        onChange={() => setReaderChoice('confirmed')}
                        disabled={submitting}
                      />
                      Confirm
                    </label>

                    <label className="flex items-center gap-2">
                      <input
                        type="radio"
                        name="reading"
                        value="deferred"
                        checked={readerChoice === 'deferred'}
                        onChange={() => setReaderChoice('deferred')}
                        disabled={submitting}
                      />
                      Defer
                    </label>
                  </div>

                  <div className="mb-3">
                    <div className="font-medium mb-1">What are you reading?</div>
                    <textarea
                      className="w-full rounded-md bg-white text-black px-2 py-2"
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
                </>
              ) : null}

              {/* non-reader form (up next only) — no extra fields */}
              {shouldShowNonReaderForm ? null : null}

              <button
                className="rounded-md bg-white px-3 py-2 text-black"
                onClick={handleSubmit}
                disabled={submitting}
              >
                {submitting ? 'Submitting…' : 'Submit'}
              </button>
            </div>
          )}

          {/* front page info (only show after RSVP / redirected back) */}
          {showFrontPageInfo ? (
            <div className="mt-4 bg-white/80 rounded-md p-3 text-black">
              <div className="text-sm text-black/70 mb-2">
                Attending this week: {roster.filter(isAttendingCounted).length} / {roster.length}
              </div>

              <div className="font-semibold mb-2">Up Next</div>

              <div className="text-sm mb-3">
                <div>
                  <span className="font-medium">Table:</span>{' '}
                  {groups.upNext?.table?.name ?? 'No one up next.'}
                </div>
                <div>
                  <span className="font-medium">Lounge:</span>{' '}
                  {groups.upNext?.lounge?.name ?? 'No one up next.'}
                </div>
              </div>

              <div className="font-semibold mb-2">Confirmed attendees</div>
              <ul className="list-disc ml-5 text-sm">
                {roster
                  .filter((p) => p.attendance === 'yes')
                  .map((p) => (
                    <li key={p.id}>{p.name}</li>
                  ))}
              </ul>

              <div className="font-semibold mt-3 mb-2">Confirmed readers</div>
              <ul className="list-disc ml-5 text-sm">
                {roster
                  .filter((p) => p.reading === 'confirmed')
                  .map((p) => (
                    <li key={p.id}>{p.name}</li>
                  ))}
              </ul>
            </div>
          ) : null}
        </div>
      </div>
    </main>
  )
}
