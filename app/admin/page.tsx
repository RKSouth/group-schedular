'use client'

import { useEffect, useState } from 'react'
import { makeGroups } from '../../lib/grouping'

type Participant = {
  phone_number: string
  phoneNumber: string
  email: string
  id: number
  name: string
  has_reading: boolean
  created_at?: string
}

export default function Page() {
  const [participants, setParticipants] = useState<Participant[]>([])
  const [name, setName] = useState('')
  const [email, setEmail] = useState('')
  const [phoneNumber, setPhoneNumber] = useState('')
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
    if (!email.trim()) return
    if (!phoneNumber.trim()) return

    setIsLoading(true)
    try {
      const res = await fetch('/api/participants', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: name.trim(),
          email: email.trim(),
          phoneNumber: phoneNumber.trim(),
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
      <a href="/admin/logout" className="fixed top-4 right-4 rounded border bg-white/80 px-3 py-1">
        Logout
      </a>
    <h1 className="absolute-bottom pt-10 text-gray-900 text-[3rem] bold flex items-center justify-center mb-4 mr-20text-xl mx-4">Administrator Page</h1>

    <div className="flex flex-col sm:flex-row gap-4 items-stretch p-4 rounded-md -4"> 
      <div className="flex-1  flex flex-col p-4 bg-gray-400 text-gray-50 rounded-md">
         <h2 className='font-bold text-black text-xl mb-2'>Folks</h2>
        <h4>Instructions: Here is where you can add, update or delete participants.</h4>
        <div style={{ marginBottom: 12 }}>
          <div className="mb-2">
          <div className="mb-2">
            <label htmlFor="name" className="font-medium text-black">Name:</label>
            <input
              type="text"
              value={name}
              placeholder="Enter your name"
              onChange={e => setName(e.target.value)}
              className="ml-2 px-2 bg-white text-black rounded-md"
            />
          </div>
          <div className="mb-2">
            <label htmlFor="email" className="font-medium text-black">Email:</label>
            <input
              type="text"
              value={email}
              placeholder="Enter your name"
              onChange={e => setEmail(e.target.value)}
              className="ml-2 px-2 bg-white text-black rounded-md"
            />
          </div>
          <div className="mb-2">
            <label htmlFor="phoneNumber" className="font-medium text-black">Cell:</label>
            <input
              type="text"
              value={phoneNumber}
              placeholder="1234567890"
              onChange={e => setPhoneNumber(e.target.value)}
              className="ml-2 px-2 bg-white text-black rounded-md"
            />
          </div>
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
          <button
            className="ml-2 px-2 bg-white text-black rounded-md"
            onClick={handleAdd}
            disabled={!name.trim()}
            >Add
          </button>
        </div>
  <hr className="my-1" />
        <h3 className='font-semibold text-lg mb-2'>All participants ({participants.length})</h3>
       {participants.length === 0 ? (
  <p>No one yet.</p>
) : (
  <ul className="flex flex-col gap-2">
    {participants.map(p => (
      <li
        key={p.id}
        className="flex items-center gap-4 rounded-md p-3 text-sm"
      >
        <span className="font-semibold">
          {p.name}
        </span>

        <span>
          {p.has_reading ? '(reader)' : 'not reading'}
        </span>

        <label className="flex items-center gap-2">
          <input
            type="checkbox"
            checked={p.has_reading}
            onChange={e => updateHasReading(p.id, e.target.checked)}
          />
          pages
        </label>

        <span className="text-gray-700">
          {p.email ?? '—'}
        </span>

        <span className="text-gray-700">
          {p.phone_number ?? '—'}
        </span>

        <button
          className="ml-auto rounded-md bg-white px-2 py-1 text-black"
          onClick={() => deleteParticipant(p.id)}
        >
          Delete
        </button>
      </li>
    ))}
  </ul>
)}

      </div>
    </div>
    <div className="flex flex-col sm:flex-row gap-4 items-stretch p-4 rounded-md -4">
      <div className="flex-1 flex flex-col p-4 bg-white/80 rounded-md">
  <h2 className="text-xl font-bold mb-3">Reader Schedule</h2>

  {/* ERROR */}
  {groups.error && (
    <p className="text-red-600 mb-3">{groups.error}</p>
  )}

  {/* TABLE */}
  <div className="mb-4">
    <h3 className="text-lg font-semibold">Table</h3>

    <div className="mt-2">
      <div className="font-medium">Scheduled</div>
      {groups.readers.table.scheduled.length === 0 ? (
        <div className="text-sm text-gray-600">No scheduled readers.</div>
      ) : (
        <ul className="list-disc ml-5">
          {groups.readers.table.scheduled.map(participants => (
            <li key={participants.id}>
              {participants.name}
            </li>
          ))}
        </ul>
      )}
    </div>

    <div className="mt-2">
      <div className="font-medium">Bonus</div>
      {groups.readers.table.bonus.length === 0 ? (
        <div className="text-sm text-gray-600">No bonus readers.</div>
      ) : (
        <ul className="list-disc ml-5">
          {groups.readers.table.bonus.map(participants => (
            <li key={participants.id}>
              {participants.name}
            </li>
          ))}
        </ul>
      )}
    </div>
  </div>

  {/* LOUNGE */}
  <div>
    <h3 className="text-lg font-semibold">Lounge</h3>

    <div className="mt-2">
      <div className="font-medium">Scheduled</div>
      {groups.readers.lounge.scheduled.length === 0 ? (
        <div className="text-sm text-gray-600">No scheduled readers.</div>
      ) : (
        <ul className="list-disc ml-5">
          {groups.readers.lounge.scheduled.map(participants => (
            <li key={participants.id}>
              {participants.name}
            </li>
          ))}
        </ul>
      )}
    </div>

    <div className="mt-2">
      <div className="font-medium">Bonus</div>
      {groups.readers.lounge.bonus.length === 0 ? (
        <div className="text-sm text-gray-600">No bonus readers.</div>
      ) : (
        <ul className="list-disc ml-5">
          {groups.readers.lounge.bonus.map(participants => (
            <li key={participants.id}>
              {participants.name}
            </li>
          ))}
        </ul>
      )}
    </div>
  </div>
</div>

    </div>
  </main>
)
}