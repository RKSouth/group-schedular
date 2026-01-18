// lib/grouping.ts

export type AttendanceStatus = 'unknown' | 'yes' | 'no' | 'maybe'

// IMPORTANT: We are re-interpreting these weekly values:
//
// - unassigned: hasn't answered about pages this week (still in rotation)
// - pending: currently "up next" / being asked (still in rotation)
// - confirmed: YES, I have pages this week (counts as locked in)
// - deferred: NO, I do NOT have pages this week (skip them for scheduling this week)
export type ReadingStatus = 'unassigned' | 'pending' | 'confirmed' | 'deferred'

export type Participant = {
  id: number
  name: string
  email: string | null
  phone_number: string | null
  phoneNumber?: string | null

  // Keep this if your master list uses it, but we do NOT use it
  // to decide "who is up next" anymore.
  has_reading: boolean

  // weekly / cycle state (optional so old callers still work)
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

  upNext?: {
    table: Participant | null
    lounge: Participant | null
  }
}

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

function isAttending(p: Participant): boolean {
  // seated unless explicitly "no"
  return (p.attendance ?? 'unknown') !== 'no'
}

function readingStatus(p: Participant): ReadingStatus {
  return (p.reading ?? 'unassigned') as ReadingStatus
}

/**
 * Scheduling eligibility THIS WEEK:
 * - must be attending
 * - skip ONLY if they explicitly have "no pages this week" (deferred)
 *
 * Everyone else stays in rotation even if they haven't confirmed yet.
 */
function isSchedulableThisWeek(p: Participant): boolean {
  if (!isAttending(p)) return false
  return readingStatus(p) !== 'deferred'
}

/**
 * "Up next" logic:
 * 1) If someone is already pending in this group (and attending), they are up next.
 * 2) Else pick the next person in alphabetical rotation who is schedulable this week
 *    and is not already confirmed.
 */
function getUpNext(groupMembers: Participant[]): Participant | null {
  const attendingMembers = groupMembers.filter(isAttending)

  const pending = attendingMembers.find(p => readingStatus(p) === 'pending')
  if (pending) return pending

  const next = attendingMembers
    .filter(isSchedulableThisWeek)
    .filter(p => readingStatus(p) !== 'confirmed') // already locked-in this week
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
  // Rotation roster for this group: attending people, alphabetical
  // Skip only "deferred" (no pages this week)
  const roster = groupMembers
    .filter(isSchedulableThisWeek)
    .slice()
    .sort(sortByFirstName)

  // Put confirmed people first in the scheduled list (they already said "yes, I have pages")
  const confirmed = roster.filter(p => readingStatus(p) === 'confirmed')
  const notConfirmed = roster.filter(p => readingStatus(p) !== 'confirmed')

  // To fill remaining scheduled spots, rotate through notConfirmed from startIndex
  const scheduled: Participant[] = []
  const bonus: Participant[] = []

  // 1) confirmed go into scheduled first (up to quota)
  for (const p of confirmed) {
    if (scheduled.length >= scheduledQuota) break
    scheduled.push(p)
  }

  const n = notConfirmed.length
  if (n === 0) {
    // All schedulable people (if any) were confirmed; or roster empty.
    return {
      readers: { scheduled, bonus },
      nextStartIndex: 0,
    }
  }

  let i = ((startIndex % n) + n) % n
  const picked = new Set<number>(scheduled.map(p => p.id))

  function takeNextNotConfirmed(): Participant | null {
    for (let scan = 0; scan < n; scan++) {
      const p = notConfirmed[i]
      i = (i + 1) % n
      if (picked.has(p.id)) continue
      picked.add(p.id)
      return p
    }
    return null
  }

  // 2) Fill remaining scheduled slots
  while (scheduled.length < scheduledQuota) {
    const p = takeNextNotConfirmed()
    if (!p) break
    scheduled.push(p)
  }

  // 3) Fill bonus slots
  while (bonus.length < bonusQuota) {
    const p = takeNextNotConfirmed()
    if (!p) break
    bonus.push(p)
  }

  // Next week start AFTER the last *non-confirmed* person we scheduled from rotation.
  // (If we only scheduled confirmed people, we keep the same startIndex.)
  let nextStartIndex = startIndex
  const lastFromRotation = [...scheduled].reverse().find(p => readingStatus(p) !== 'confirmed')
  if (lastFromRotation) {
    const lastIdx = notConfirmed.findIndex(p => p.id === lastFromRotation.id)
    nextStartIndex = lastIdx === -1 ? startIndex : (lastIdx + 1) % n
  }

  return { readers: { scheduled, bonus }, nextStartIndex }
}

/**
 * makeGroups:
 * - Seating: ALL attending participants get seated (regardless of pages).
 * - Reader schedule: rotates through attending alphabetically, skipping only deferred.
 */
export function makeGroups(participants: Participant[], rotation?: RotationState): GroupResult {
  const seated = participants.filter(isAttending)
  const total = seated.length

  const tableStartIndex = rotation?.tableStartIndex ?? 0
  const loungeStartIndex = rotation?.loungeStartIndex ?? 0

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
    const table = shuffle(seated)
    const tableReaders = assignReadersForGroup(table, tableStartIndex, 4, 2)

    return {
      table,
      lounge: [],
      readers: {
        table: tableReaders.readers,
        lounge: { scheduled: [], bonus: [] },
      },
      upNext: {
        table: getUpNext(table),
        lounge: null,
      },
    }
  }

  // >8: split into 2 groups (pure seating; pages does not affect seating)
  const shuffled = shuffle(seated)
  const lounge: Participant[] = []
  const table: Participant[] = []

  for (const p of shuffled) {
    if (lounge.length <= table.length) lounge.push(p)
    else table.push(p)
  }

  const tableReaders = assignReadersForGroup(table, tableStartIndex, 4, 2)
  const loungeReaders = assignReadersForGroup(lounge, loungeStartIndex, 4, 2)

  return {
    table,
    lounge,
    readers: {
      table: tableReaders.readers,
      lounge: loungeReaders.readers,
    },
    upNext: {
      table: getUpNext(table),
      lounge: getUpNext(lounge),
    },
  }
}
