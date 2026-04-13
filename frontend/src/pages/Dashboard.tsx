import { useEffect, useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import {
  LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
} from 'recharts'
import { subscribeToCallLogs } from '../lib/supabase'
import { supabase } from '../lib/supabase'
import { getOverview, getCalls, getAnalytics } from '../lib/api'
import type { OverviewMetrics, CallLog } from '../lib/api'
import { useAuth } from '../contexts/AuthContext'
import MetricCard from '../components/MetricCard'
import StatusBadge from '../components/StatusBadge'
import LoadingSpinner from '../components/LoadingSpinner'

interface Props {
  /** When set by admin impersonation, use this client_id instead of the auth user's own. */
  overrideClientId?: string
}

export default function Dashboard({ overrideClientId }: Props = {}) {
  const { token, clientId: authClientId } = useAuth()
  const clientId = overrideClientId ?? authClientId
  const [liveCallCount, setLiveCallCount] = useState<number | null>(null)

  const overviewQuery = useQuery<OverviewMetrics>({
    queryKey: ['overview', clientId],
    queryFn: () => getOverview(token!, clientId!),
    enabled: !!token && !!clientId,
    refetchInterval: 30_000,
  })

  const callsQuery = useQuery<{ calls: CallLog[] }>({
    queryKey: ['calls-recent', clientId],
    queryFn: () => getCalls(token!, clientId!, { limit: 10 }),
    enabled: !!token && !!clientId,
  })

  const analyticsQuery = useQuery({
    queryKey: ['analytics', clientId, '30d'],
    queryFn: () => getAnalytics(token!, clientId!, '30d'),
    enabled: !!token && !!clientId,
  })

  // Realtime: increment live counter when a new call arrives.
  useEffect(() => {
    if (!token || !clientId) return
    const channel = subscribeToCallLogs(clientId, () => {
      setLiveCallCount((prev) => (prev ?? overviewQuery.data?.calls_today ?? 0) + 1)
    })
    return () => {
      supabase.removeChannel(channel)
    }
  }, [token, clientId, overviewQuery.data?.calls_today])

  if (!token || !clientId || overviewQuery.isLoading) {
    return (
      <div className="flex h-full items-center justify-center">
        <LoadingSpinner size="lg" />
      </div>
    )
  }

  if (overviewQuery.isError) {
    return (
      <div className="p-6 text-red-600">Failed to load dashboard. Please refresh.</div>
    )
  }

  const metrics = overviewQuery.data!
  const callsToday = liveCallCount ?? metrics.calls_today

  return (
    <div className="space-y-6 p-6">
      <div className="flex items-center justify-between">
        <h2 className="text-xl font-semibold text-gray-800">Dashboard</h2>
        <span className="flex items-center gap-1.5 rounded-full bg-green-50 px-3 py-1 text-xs font-medium text-green-700">
          <span className="h-2 w-2 animate-pulse rounded-full bg-green-500" />
          Live
        </span>
      </div>

      {/* KPI cards */}
      <div className="grid grid-cols-2 gap-4 xl:grid-cols-4">
        <MetricCard label="Calls Today" value={callsToday} color="blue" />
        <MetricCard
          label="Bookings This Week"
          value={metrics.bookings_this_week}
          color="green"
        />
        <MetricCard
          label="Booking Rate"
          value={`${(metrics.booking_rate * 100).toFixed(1)}%`}
          color="yellow"
        />
        <MetricCard
          label="Missed Calls Recovered"
          value={metrics.missed_calls_recovered}
          color={metrics.missed_calls_recovered > 0 ? 'green' : 'gray'}
          subtext="This week"
        />
      </div>

      {/* Line chart — calls per day */}
      {analyticsQuery.data && (
        <div className="rounded-lg border border-gray-200 bg-white p-5">
          <h3 className="mb-4 text-sm font-semibold text-gray-700">
            Calls per day — last 30 days
          </h3>
          <ResponsiveContainer width="100%" height={220}>
            <LineChart data={analyticsQuery.data.calls_per_day}>
              <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
              <XAxis
                dataKey="date"
                tick={{ fontSize: 11 }}
                tickFormatter={(d: string) => d.slice(5)}
              />
              <YAxis allowDecimals={false} tick={{ fontSize: 11 }} />
              <Tooltip />
              <Line
                type="monotone"
                dataKey="count"
                stroke="#3b82f6"
                strokeWidth={2}
                dot={false}
              />
            </LineChart>
          </ResponsiveContainer>
        </div>
      )}

      {/* Recent calls table */}
      <div className="rounded-lg border border-gray-200 bg-white">
        <div className="border-b border-gray-200 px-5 py-3">
          <h3 className="text-sm font-semibold text-gray-700">Recent Calls</h3>
        </div>
        {callsQuery.isLoading ? (
          <div className="flex justify-center py-8">
            <LoadingSpinner />
          </div>
        ) : (
          <table className="w-full">
            <thead>
              <tr className="border-b border-gray-100 text-left text-xs uppercase tracking-wide text-gray-400">
                <th className="px-4 py-2">Caller</th>
                <th className="px-4 py-2">Time</th>
                <th className="px-4 py-2">Status</th>
                <th className="px-4 py-2">Summary</th>
              </tr>
            </thead>
            <tbody>
              {(callsQuery.data?.calls ?? []).map((call) => (
                <tr key={call.id} className="border-b border-gray-50 text-sm">
                  <td className="px-4 py-3 text-gray-700">{call.caller_number}</td>
                  <td className="px-4 py-3 text-gray-500">
                    {new Date(call.started_at).toLocaleString()}
                  </td>
                  <td className="px-4 py-3">
                    {call.was_emergency ? (
                      <StatusBadge status="emergency" label="Emergency" />
                    ) : call.was_booked ? (
                      <StatusBadge status="booked" label="Booked" />
                    ) : (
                      <StatusBadge status={call.status} />
                    )}
                  </td>
                  <td className="max-w-xs truncate px-4 py-3 text-gray-500">
                    {call.summary ?? '—'}
                  </td>
                </tr>
              ))}
              {(callsQuery.data?.calls ?? []).length === 0 && (
                <tr>
                  <td colSpan={4} className="px-4 py-6 text-center text-sm text-gray-400">
                    No calls yet.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        )}
      </div>
    </div>
  )
}
