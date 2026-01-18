// lib/grouping.ts

export type AttendanceStatus = 'unknown' | 'yes' | 'no' | 'maybe'
export type ReadingStatus = 'unassigned' | 'pending' | 'confirmed' | 'deferred'

export type Participant = {
  id: number
  name: string
  email: string | null
  phone_number: string | null

  // If you have both of these in your codebase, keep them;
  // but you should pick ONE eventually.
  phoneNumber?: string | null

  // "Eligible to read at all" (master preference)
  has_reading: boolean

  // Weekly / cycle state (optional so old callers still work)
  attendance?: AttendanceStatus
  reading?: ReadingStatus
  responded_at?: string | null
}

export type GroupReaders = {
  scheduled: Participant[]
  bonus: Participant[]
}

export type GroupResult = {
  table: Participant[]
  lounge: Participant[]
  error?: string

  readers: {
    table: GroupReaders
    lounge: GroupReaders
  }

  // Who is currently "up next" (pending) or would be next (alphabetical) if none pending
  upNext?: {
    table: Participant | null
    lounge: Participant | null
  }
}

/**
 * Rotation state: you need to store these somewhere (DB) between weeks.
 * If you don't yet, pass 0/0 and it'll still work (just won't truly rotate).
 */
export type RotationState = {
  tableStartIndex: number
  loungeStartIndex: number
}

function shuffle<T>(arr: T[]): T[] {
  const copy = [...arr]
  for (let i = copy.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1))
    ;[copy[i], copy[j]] = [copy[j], copy[i]]
  }
  return copy
}

function getFirstName(name: string): string {
  const trimmed = name.trim()
  if (!trimmed) return ''
  return trimmed.split(/\s+/)[0] ?? ''
}

function sortByFirstName(a: Participant, b: Participant): number {
  const aFirst = getFirstName(a.name).toLowerCase()
  const bFirst = getFirstName(b.name).toLowerCase()

  if (aFirst < bFirst) return -1
  if (aFirst > bFirst) return 1

  const aFull = a.name.toLowerCase()
  const bFull = b.name.toLowerCase()
  if (aFull < bFull) return -1
  if (aFull > bFull) return 1

  return a.id - b.id
}

/**
 * Seating rule:
 * - If attendance is missing, treat as "unknown" and include.
 * - Exclude ONLY if explicitly "no".
 */
function isAttending(p: Participant): boolean {
  return (p.attendance ?? 'unknown') !== 'no'
}

/**
 * Reader eligibility THIS cycle (separate from seating):
 * - must be attending (in the room)
 * - must have pages (has_reading true)
 * - must be unassigned this cycle
 */
function isEligibleToBePickedThisCycle(p: Participant): boolean {
  if (!isAttending(p)) return false
  if (!p.has_reading) return false

  const status = p.reading ?? 'unassigned'
  if (status === 'deferred') return false
  if (status === 'confirmed') return false
  if (status === 'pending') return false

  return true // unassigned
}

function getPendingOrAlphabeticalNext(groupMembers: Participant[]): Participant | null {
  // If someone is already pending in this group, they are "up next"
  const pending = groupMembers.find(
    p => (p.reading ?? 'unassigned') === 'pending' && isAttending(p) && p.has_reading
  )
  if (pending) return pending

  // Otherwise, choose alphabetical next eligible
  const next = groupMembers
    .filter(isEligibleToBePickedThisCycle)
    .slice()
    .sort(sortByFirstName)[0]

  return next ?? null
}

function assignReadersForGroup(
  groupMembers: Participant[],
  startIndex: number,
  scheduledQuota = 4,
  bonusQuota = 2
): { readers: GroupReaders; nextStartIndex: number } {
  // eligible readers in this group, alphabetical by first name
  const eligible = groupMembers
    .filter(isEligibleToBePickedThisCycle)
    .slice()
    .sort(sortByFirstName)

  const scheduled: Participant[] = []
  const bonus: Participant[] = []

  const n = eligible.length
  if (n === 0) {
    return { readers: { scheduled, bonus }, nextStartIndex: 0 }
  }

  let i = ((startIndex % n) + n) % n
  const picked = new Set<number>()

  function takeNext(): Participant | null {
    for (let scan = 0; scan < n; scan++) {
      const p = eligible[i]
      i = (i + 1) % n

      if (picked.has(p.id)) continue
      picked.add(p.id)
      return p
    }
    return null
  }

  while (scheduled.length < scheduledQuota) {
    const p = takeNext()
    if (!p) break
    scheduled.push(p)
  }

  while (bonus.length < bonusQuota) {
    const p = takeNext()
    if (!p) break
    bonus.push(p)
  }

  // Next week start AFTER the last scheduled reader
  let nextStartIndex = startIndex
  const lastScheduled = scheduled[scheduled.length - 1]
  if (lastScheduled) {
    const lastIdx = eligible.findIndex(p => p.id === lastScheduled.id)
    nextStartIndex = lastIdx === -1 ? startIndex : (lastIdx + 1) % n
  }

  return { readers: { scheduled, bonus }, nextStartIndex }
}

/**
 * makeGroups:
 * - Seating is based ONLY on attendance.
 * - Reading assignment is separate and uses has_reading + reading status.
 */
export function makeGroups(
  participants: Participant[],
  rotation?: RotationState
): GroupResult {
  const tableStartIndex = rotation?.tableStartIndex ?? 0
  const loungeStartIndex = rotation?.loungeStartIndex ?? 0

  // ✅ Seat only attending people (pages flag does NOT affect seating)
  const attending = participants.filter(isAttending)
  const total = attending.length

  if (total === 0) {
    return {
      table: [],
      lounge: [],
      error: 'No attendees for this week.',
      readers: {
        table: { scheduled: [], bonus: [] },
        lounge: { scheduled: [], bonus: [] },
      },
      upNext: { table: null, lounge: null },
    }
  }

  // <=8: everyone at the table
  if (total <= 8) {
    const table = shuffle(attending)
    const tableReaders = assignReadersForGroup(table, tableStartIndex, 4, 2)

    return {
      table,
      lounge: [],
      readers: {
        table: tableReaders.readers,
        lounge: { scheduled: [], bonus: [] },
      },
      upNext: {
        table: getPendingOrAlphabeticalNext(table),
        lounge: null,
      },
    }
  }

  // >8: split attending into 2 groups (balanced)
  const shuffled = shuffle(attending)
  const lounge: Participant[] = []
  const table: Participant[] = []

  for (const p of shuffled) {
    if (lounge.length <= table.length) lounge.push(p)
    else table.push(p)
  }

  // Readers assigned AFTER seating (separate concern)
  const tableReaders = assignReadersForGroup(table, tableStartIndex, 4, 2)
  const loungeReaders = assignReadersForGroup(lounge, loungeStartIndex, 4, 2)

  // Optional helpful error if nobody can be selected
  const eligibleCount = attending.filter(isEligibleToBePickedThisCycle).length
  const error =
    eligibleCount === 0
      ? 'No eligible readers (must be attending + have pages + unassigned).'
      : undefined

  return {
    table,
    lounge,
    error,
    readers: {
      table: tableReaders.readers,
      lounge: loungeReaders.readers,
    },
    upNext: {
      table: getPendingOrAlphabeticalNext(table),
      lounge: getPendingOrAlphabeticalNext(lounge),
    },
  }
}
