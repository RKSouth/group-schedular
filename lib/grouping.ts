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

  // NEW (weekly / cycle state) - optional so old callers still work
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

  // Optional, but useful for UI:
  // who is currently "up next" (pending) or would be next (alphabetical) if none pending
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

function isAttending(p: Participant): boolean {
  // If not provided, treat as eligible.
  return (p.attendance ?? 'unknown') !== 'no'
}

function isEligibleToBePickedThisCycle(p: Participant): boolean {
  if (!p.has_reading) return false
  if (!isAttending(p)) return false

  // If we have cycle state, skip these.
  // (If cycle state is missing, defaults to 'unassigned'.)
  const status = p.reading ?? 'unassigned'
  if (status === 'deferred') return false
  if (status === 'confirmed') return false
  if (status === 'pending') return false

  return true // unassigned
}

function getPendingOrAlphabeticalNext(groupMembers: Participant[]): Participant | null {
  // If someone is already pending in this group, they are "up next"
  const pending = groupMembers.find(p => (p.reading ?? 'unassigned') === 'pending')
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
 * - <=8: one group (table), lounge empty
 * - >8: random split into 2 groups, ensure 2 readers each
 * - also assigns readers per group (4 scheduled + 2 bonus per group), using alphabetical rotation
 */
export function makeGroups(
  participants: Participant[],
  rotation?: RotationState
): GroupResult {
  const total = participants.length
  const tableStartIndex = rotation?.tableStartIndex ?? 0
  const loungeStartIndex = rotation?.loungeStartIndex ?? 0

  // NOTE: your comment said <=10 but code uses <=8; pick one.
  if (total <= 8) {
    const table = shuffle(participants)

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

  const readers = participants.filter(p => p.has_reading && isAttending(p))
  const nonReaders = participants.filter(p => !p.has_reading || !isAttending(p))

  // Need at least 4 eligible readers total to guarantee 2 per group
  if (readers.length < 4) {
    const table = shuffle(participants)
    const tableReaders = assignReadersForGroup(table, tableStartIndex, 4, 2)

    return {
      table,
      lounge: [],
      error: 'Not enough eligible readers to have at least 2 in each group.',
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

  const shuffledReaders = shuffle(readers)
  const shuffledNonReaders = shuffle(nonReaders)

  const lounge: Participant[] = []
  const table: Participant[] = []

  // Seed each group with 2 readers
  lounge.push(shuffledReaders[0], shuffledReaders[1])
  table.push(shuffledReaders[2], shuffledReaders[3])

  const remainingReaders = shuffledReaders.slice(4)
  const remaining = shuffle([...remainingReaders, ...shuffledNonReaders])

  // Balance group sizes
  for (const p of remaining) {
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
      table: getPendingOrAlphabeticalNext(table),
      lounge: getPendingOrAlphabeticalNext(lounge),
    },
  }
}
