/**
 * Tests for Settings.tsx form submission
 */
import { describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { MemoryRouter } from 'react-router-dom'
import Settings from '../pages/Settings'

vi.mock('../contexts/AuthContext', () => ({
  useAuth: () => ({
    token: 'test-token',
    clientId: 'client-uuid-123',
    user: { id: 'client-uuid-123' },
    loading: false,
    signOut: vi.fn(),
  }),
}))

const mockSettings = {
  id: 'client-uuid-123',
  business_name: 'Test Plumbing Co',
  emergency_phone_number: '+15550000000',
  working_hours: { mon: '8am-6pm' },
  services_offered: ['plumbing'],
  service_area_description: 'Brooklyn, NY',
  google_review_link: null,
  vapi_assistant_id: null,
  twilio_phone_number: null,
  is_active: true,
  fsm_type: null,
  created_at: '2024-01-01T00:00:00Z',
  updated_at: '2024-01-01T00:00:00Z',
}

const mockGetSettings = vi.fn().mockResolvedValue(mockSettings)
const mockUpdateSettings = vi.fn().mockResolvedValue(mockSettings)

vi.mock('../lib/api', () => ({
  getSettings: (...args: unknown[]) => mockGetSettings(...args),
  updateSettings: (...args: unknown[]) => mockUpdateSettings(...args),
}))

function renderSettings() {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  return render(
    <QueryClientProvider client={qc}>
      <MemoryRouter>
        <Settings />
      </MemoryRouter>
    </QueryClientProvider>,
  )
}

describe('Settings page', () => {
  it('renders the settings form', async () => {
    renderSettings()
    expect(await screen.findByTestId('settings-form')).toBeInTheDocument()
  })

  it('pre-fills business name from loaded settings', async () => {
    renderSettings()
    const input = (await screen.findByTestId('input-business-name')) as HTMLInputElement
    expect(input.value).toBe('Test Plumbing Co')
  })

  it('calls updateSettings on save', async () => {
    renderSettings()
    await screen.findByTestId('input-business-name')

    fireEvent.change(screen.getByTestId('input-business-name'), {
      target: { value: 'Updated Plumbing Co' },
    })
    fireEvent.click(screen.getByTestId('settings-save-button'))

    await waitFor(() => {
      expect(mockUpdateSettings).toHaveBeenCalledWith(
        'test-token',
        'client-uuid-123',
        expect.objectContaining({ business_name: 'Updated Plumbing Co' }),
      )
    })
  })

  it('shows success message after save', async () => {
    renderSettings()
    await screen.findByTestId('input-business-name')
    fireEvent.click(screen.getByTestId('settings-save-button'))

    await waitFor(() => {
      expect(screen.getByTestId('save-success')).toBeInTheDocument()
    })
  })
})
