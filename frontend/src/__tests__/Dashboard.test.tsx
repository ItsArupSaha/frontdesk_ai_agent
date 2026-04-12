/**
 * Tests for Dashboard.tsx
 *
 * AuthContext and React Query are mocked so we can render in isolation.
 */
import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { MemoryRouter } from 'react-router-dom'
import Dashboard from '../pages/Dashboard'

// ── Mock AuthContext ─────────────────────────────────────────────────────────
vi.mock('../contexts/AuthContext', () => ({
  useAuth: () => ({
    token: 'test-token',
    clientId: 'client-uuid-123',
    user: { id: 'client-uuid-123', email: 'test@example.com' },
    loading: false,
    signOut: vi.fn(),
  }),
}))

// ── Mock Supabase realtime ───────────────────────────────────────────────────
vi.mock('../lib/supabase', () => ({
  supabase: {
    auth: { getSession: vi.fn().mockResolvedValue({ data: { session: null } }) },
    removeChannel: vi.fn(),
  },
  subscribeToCallLogs: vi.fn().mockReturnValue({ unsubscribe: vi.fn() }),
}))

// ── Mock API ─────────────────────────────────────────────────────────────────
vi.mock('../lib/api', () => ({
  getOverview: vi.fn().mockResolvedValue({
    calls_today: 5,
    calls_this_week: 22,
    bookings_this_week: 4,
    booking_rate: 0.18,
    emergencies_this_week: 1,
    missed_calls_recovered: 2,
  }),
  getCalls: vi.fn().mockResolvedValue({ calls: [] }),
  getAnalytics: vi.fn().mockResolvedValue({
    calls_per_day: [],
    bookings_per_day: [],
    calls_by_hour: Array.from({ length: 24 }, (_, h) => ({ hour: h, count: 0 })),
    emergency_rate: 0.05,
    period_days: 30,
  }),
}))

function renderDashboard() {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  return render(
    <QueryClientProvider client={qc}>
      <MemoryRouter>
        <Dashboard />
      </MemoryRouter>
    </QueryClientProvider>,
  )
}

describe('Dashboard page', () => {
  it('renders metric cards', async () => {
    renderDashboard()
    // Cards are rendered after data loads; findAllByTestId waits for them.
    const cards = await screen.findAllByTestId('metric-card')
    expect(cards.length).toBeGreaterThanOrEqual(4)
  })

  it('shows "Missed Calls Recovered" card (not Emergencies)', async () => {
    renderDashboard()
    expect(await screen.findByText(/Missed Calls Recovered/i)).toBeInTheDocument()
  })

  it('shows "Calls Today" metric card', async () => {
    renderDashboard()
    expect(await screen.findByText(/Calls Today/i)).toBeInTheDocument()
  })

  it('shows Live badge', async () => {
    renderDashboard()
    expect(await screen.findByText('Live')).toBeInTheDocument()
  })
})
