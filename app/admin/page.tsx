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
  const [email, setEmail] = useState('')
  const [phoneNumber, setPhoneNumber] = useState('')
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
                <button 
                  className="ml-2 px-2 bg-white text-black rounded-md"
                  onClick={() => deleteParticipant(p.id)}>
                  Delete
                </button>
                  <button 
                  className="ml-2 px-2 bg-white text-black rounded-md"
                  onClick={() => deleteParticipant(p.id)}>
                  Update
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  </main>
)

}
