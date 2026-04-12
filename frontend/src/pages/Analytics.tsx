import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import {
  LineChart, Line, BarChart, Bar,
  XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
} from 'recharts'
import { getAnalytics } from '../lib/api'
import { useAuth } from '../contexts/AuthContext'
import LoadingSpinner from '../components/LoadingSpinner'

const PERIODS = ['7d', '30d', '90d'] as const
type Period = (typeof PERIODS)[number]

export default function Analytics() {
  const { token, clientId } = useAuth()
  const [period, setPeriod] = useState<Period>('30d')

  const query = useQuery({
    queryKey: ['analytics', clientId, period],
    queryFn: () => getAnalytics(token!, clientId!, period),
    enabled: !!token && !!clientId,
  })

  const data = query.data

  // Emergency rate color: green <10%, amber 10-20%, red >20%
  function emergencyColor(rate: number): string {
    if (rate > 0.2) return 'text-red-600'
    if (rate > 0.1) return 'text-amber-600'
    return 'text-green-600'
  }

  return (
    <div className="space-y-6 p-6">
      <div className="flex items-center justify-between">
        <h2 className="text-xl font-semibold text-gray-800">Analytics</h2>
        <div className="flex gap-1 rounded-lg border border-gray-200 bg-white p-1">
          {PERIODS.map((p) => (
            <button
              key={p}
              onClick={() => setPeriod(p)}
              className={`rounded-md px-3 py-1 text-sm transition-colors ${
                period === p ? 'bg-brand-500 text-white' : 'text-gray-600 hover:bg-gray-50'
              }`}
            >
              {p}
            </button>
          ))}
        </div>
      </div>

      {query.isLoading ? (
        <div className="flex justify-center py-16">
          <LoadingSpinner size="lg" />
        </div>
      ) : query.isError ? (
        <p className="text-center text-sm text-red-500">Failed to load analytics.</p>
      ) : data ? (
        <>
          {/* Emergency rate */}
          <div className="flex items-center gap-4 rounded-lg border border-gray-200 bg-white p-5">
            <div>
              <p className="text-sm font-medium text-gray-500">Emergency Rate</p>
              <p className={`mt-1 text-4xl font-bold ${emergencyColor(data.emergency_rate)}`}>
                {(data.emergency_rate * 100).toFixed(1)}%
              </p>
              <p className="mt-1 text-xs text-gray-400">
                {data.emergency_rate > 0.2
                  ? 'High — review call routing'
                  : data.emergency_rate > 0.1
                  ? 'Elevated — monitor closely'
                  : 'Healthy — below 10%'}
              </p>
            </div>
          </div>

          {/* Calls per day */}
          <div className="rounded-lg border border-gray-200 bg-white p-5">
            <h3 className="mb-4 text-sm font-semibold text-gray-700">Calls per Day</h3>
            <ResponsiveContainer width="100%" height={220}>
              <LineChart data={data.calls_per_day}>
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
                  name="Calls"
                  stroke="#3b82f6"
                  strokeWidth={2}
                  dot={false}
                />
              </LineChart>
            </ResponsiveContainer>
          </div>

          {/* Bookings per day */}
          <div className="rounded-lg border border-gray-200 bg-white p-5">
            <h3 className="mb-4 text-sm font-semibold text-gray-700">Bookings per Day</h3>
            <ResponsiveContainer width="100%" height={220}>
              <LineChart data={data.bookings_per_day}>
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
                  name="Bookings"
                  stroke="#22c55e"
                  strokeWidth={2}
                  dot={false}
                />
              </LineChart>
            </ResponsiveContainer>
          </div>

          {/* Calls by hour */}
          <div className="rounded-lg border border-gray-200 bg-white p-5">
            <h3 className="mb-4 text-sm font-semibold text-gray-700">
              Calls by Hour of Day
            </h3>
            <ResponsiveContainer width="100%" height={220}>
              <BarChart data={data.calls_by_hour}>
                <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                <XAxis dataKey="hour" tick={{ fontSize: 11 }} />
                <YAxis allowDecimals={false} tick={{ fontSize: 11 }} />
                <Tooltip />
                <Bar dataKey="count" name="Calls" fill="#3b82f6" radius={[3, 3, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </>
      ) : null}
    </div>
  )
}
