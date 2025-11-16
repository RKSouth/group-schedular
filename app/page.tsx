'use client'

import { useEffect, useState } from 'react'
import { makeGroups } from '../lib/grouping'

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
  const groups = makeGroups(participants)


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
  <main className="min-h-screen bg-[url('/canadianFlags.jpg')] bg-cover bg-no-repeat bg-center">
    <h1 className='mt-0'></h1>

        <h1 className="absolute-bottom pt-10  text-gray-900 text-[5rem] bold flex items-center justify-center mb-4 mr-20text-xl mx-4">Do Write Scheduler</h1>

  

    <div className="flex flex-col sm:flex-row gap-4 items-stretch p-4 rounded-md -4"> 
      {/* LEFT COLUMN: form + full participant list */}
      <div className="flex-1  flex flex-col p-4 bg-gray-400 text-gray-50 rounded-md">
        <h2 className='font-bold text-black text-xl mb-2'>Participants</h2>

        {/* Simple form */}
        <div style={{ marginBottom: 12 }}>
          <div style={{ marginBottom: 8 }}>
            <input
              type="text"
              value={name}
              placeholder="Enter your name"
              onChange={e => setName(e.target.value)}
              className="ml-2 px-2 bg-white text-black rounded-md"
            />
             <button
            className="ml-2 px-2 bg-white text-black rounded-md"
            onClick={handleAdd}
            disabled={!name.trim()}
          >
            Add
          </button>
          </div>

          <label style={{ display: 'block', marginBottom: 8 }}>
            <input
              type="checkbox"
              checked={hasReading}
              onChange={e => setHasReading(e.target.checked)}
              className="ml-2 px-2 bg-white text-black rounded-md"
            />{' '}
            Pages
          </label>
        </div>
  <hr className="my-1" />
        <h3 className='font-semibold text-md mb-2'>All participants ({participants.length})</h3>
        {participants.length === 0 ? (
          <p>No one yet.</p>
        ) : (
          <ul>
            {participants.map(p => (
              <li key={p.id}>
                <strong>{p.name}</strong>{' '}
                {p.has_reading ? '(reader)' : ''}{' '}
                <label>
                  <input
                    type="checkbox"
                    checked={p.has_reading}
                    onChange={e =>
                      updateHasReading(p.id, e.target.checked)
                    }
                  />{' '}
                  has reading
                </label>{' '}
                <button onClick={() => deleteParticipant(p.id)}>
                  Delete
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>

      {/* RIGHT COLUMN: groups */}
      <div className="flex-1  flex flex-col p-4 bg-gray-400 text-gray-50 rounded-md">
        <h2 className='font-bold text-black text-xl mb-2'>Groups</h2>

        {groups.error && (
          <p className="text-red-500">{groups.error}</p>
        )}

        {/* Table group */}
        <div style={{ marginBottom: 12 }}>
          <h3 className='font-semibold text-md mb-2'>Table</h3>
          {groups.table.length === 0 ? (
            <p>No one at the table.</p>
          ) : (
            <ul className='ml-4'>
              {groups.table.map(p => (
                <li className="m-2"key={p.id}>
                  <strong>{p.name}</strong>{' '}
                  {p.has_reading ? '(reader)' : ''}{' '}
                  <label>
                    <input
                      type="checkbox"
                      checked={p.has_reading}
                      onChange={e =>
                        updateHasReading(p.id, e.target.checked)
                      }
                    />{' '}
                    has reading
                  </label>{' '}
                  <button className="ml-2  px-2 bg-white text-black rounded-md" onClick={() => deleteParticipant(p.id)}>
                    Delete
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>
          <hr className="my-4" />
        {/* Lounge group */}
        <div>
          <h3 className='font-semibold text-md mb-2'>Lounge</h3>
          {groups.lounge.length === 0 ? (
            <p>No one in the lounge.</p>
          ) : (
            <ul className='ml-4'>
              {groups.lounge.map(p => (
                <li  className="m-2" key={p.id}>
                  <strong>{p.name}</strong>{' '}
                  {p.has_reading ? '(reader)' : ''}{' '}
                  <label>
                    <input
                      type="checkbox"
                      checked={p.has_reading}
                      onChange={e =>
                        updateHasReading(p.id, e.target.checked)
                      }
                    />{' '}
                    has reading
                  </label>{' '}
                  <button className="ml-2 px-2 bg-white text-black rounded-md" onClick={() => deleteParticipant(p.id)}>
                    Delete
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>
    </div>
  </main>
)

}
