// lib/grouping.ts

export type AttendanceStatus = 'unknown' | 'yes' | 'no' | 'maybe'

// Weekly meaning:
// - unassigned: still in rotation (no answer yet)
// - pending: being asked this week (still in rotation)
// - confirmed: has pages this week
// - deferred: no pages this week (skip for scheduling this week)
export type ReadingStatus = 'unassigned' | 'pending' | 'confirmed' | 'deferred'

export type Participant = {
  id: number
  name: string
  email: string | null
  phone_number: string | null
  phoneNumber?: string | null

  has_reading: boolean // NOT used for reader selection

  attendance?: AttendanceStatus
  reading?: ReadingStatus
  responded_at?: string | null
}

export type GroupReaders = {
  scheduled: Participant[] // 4
  bonus: Participant[] // 2
}

export type RotationState = {
  tableStartIndex: number
  loungeStartIndex: number
}

export type ReaderRosters = {
  // Full ordered lists (alphabetical by first name) that the UI can slice however it wants
  table: Participant[]
  lounge: Participant[]

  // Where “this week” starts for each list
  startIndex: RotationState
}

export type GroupResult = {
  table: Participant[]
  lounge: Participant[]
  error?: string

  // Keep your existing readers output so the current UI won’t explode
  readers: {
    table: GroupReaders
    lounge: GroupReaders
  }

  // NEW: expose the full ordered rosters + start indices
  rosters: ReaderRosters

  // “Up next” (unchanged from your logic)
  upNext?: {
    table: Participant | null
    lounge: Participant | null
  }
}

const SCHEDULED_QUOTA = 4
const BONUS_QUOTA = 2
const READERS_PER_WEEK = SCHEDULED_QUOTA + BONUS_QUOTA

function shuffle<T>(arr: T[]): T[] {
  const copy = [...arr]
  for (let i = copy.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1))
    ;[copy[i], copy[j]] = [copy[j], copy[i]]
  }
  return copy
}

function getFirstName(name: string): string {
  const trimmed = (name ?? '').trim()
  if (!trimmed) return ''
  return trimmed.split(/\s+/)[0] ?? ''
}

function sortByFirstName(a: Participant, b: Participant): number {
  const aFirst = getFirstName(a.name).toLowerCase()
  const bFirst = getFirstName(b.name).toLowerCase()
  if (aFirst < bFirst) return -1
  if (aFirst > bFirst) return 1

  const aFull = (a.name ?? '').toLowerCase()
  const bFull = (b.name ?? '').toLowerCase()
  if (aFull < bFull) return -1
  if (aFull > bFull) return 1

  return a.id - b.id
}

function isAttending(p: Participant): boolean {
  // seated unless explicitly "no"
  return (p.attendance ?? 'unknown') !== 'no'
}

function readingStatus(p: Participant): ReadingStatus {
  const v = p.reading ?? 'unassigned'
  if (v === 'unassigned' || v === 'pending' || v === 'confirmed' || v === 'deferred') return v
  return 'unassigned'
}

function isSchedulableThisWeek(p: Participant): boolean {
  // readers must be attending, and not deferred
  if (!isAttending(p)) return false
  return readingStatus(p) !== 'deferred'
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

function splitScheduledBonus(picked: Participant[]): GroupReaders {
  return {
    scheduled: picked.slice(0, SCHEDULED_QUOTA),
    bonus: picked.slice(SCHEDULED_QUOTA, SCHEDULED_QUOTA + BONUS_QUOTA),
  }
}

/**
 * Up next:
 * 1) if someone is pending (and attending), return them
 * 2) else return first alphabetical schedulable person who is not confirmed
 */
function getUpNext(groupMembers: Participant[]): Participant | null {
  const attendingMembers = groupMembers.filter(isAttending)

  const pending = attendingMembers.find((p) => readingStatus(p) === 'pending')
  if (pending) return pending

  const next = attendingMembers
    .filter(isSchedulableThisWeek)
    .filter((p) => readingStatus(p) !== 'confirmed')
    .slice()
    .sort(sortByFirstName)[0]

  return next ?? null
}

/**
 * Builds the full reader roster list for a group (table or lounge):
 * - attending
 * - not deferred
 * - alphabetical by first name
 */
function buildReaderRoster(groupMembers: Participant[]): Participant[] {
  return groupMembers.filter(isSchedulableThisWeek).slice().sort(sortByFirstName)
}

/**
 * makeGroups:
 * - Seating: shuffle-based (unchanged behavior)
 * - Readers: expose full ordered rosters + also return "this week" readers (first 6 from startIndex)
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
      rosters: {
        table: [],
        lounge: [],
        startIndex: { tableStartIndex, loungeStartIndex },
      },
      upNext: { table: null, lounge: null },
    }
  }

  // <=8: everyone at the table (same as your current logic)
  if (total <= 8) {
    const table = shuffle(seated)
    const lounge: Participant[] = []

    const tableRoster = buildReaderRoster(table)
    const picked = takeWithWrap(tableRoster, tableStartIndex, READERS_PER_WEEK)

    return {
      table,
      lounge,
      readers: {
        table: splitScheduledBonus(picked),
        lounge: { scheduled: [], bonus: [] },
      },
      rosters: {
        table: tableRoster,
        lounge: [],
        startIndex: { tableStartIndex, loungeStartIndex },
      },
      upNext: {
        table: getUpNext(table),
        lounge: null,
      },
    }
  }

  // >8: shuffle then balance split (same as your current logic)
  const shuffled = shuffle(seated)
  const lounge: Participant[] = []
  const table: Participant[] = []

  for (const p of shuffled) {
    if (lounge.length <= table.length) lounge.push(p)
    else table.push(p)
  }

  const tableRoster = buildReaderRoster(table)
  const loungeRoster = buildReaderRoster(lounge)

  const tablePicked = takeWithWrap(tableRoster, tableStartIndex, READERS_PER_WEEK)
  const loungePicked = takeWithWrap(loungeRoster, loungeStartIndex, READERS_PER_WEEK)

  return {
    table,
    lounge,
    readers: {
      table: splitScheduledBonus(tablePicked),
      lounge: splitScheduledBonus(loungePicked),
    },
    rosters: {
      table: tableRoster,
      lounge: loungeRoster,
      startIndex: { tableStartIndex, loungeStartIndex },
    },
    upNext: {
      table: getUpNext(table),
      lounge: getUpNext(lounge),
    },
  }
}
