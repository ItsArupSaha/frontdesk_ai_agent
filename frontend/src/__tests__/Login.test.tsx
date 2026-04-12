/**
 * Tests for Login.tsx
 *
 * Supabase is mocked so no real network calls are made.
 * react-router-dom useNavigate is mocked to track redirects.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import Login from '../pages/Login'

// ── Mock Supabase ────────────────────────────────────────────────────────────
const mockSignIn = vi.fn()
const mockGetSession = vi.fn().mockResolvedValue({ data: { session: null } })

vi.mock('../lib/supabase', () => ({
  supabase: {
    auth: {
      signInWithPassword: (...args: unknown[]) => mockSignIn(...args),
      getSession: () => mockGetSession(),
    },
  },
}))

// ── Mock useNavigate ─────────────────────────────────────────────────────────
const mockNavigate = vi.fn()
vi.mock('react-router-dom', async (importOriginal) => {
  const actual = await importOriginal<typeof import('react-router-dom')>()
  return { ...actual, useNavigate: () => mockNavigate }
})

// ── Helpers ──────────────────────────────────────────────────────────────────
function renderLogin() {
  return render(
    <MemoryRouter>
      <Login />
    </MemoryRouter>,
  )
}

beforeEach(() => {
  vi.clearAllMocks()
  mockGetSession.mockResolvedValue({ data: { session: null } })
})

// ── Tests ────────────────────────────────────────────────────────────────────

describe('Login page', () => {
  it('renders without crashing', () => {
    renderLogin()
    expect(screen.getByTestId('login-form')).toBeInTheDocument()
    expect(screen.getByTestId('input-email')).toBeInTheDocument()
    expect(screen.getByTestId('input-password')).toBeInTheDocument()
    expect(screen.getByTestId('login-submit')).toBeInTheDocument()
  })

  it('redirects to /dashboard if already logged in', async () => {
    mockGetSession.mockResolvedValue({
      data: { session: { access_token: 'tok' } },
    })
    renderLogin()
    await waitFor(() => {
      expect(mockNavigate).toHaveBeenCalledWith('/dashboard', { replace: true })
    })
  })

  it('shows error on invalid credentials', async () => {
    mockSignIn.mockResolvedValue({ error: { message: 'Invalid login credentials' } })
    renderLogin()

    fireEvent.change(screen.getByTestId('input-email'), {
      target: { value: 'bad@example.com' },
    })
    fireEvent.change(screen.getByTestId('input-password'), {
      target: { value: 'wrongpass' },
    })
    fireEvent.click(screen.getByTestId('login-submit'))

    await waitFor(() => {
      expect(screen.getByTestId('login-error')).toBeInTheDocument()
    })
    expect(mockNavigate).not.toHaveBeenCalledWith('/dashboard', expect.anything())
  })

  it('redirects to /dashboard on successful login', async () => {
    mockSignIn.mockResolvedValue({ error: null })
    renderLogin()

    fireEvent.change(screen.getByTestId('input-email'), {
      target: { value: 'user@example.com' },
    })
    fireEvent.change(screen.getByTestId('input-password'), {
      target: { value: 'correct!' },
    })
    fireEvent.click(screen.getByTestId('login-submit'))

    await waitFor(() => {
      expect(mockNavigate).toHaveBeenCalledWith('/dashboard', { replace: true })
    })
  })
})
