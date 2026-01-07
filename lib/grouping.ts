// lib/grouping.ts

export type Participant = {
  id: number
  name: string
  email: string | null
  phone_number: string | null

  // If you have both of these in your codebase, keep them;
  // but you should pick ONE eventually.
  phoneNumber?: string | null

  has_reading: boolean

  // Optional: if you add this later (recommended), algorithm will skip them
  deferred_this_week?: boolean
}

export type GroupReaders = {
  scheduled: Participant[]
  bonus: Participant[]
}

export type GroupResult = {
  table: Participant[]
  lounge: Participant[]
  error?: string

  // NEW: reading assignments per group (B: 4 scheduled + 2 bonus per group)
  readers: {
    table: GroupReaders
    lounge: GroupReaders
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
  // split on whitespace, take first token
  return trimmed.split(/\s+/)[0] ?? ''
}

function sortByFirstName(a: Participant, b: Participant): number {
  const aFirst = getFirstName(a.name).toLowerCase()
  const bFirst = getFirstName(b.name).toLowerCase()

  if (aFirst < bFirst) return -1
  if (aFirst > bFirst) return 1

  // tie-break: full name then id for stability
  const aFull = a.name.toLowerCase()
  const bFull = b.name.toLowerCase()
  if (aFull < bFull) return -1
  if (aFull > bFull) return 1

  return a.id - b.id
}

function assignReadersForGroup(
  groupMembers: Participant[],
  startIndex: number,
  scheduledQuota = 4,
  bonusQuota = 2
): { readers: GroupReaders; nextStartIndex: number } {
  // eligible readers in this group, alphabetical by first name
  const eligible = groupMembers
    .filter(participants => participants.has_reading)
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

  function takeNextNonDeferred(): Participant | null {
    // scan up to n items to find someone who isn't deferred and not already picked
    for (let scan = 0; scan < n; scan++) {
      const participants = eligible[i]
      i = (i + 1) % n

      if (picked.has(participants.id)) continue
      if (participants.deferred_this_week) continue

      picked.add(participants.id)
      return participants
    }
    return null
  }

  while (scheduled.length < scheduledQuota) {
    const participants = takeNextNonDeferred()
    if (!participants) break
    scheduled.push(participants)
  }

  while (bonus.length < bonusQuota) {
    const participants = takeNextNonDeferred()
    if (!participants) break
    bonus.push(participants)
  }

  // Next week start AFTER the last scheduled reader
  let nextStartIndex = startIndex
  const lastScheduled = scheduled[scheduled.length - 1]
  if (lastScheduled) {
    const lastIdx = eligible.findIndex(participants => participants.id === lastScheduled.id)
    nextStartIndex = lastIdx === -1 ? startIndex : (lastIdx + 1) % n
  }

  return { readers: { scheduled, bonus }, nextStartIndex }
}

/**
 * makeGroups:
 * - <=8: one group (table), lounge empty
 * - >8: random split into 2 groups, ensure at least 2 readers per group
 * - also assigns readers per group (4 scheduled + 2 bonus per group), using alphabetical rotation
 */
export function makeGroups(
  participants: Participant[],
  rotation?: RotationState
): GroupResult {
  const total = participants.length
  const tableStartIndex = rotation?.tableStartIndex ?? 0
  const loungeStartIndex = rotation?.loungeStartIndex ?? 0

  // <=10: everyone at the table, lounge empty
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
    }
  }

  // >10: split into 2 groups, ensure 2 readers each
  const readers = participants.filter(participants => participants.has_reading)
  const nonReaders = participants.filter(participants => !participants.has_reading)

  // Need at least 4 readers total to guarantee 2 per group
  if (readers.length < 4) {
    const table = shuffle(participants)

    const tableReaders = assignReadersForGroup(table, tableStartIndex, 4, 2)
    return {
      table,
      lounge: [],
      error: 'Not enough readers to have at least 2 in each group.',
      readers: {
        table: tableReaders.readers,
        lounge: { scheduled: [], bonus: [] },
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
  for (const participants of remaining) {
    if (lounge.length <= table.length) {
      lounge.push(participants)
    } else {
      table.push(participants)
    }
  }

  // Now assign readers within each group (B: 4 scheduled + 2 bonus per group)
  const tableReaders = assignReadersForGroup(table, tableStartIndex, 4, 2)
  const loungeReaders = assignReadersForGroup(lounge, loungeStartIndex, 4, 2)

  return {
    table,
    lounge,
    readers: {
      table: tableReaders.readers,
      lounge: loungeReaders.readers,
    },
  }
}
