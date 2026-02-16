import { basicButton } from '../components/buttonStyles'

type AttendanceStatus = 'unknown' | 'yes' | 'no' | 'maybe'
type ReadingStatus = 'unassigned' | 'pending' | 'confirmed' | 'deferred'

type PersonLike = {
  id: number
  email: string | null
  phone_number: string | null
}

export function ParticipantDetails({
  person,
  onPatch,
  showAttendance = true,
  showReading = true,
  formatPhone,
}: {
  person: PersonLike
  onPatch: (id: number, patch: { attendance?: AttendanceStatus; reading?: ReadingStatus }) => void
  showAttendance?: boolean
  showReading?: boolean
  formatPhone: (p: string | null | undefined) => string
}) {
  return (
    <div className="mt-2 rounded-md border bg-gray-50 p-3">
      <div className="text-[1rem] text-black">Email: {person.email ?? '—'}</div>
      <div className="text-[1rem] text-black">Cell: {formatPhone(person.phone_number)}</div>

      {(showAttendance || showReading) && <hr className="my-2 border-black/20" />}

      {showAttendance && (
        <div>
          <label className="text-[1rem] text-black">Attending</label>
          <button className={basicButton} onClick={() => onPatch(person.id, { attendance: 'yes' })}>
            yes
          </button>
          <button
            className={basicButton}
            onClick={() => onPatch(person.id, { attendance: 'maybe' })}
          >
            maybe
          </button>
          <button className={basicButton} onClick={() => onPatch(person.id, { attendance: 'no' })}>
            no
          </button>
        </div>
      )}

      {showReading && (
        <div>
          <label className="text-[1rem] text-black">Reading</label>
          <button
            className={basicButton}
            onClick={() => onPatch(person.id, { reading: 'pending' })}
          >
            Set pending
          </button>
          <button
            className={basicButton}
            onClick={() => onPatch(person.id, { reading: 'confirmed' })}
          >
            Confirm
          </button>
          <button
            className={basicButton}
            onClick={() => onPatch(person.id, { reading: 'deferred' })}
          >
            Defer
          </button>
        </div>
      )}
    </div>
  )
}
