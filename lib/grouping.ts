// lib/grouping.ts
export type Participant = {
  id: number
  name: string
  has_reading: boolean
}

export type GroupResult = {
  table: Participant[]
  lounge: Participant[]
  error?: string
}

function shuffle<T>(arr: T[]): T[] {
  const copy = [...arr]
  for (let i = copy.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1))
    ;[copy[i], copy[j]] = [copy[j], copy[i]]
  }
  return copy
}

export function makeGroups(participants: Participant[]): GroupResult {
  const total = participants.length

  if (total <= 10) {
    return {
      table: shuffle(participants),
      lounge: [],
    }
  }

  const readers = participants.filter(p => p.has_reading)
  const nonReaders = participants.filter(p => !p.has_reading)

  if (readers.length < 4) {
    return {
      table: shuffle(participants),
      lounge: [],
      error: 'Not enough readers to have at least 2 in each group.',
    }
  }

  const shuffledReaders = shuffle(readers)
  const shuffledNonReaders = shuffle(nonReaders)

  const lounge: Participant[] = []
  const table: Participant[] = []

  lounge.push(shuffledReaders[0], shuffledReaders[1])
  table.push(shuffledReaders[2], shuffledReaders[3])

  const remainingReaders = shuffledReaders.slice(4)
  const remaining = shuffle([...remainingReaders, ...shuffledNonReaders])

  for (const p of remaining) {
    if (lounge.length <= table.length) {
      lounge.push(p)
    } else {
      table.push(p)
    }
  }

  return { table, lounge }
}
