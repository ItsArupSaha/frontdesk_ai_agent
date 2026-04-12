import { useState, useMemo } from 'react'
import { useQuery } from '@tanstack/react-query'
import { getCalls } from '../lib/api'
import type { CallLog } from '../lib/api'
import { useAuth } from '../contexts/AuthContext'
import CallRow from '../components/CallRow'
import LoadingSpinner from '../components/LoadingSpinner'

function csvEscape(value: string | boolean | number | null | undefined): string {
  const str = String(value ?? '')
  return str.includes(',') || str.includes('"') || str.includes('\n')
    ? `"${str.replace(/"/g, '""')}"`
    : str
}

function downloadCsv(calls: CallLog[]) {
  const headers = [
    'Caller', 'Started At', 'Duration (s)', 'Emergency', 'Booked', 'Status', 'Summary',
  ]
  const rows = calls.map((c) => [
    csvEscape(c.caller_number),
    csvEscape(c.started_at),
    csvEscape(c.duration_seconds),
    csvEscape(c.was_emergency),
    csvEscape(c.was_booked),
    csvEscape(c.status),
    csvEscape(c.summary),
  ])
  const csv = [headers.join(','), ...rows.map((r) => r.join(','))].join('\n')
  const blob = new Blob([csv], { type: 'text/csv' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = 'call-logs.csv'
  a.click()
  URL.revokeObjectURL(url)
}

export default function CallLogs() {
  const { token, clientId } = useAuth()

  const [emergencyOnly, setEmergencyOnly] = useState(false)
  const [bookedOnly, setBookedOnly] = useState(false)
  const [startDate, setStartDate] = useState('')
  const [endDate, setEndDate] = useState('')
  const [search, setSearch] = useState('')

  const query = useQuery({
    queryKey: ['calls', clientId, emergencyOnly, bookedOnly, startDate, endDate],
    queryFn: () =>
      getCalls(token!, clientId!, {
        limit: 200,
        emergency_only: emergencyOnly,
        booked_only: bookedOnly,
        start: startDate || undefined,
        end: endDate || undefined,
      }),
    enabled: !!token && !!clientId,
  })

  const filteredCalls = useMemo(() => {
    const calls = query.data?.calls ?? []
    if (!search.trim()) return calls
    const q = search.toLowerCase()
    return calls.filter(
      (c) =>
        c.caller_number.includes(q) ||
        (c.summary ?? '').toLowerCase().includes(q),
    )
  }, [query.data, search])

  return (
    <div className="space-y-4 p-6">
      <div className="flex items-center justify-between">
        <h2 className="text-xl font-semibold text-gray-800">Call Logs</h2>
        <button
          onClick={() => downloadCsv(filteredCalls)}
          className="rounded-md border border-gray-200 bg-white px-3 py-1.5 text-sm text-gray-600 hover:bg-gray-50"
        >
          Export CSV
        </button>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap gap-3 rounded-lg border border-gray-200 bg-white p-4">
        <input
          type="text"
          placeholder="Search caller or summary…"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="min-w-48 flex-1 rounded-md border border-gray-200 px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500"
          data-testid="call-search"
        />
        <input
          type="datetime-local"
          value={startDate}
          onChange={(e) => setStartDate(e.target.value)}
          className="rounded-md border border-gray-200 px-3 py-1.5 text-sm"
          aria-label="Start date"
        />
        <input
          type="datetime-local"
          value={endDate}
          onChange={(e) => setEndDate(e.target.value)}
          className="rounded-md border border-gray-200 px-3 py-1.5 text-sm"
          aria-label="End date"
        />
        <label className="flex items-center gap-1.5 text-sm text-gray-600">
          <input
            type="checkbox"
            checked={emergencyOnly}
            onChange={(e) => setEmergencyOnly(e.target.checked)}
            data-testid="filter-emergency"
          />
          Emergencies only
        </label>
        <label className="flex items-center gap-1.5 text-sm text-gray-600">
          <input
            type="checkbox"
            checked={bookedOnly}
            onChange={(e) => setBookedOnly(e.target.checked)}
            data-testid="filter-booked"
          />
          Booked only
        </label>
      </div>

      {/* Table */}
      <div className="overflow-x-auto rounded-lg border border-gray-200 bg-white">
        {query.isLoading ? (
          <div className="flex justify-center py-10">
            <LoadingSpinner />
          </div>
        ) : query.isError ? (
          <p className="p-6 text-center text-sm text-red-500">
            Failed to load calls. Please refresh.
          </p>
        ) : (
          <table className="w-full">
            <thead>
              <tr className="border-b border-gray-100 text-left text-xs uppercase tracking-wide text-gray-400">
                <th className="px-4 py-2">Caller</th>
                <th className="px-4 py-2">Time</th>
                <th className="px-4 py-2">Duration</th>
                <th className="px-4 py-2">Status</th>
                <th className="px-4 py-2">Summary</th>
                <th className="px-4 py-2" />
              </tr>
            </thead>
            <tbody>
              {filteredCalls.length === 0 ? (
                <tr>
                  <td colSpan={6} className="py-8 text-center text-sm text-gray-400">
                    No calls match your filters.
                  </td>
                </tr>
              ) : (
                filteredCalls.map((call) => <CallRow key={call.id} call={call} />)
              )}
            </tbody>
          </table>
        )}
      </div>

      {!query.isLoading && (
        <p className="text-right text-xs text-gray-400">
          {filteredCalls.length} call{filteredCalls.length !== 1 ? 's' : ''} shown
        </p>
      )}
    </div>
  )
}
