/**
 * Tests for CallLogs.tsx filters
 */
import { describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { MemoryRouter } from 'react-router-dom'
import CallLogs from '../pages/CallLogs'
import type { CallLog } from '../lib/api'

vi.mock('../contexts/AuthContext', () => ({
  useAuth: () => ({
    token: 'test-token',
    clientId: 'client-uuid-123',
    user: { id: 'client-uuid-123' },
    loading: false,
    signOut: vi.fn(),
  }),
}))

const mockCalls: CallLog[] = [
  {
    id: '1', call_id: 'c1', caller_number: '+15550001', started_at: '2024-03-10T10:00:00Z',
    ended_at: null, was_emergency: true, was_booked: false, summary: 'burst pipe',
    transcript: [], status: 'completed', duration_seconds: 120, recording_url: null,
  },
  {
    id: '2', call_id: 'c2', caller_number: '+15550002', started_at: '2024-03-10T11:00:00Z',
    ended_at: null, was_emergency: false, was_booked: true, summary: 'booking confirmed',
    transcript: [], status: 'completed', duration_seconds: 90, recording_url: null,
  },
]

const mockGetCalls = vi.fn().mockResolvedValue({ calls: mockCalls, offset: 0, limit: 200, count: 2 })
vi.mock('../lib/api', () => ({
  getCalls: (...args: unknown[]) => mockGetCalls(...args),
}))

function renderCallLogs() {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  return render(
    <QueryClientProvider client={qc}>
      <MemoryRouter>
        <CallLogs />
      </MemoryRouter>
    </QueryClientProvider>,
  )
}

describe('CallLogs page', () => {
  it('renders without crashing', async () => {
    renderCallLogs()
    expect(await screen.findByTestId('call-search')).toBeInTheDocument()
  })

  it('shows emergency filter checkbox', async () => {
    renderCallLogs()
    expect(await screen.findByTestId('filter-emergency')).toBeInTheDocument()
  })

  it('shows booked filter checkbox', async () => {
    renderCallLogs()
    expect(await screen.findByTestId('filter-booked')).toBeInTheDocument()
  })

  it('text search filters by caller number', async () => {
    renderCallLogs()
    // Wait for rows to load
    await screen.findAllByTestId('call-row')

    const search = screen.getByTestId('call-search')
    fireEvent.change(search, { target: { value: '5550001' } })

    await waitFor(() => {
      const rows = screen.getAllByTestId('call-row')
      expect(rows.length).toBe(1)
    })
  })

  it('text search filters by summary text', async () => {
    renderCallLogs()
    await screen.findAllByTestId('call-row')

    fireEvent.change(screen.getByTestId('call-search'), {
      target: { value: 'booking' },
    })

    await waitFor(() => {
      expect(screen.getAllByTestId('call-row').length).toBe(1)
    })
  })

  it('checking emergency filter passes emergency_only param to API', async () => {
    renderCallLogs()
    const checkbox = await screen.findByTestId('filter-emergency')
    fireEvent.click(checkbox)

    await waitFor(() => {
      const allCalls = mockGetCalls.mock.calls
      const lastCall = allCalls[allCalls.length - 1]
      expect(lastCall?.[2]).toMatchObject({ emergency_only: true })
    })
  })
})
