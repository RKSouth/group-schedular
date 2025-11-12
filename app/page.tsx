'use client'

import { useEffect, useState } from 'react'

type Participant = {
  id: number
  name: string
  has_reading: boolean
  created_at?: string
}

export default function Page() {
  const [participants, setParticipants] = useState<Participant[]>([])
  const [name, setName] = useState('')
  const [hasReading, setHasReading] = useState(false)
  const [isLoading, setIsLoading] = useState(false)

  // Load participants from API
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

  // Load once on mount
 // eslint-disable-next-line react-hooks/set-state-in-effect
  useEffect(() => {
    loadParticipants()
  }, [])

  // Called when user clicks the button
  async function handleAdd() {
    if (!name.trim()) return

    setIsLoading(true)
    try {
      const res = await fetch('/api/participants', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: name.trim(),
          hasReading,
        }),
      })

      if (!res.ok) {
        console.error('Failed to add participant')
        return
      }

      // Clear the form
      setName('')
      setHasReading(false)

      // Reload the list from the database
      await loadParticipants()
    } catch (err) {
      console.error('Error adding participant', err)
    } finally {
      setIsLoading(false)
    }
  }
async function deleteParticipant(id: number) {
  const res = await fetch(`/api/participants/${id}`, {
    method: 'DELETE',
  })

  if (!res.ok) {
    const text = await res.text()
    console.error('Failed to delete participant:', text)
    return
  }

  await loadParticipants()
}

async function updateHasReading(id: number, value: boolean) {
  const res = await fetch(`/api/participants/${id}`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ hasReading: value }),
  })

  if (!res.ok) {
    console.error('Failed to update participant')
    return
  }

  // Reload from DB
  await loadParticipants()
}

  return (
  <main className="p-6 max-w-xl mx-auto font-sans">
    <h1 className="text-2xl font-bold mb-4">Reading Group Sign-Up</h1>

    {/* INPUT SECTION */}
    <div className="flex flex-col sm:flex-row items-start sm:items-center gap-3 mb-8">
      <input
        type="text"
        value={name}
        placeholder="Enter your name"
        onChange={(e) => setName(e.target.value)}
        className="border border-gray-300 rounded-md px-4 py-2 w-full sm:w-auto"
      />

      <label className="inline-flex items-center gap-2">
        <input
          type="checkbox"
          checked={hasReading}
          onChange={(e) => setHasReading(e.target.checked)}
          className="h-4 w-4"
        />
        <span>Has something to read</span>
      </label>

      <button
        onClick={handleAdd}
        disabled={isLoading}
        className="
          bg-blue-600 hover:bg-blue-700 
          text-white font-semibold 
          px-5 py-2 rounded-md shadow 
          disabled:opacity-50 disabled:cursor-not-allowed
        "
      >
        {isLoading ? 'Adding…' : 'Add to list'}
      </button>
    </div>

    {/* LIST */}
    <h2 className="text-xl font-semibold mb-2">
      Current Participants ({participants.length})
    </h2>

  {participants.length === 0 ? (
  <p className="text-gray-500">No one signed up yet.</p>
) : (
  <ul className="space-y-2">
    {participants.map((p) => (
      <li
        key={p.id}
        className="flex items-center justify-between border border-gray-200 rounded-md px-4 py-2 bg-white shadow-sm"
      >
        <div className="flex flex-col">
          <span className="font-medium">{p.name}</span>
          <label className="inline-flex items-center gap-2 text-sm text-gray-700 mt-1">
            <input
              type="checkbox"
              checked={p.has_reading}
              onChange={(e) =>
                updateHasReading(p.id, e.target.checked)
              }
              className="h-4 w-4"
            />
            <span>Has something to read</span>
          </label>
        </div>

        <button
          onClick={() => deleteParticipant(p.id)}
          className="text-sm bg-red-500 hover:bg-red-600 text-white px-3 py-1 rounded-md"
        >
          Delete
        </button>
      </li>
    ))}
  </ul>
)}

  </main>
)

}
