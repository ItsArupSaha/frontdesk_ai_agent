/**
 * Admin Panel — multi-client management dashboard.
 *
 * Role-gated: non-admin users are redirected to /dashboard.
 * Shows all clients with usage stats, suspend/reactivate toggle,
 * and impersonation (view their dashboard without re-logging in).
 */
import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../contexts/AuthContext'
import LoadingSpinner from '../components/LoadingSpinner'
import Dashboard from './Dashboard'
import {
  getAdminClients,
  updateClientStatus,
  impersonateClient,
  type AdminClientSummary,
  type ImpersonateResponse,
} from '../lib/api'

export default function AdminPanel() {
  const { role, token, loading: authLoading } = useAuth()
  const navigate = useNavigate()

  const [clients, setClients] = useState<AdminClientSummary[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [impersonation, setImpersonation] = useState<ImpersonateResponse | null>(null)
  const [statusUpdating, setStatusUpdating] = useState<string | null>(null)

  // Redirect non-admins immediately.
  useEffect(() => {
    if (!authLoading && role !== null && role !== 'admin') {
      navigate('/dashboard', { replace: true })
    }
  }, [role, authLoading, navigate])

  useEffect(() => {
    if (!token || role !== 'admin') return
    loadClients()
  }, [token, role])

  async function loadClients() {
    if (!token) return
    setLoading(true)
    setError(null)
    try {
      const data = await getAdminClients(token)
      setClients(data)
    } catch (err) {
      setError('Failed to load clients. Please try again.')
      console.error(err)
    } finally {
      setLoading(false)
    }
  }

  async function handleToggleStatus(client: AdminClientSummary) {
    if (!token) return
    setStatusUpdating(client.id)
    try {
      await updateClientStatus(token, client.id, !client.is_active)
      setClients(prev =>
        prev.map(c => c.id === client.id ? { ...c, is_active: !c.is_active } : c)
      )
    } catch (err) {
      console.error('Failed to update status:', err)
    } finally {
      setStatusUpdating(null)
    }
  }

  async function handleViewDashboard(client: AdminClientSummary) {
    if (!token) return
    try {
      const result = await impersonateClient(token, client.id)
      setImpersonation(result)
    } catch (err) {
      console.error('Impersonation failed:', err)
    }
  }

  if (authLoading || (role === null)) {
    return (
      <div className="flex h-screen items-center justify-center">
        <LoadingSpinner size="lg" />
      </div>
    )
  }

  // Impersonation view — show client dashboard with banner.
  if (impersonation) {
    return (
      <div className="flex h-screen flex-col">
        {/* Impersonation banner */}
        <div className="flex items-center justify-between bg-amber-500 px-6 py-2 text-white">
          <span className="text-sm font-semibold">
            Viewing: {impersonation.business_name}
            {!impersonation.is_active && (
              <span className="ml-2 rounded bg-red-600 px-2 py-0.5 text-xs">SUSPENDED</span>
            )}
          </span>
          <button
            onClick={() => setImpersonation(null)}
            className="rounded border border-white px-3 py-1 text-sm hover:bg-amber-600"
          >
            Exit — back to Admin Panel
          </button>
        </div>
        {/* Render the full Dashboard for that client */}
        <div className="flex-1 overflow-y-auto">
          <Dashboard overrideClientId={impersonation.client_id} />
        </div>
      </div>
    )
  }

  return (
    <div className="p-6">
      <div className="mb-6 flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Client Management</h1>
          <p className="mt-1 text-sm text-gray-500">
            Manage all clients from one place.
          </p>
        </div>
        <button
          onClick={() => navigate('/admin/onboarding')}
          className="rounded-md bg-blue-600 px-4 py-2 text-sm font-semibold text-white shadow-sm hover:bg-blue-700"
        >
          + Add New Client
        </button>
      </div>

      {error && (
        <div className="mb-4 rounded-md bg-red-50 p-4 text-sm text-red-700">
          {error}
          <button onClick={loadClients} className="ml-2 underline">
            Retry
          </button>
        </div>
      )}

      {loading ? (
        <div className="flex justify-center py-20">
          <LoadingSpinner size="lg" />
        </div>
      ) : clients.length === 0 ? (
        <div className="rounded-lg border-2 border-dashed border-gray-300 p-12 text-center">
          <p className="text-gray-500">No clients yet. Add your first client.</p>
          <button
            onClick={() => navigate('/admin/onboarding')}
            className="mt-4 rounded-md bg-blue-600 px-4 py-2 text-sm font-semibold text-white hover:bg-blue-700"
          >
            Add First Client
          </button>
        </div>
      ) : (
        <div className="overflow-x-auto rounded-lg border border-gray-200 bg-white shadow-sm">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-gray-200 bg-gray-50 text-left text-xs font-semibold uppercase tracking-wide text-gray-500">
                <th className="px-4 py-3">Business</th>
                <th className="px-4 py-3">Status</th>
                <th className="px-4 py-3">Calls / Mo</th>
                <th className="px-4 py-3">Last Call</th>
                <th className="px-4 py-3">Bookings / Mo</th>
                <th className="px-4 py-3">Est. Cost</th>
                <th className="px-4 py-3">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {clients.map(client => (
                <tr key={client.id} className="hover:bg-gray-50">
                  <td className="px-4 py-3">
                    <div className="font-medium text-gray-900">{client.business_name}</div>
                    <div className="text-xs text-gray-400">{client.email ?? '—'}</div>
                  </td>
                  <td className="px-4 py-3">
                    <span
                      className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-semibold ${
                        client.is_active
                          ? 'bg-green-100 text-green-800'
                          : 'bg-red-100 text-red-800'
                      }`}
                    >
                      {client.is_active ? 'Active' : 'Suspended'}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-gray-700">{client.calls_this_month}</td>
                  <td className="px-4 py-3 text-gray-500">
                    {client.last_call_at
                      ? new Date(client.last_call_at).toLocaleDateString()
                      : '—'}
                  </td>
                  <td className="px-4 py-3 text-gray-700">{client.bookings_this_month}</td>
                  <td className="px-4 py-3 font-medium text-gray-900">
                    ${client.monthly_cost_estimate.toFixed(2)}
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-2">
                      <button
                        onClick={() => handleViewDashboard(client)}
                        className="rounded bg-blue-50 px-2 py-1 text-xs font-medium text-blue-700 hover:bg-blue-100"
                      >
                        View Dashboard
                      </button>
                      <button
                        onClick={() => handleToggleStatus(client)}
                        disabled={statusUpdating === client.id}
                        className={`rounded px-2 py-1 text-xs font-medium ${
                          client.is_active
                            ? 'bg-red-50 text-red-700 hover:bg-red-100'
                            : 'bg-green-50 text-green-700 hover:bg-green-100'
                        } disabled:opacity-50`}
                      >
                        {statusUpdating === client.id
                          ? '...'
                          : client.is_active
                          ? 'Suspend'
                          : 'Reactivate'}
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}
