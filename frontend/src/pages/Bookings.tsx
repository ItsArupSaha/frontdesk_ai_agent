import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { format, parseISO, isAfter, startOfDay } from 'date-fns'
import { getBookings, updateBookingStatus } from '../lib/api'
import type { Booking } from '../lib/api'
import { useAuth } from '../contexts/AuthContext'
import StatusBadge from '../components/StatusBadge'
import LoadingSpinner from '../components/LoadingSpinner'

// ---------------------------------------------------------------------------
// Detail panel
// ---------------------------------------------------------------------------

interface DetailPanelProps {
  booking: Booking
  token: string
  clientId: string
  onClose: () => void
}

function DetailPanel({ booking, token, clientId, onClose }: DetailPanelProps) {
  const qc = useQueryClient()
  const mutation = useMutation({
    mutationFn: () => updateBookingStatus(token, clientId, booking.id, 'completed'),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['bookings', clientId] })
      onClose()
    },
  })

  return (
    <div className="mt-4 rounded-lg border border-gray-200 bg-blue-50 p-5" data-testid="booking-detail">
      <div className="flex items-start justify-between">
        <h3 className="text-sm font-semibold text-gray-700">Booking Details</h3>
        <button onClick={onClose} className="text-gray-400 hover:text-gray-600 text-lg leading-none">
          ✕
        </button>
      </div>
      <dl className="mt-3 grid grid-cols-2 gap-3 text-sm">
        <Detail label="Caller" value={booking.caller_name} />
        <Detail label="Phone" value={booking.caller_phone} />
        <Detail label="Address" value={booking.caller_address} />
        <Detail
          label="Time"
          value={format(parseISO(booking.appointment_start), 'h:mm a')}
        />
        <Detail
          label="Problem"
          value={booking.problem_description}
          wide
        />
        <Detail label="Status" value={<StatusBadge status={booking.status} />} />
        <Detail label="SMS sent" value={booking.confirmation_sms_sent ? 'Yes' : 'No'} />
        <Detail label="FSM synced" value={booking.fsm_synced ? 'Yes' : 'No'} />
      </dl>

      {booking.status === 'confirmed' && (
        <button
          onClick={() => mutation.mutate()}
          disabled={mutation.isPending}
          className="mt-4 rounded-md bg-green-600 px-4 py-2 text-sm font-medium text-white hover:bg-green-700 disabled:opacity-50"
          data-testid="mark-completed-button"
        >
          {mutation.isPending ? 'Saving…' : 'Mark as Completed'}
        </button>
      )}
    </div>
  )
}

function Detail({
  label,
  value,
  wide = false,
}: {
  label: string
  value: React.ReactNode
  wide?: boolean
}) {
  return (
    <div className={wide ? 'col-span-2' : ''}>
      <dt className="text-xs font-medium uppercase tracking-wide text-gray-400">{label}</dt>
      <dd className="mt-0.5 text-gray-700">{value}</dd>
    </div>
  )
}

// ---------------------------------------------------------------------------
// Group bookings by date using date-fns
// ---------------------------------------------------------------------------

function groupByDate(bookings: Booking[]): Array<{ label: string; items: Booking[] }> {
  const map = new Map<string, Booking[]>()

  // Sort ascending by appointment_start.
  const sorted = [...bookings].sort(
    (a, b) =>
      parseISO(a.appointment_start).getTime() -
      parseISO(b.appointment_start).getTime(),
  )

  for (const b of sorted) {
    const label = format(parseISO(b.appointment_start), 'EEEE, MMMM d')
    if (!map.has(label)) map.set(label, [])
    map.get(label)!.push(b)
  }

  return Array.from(map.entries()).map(([label, items]) => ({ label, items }))
}

// ---------------------------------------------------------------------------
// Main page
// ---------------------------------------------------------------------------

export default function Bookings() {
  const { token, clientId } = useAuth()
  const [selected, setSelected] = useState<Booking | null>(null)

  const query = useQuery({
    queryKey: ['bookings', clientId],
    queryFn: () => getBookings(token!, clientId!),
    enabled: !!token && !!clientId,
  })

  if (!token || !clientId || query.isLoading) {
    return (
      <div className="flex h-full items-center justify-center">
        <LoadingSpinner size="lg" />
      </div>
    )
  }

  const allBookings = query.data?.bookings ?? []

  // Show upcoming only (appointment start >= today).
  const today = startOfDay(new Date())
  const upcoming = allBookings.filter((b) =>
    isAfter(parseISO(b.appointment_start), today) ||
    format(parseISO(b.appointment_start), 'yyyy-MM-dd') === format(today, 'yyyy-MM-dd'),
  )

  const groups = groupByDate(upcoming)

  return (
    <div className="space-y-6 p-6">
      <div className="flex items-center justify-between">
        <h2 className="text-xl font-semibold text-gray-800">Upcoming Bookings</h2>
        <span className="text-sm text-gray-400">
          {upcoming.length} appointment{upcoming.length !== 1 ? 's' : ''}
        </span>
      </div>

      {query.isError && (
        <p className="text-sm text-red-500">Failed to load bookings. Please refresh.</p>
      )}

      {groups.length === 0 && !query.isError && (
        <div className="rounded-lg border border-gray-200 bg-white py-12 text-center text-sm text-gray-400">
          No upcoming bookings.
        </div>
      )}

      {groups.map(({ label, items }) => (
        <div key={label}>
          {/* Date group header */}
          <h3 className="mb-2 text-xs font-semibold uppercase tracking-wide text-gray-500">
            {label}
          </h3>

          <div className="space-y-2">
            {items.map((b) => (
              <div key={b.id}>
                <button
                  className="w-full rounded-lg border border-gray-200 bg-white px-5 py-4 text-left hover:border-brand-300 hover:bg-brand-50 transition-colors"
                  onClick={() => setSelected(selected?.id === b.id ? null : b)}
                  data-testid="booking-row"
                >
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-4">
                      <span className="w-16 shrink-0 text-sm font-medium text-brand-600">
                        {format(parseISO(b.appointment_start), 'h:mm a')}
                      </span>
                      <div>
                        <p className="text-sm font-medium text-gray-800">{b.caller_name}</p>
                        <p className="text-xs text-gray-500">{b.caller_address}</p>
                      </div>
                    </div>
                    <div className="flex items-center gap-3">
                      <p className="max-w-48 truncate text-xs text-gray-500">
                        {b.problem_description}
                      </p>
                      <StatusBadge status={b.status} />
                    </div>
                  </div>
                </button>

                {selected?.id === b.id && (
                  <DetailPanel
                    booking={b}
                    token={token}
                    clientId={clientId}
                    onClose={() => setSelected(null)}
                  />
                )}
              </div>
            ))}
          </div>
        </div>
      ))}
    </div>
  )
}
