/**
 * Tests for ProtectedRoute.tsx
 */
import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import { MemoryRouter, Routes, Route } from 'react-router-dom'
import ProtectedRoute from '../components/ProtectedRoute'

// ── Helpers ──────────────────────────────────────────────────────────────────
function renderWithAuth(user: unknown, loading = false) {
  vi.doMock('../contexts/AuthContext', () => ({
    useAuth: () => ({ user, loading, token: null, clientId: null, signOut: vi.fn() }),
  }))

  return render(
    <MemoryRouter initialEntries={['/protected']}>
      <Routes>
        <Route path="/login" element={<div data-testid="login-page">Login</div>} />
        <Route
          path="/protected"
          element={
            <ProtectedRoute>
              <div data-testid="protected-content">Protected</div>
            </ProtectedRoute>
          }
        />
      </Routes>
    </MemoryRouter>,
  )
}

// Inline mock because vi.doMock requires reimport — use module-level mock instead:
vi.mock('../contexts/AuthContext', () => ({
  useAuth: vi.fn(),
}))
vi.mock('../lib/supabase', () => ({
  supabase: {
    auth: {
      getSession: vi.fn().mockResolvedValue({ data: { session: null } }),
      onAuthStateChange: vi.fn().mockReturnValue({ data: { subscription: { unsubscribe: vi.fn() } } }),
    },
  },
}))

import { useAuth } from '../contexts/AuthContext'

describe('ProtectedRoute', () => {
  it('renders children when user is authenticated', () => {
    vi.mocked(useAuth).mockReturnValue({
      user: { id: 'user-123' } as never,
      clientId: 'user-123',
      token: 'tok',
      role: 'client',
      loading: false,
      signOut: vi.fn(),
    })

    render(
      <MemoryRouter>
        <ProtectedRoute>
          <div data-testid="protected-content">Protected</div>
        </ProtectedRoute>
      </MemoryRouter>,
    )

    expect(screen.getByTestId('protected-content')).toBeInTheDocument()
  })

  it('redirects to /login when no user', () => {
    vi.mocked(useAuth).mockReturnValue({
      user: null,
      clientId: null,
      token: null,
      role: null,
      loading: false,
      signOut: vi.fn(),
    })

    render(
      <MemoryRouter initialEntries={['/protected']}>
        <Routes>
          <Route path="/login" element={<div data-testid="login-page">Login</div>} />
          <Route
            path="/protected"
            element={
              <ProtectedRoute>
                <div data-testid="protected-content">Protected</div>
              </ProtectedRoute>
            }
          />
        </Routes>
      </MemoryRouter>,
    )

    expect(screen.getByTestId('login-page')).toBeInTheDocument()
    expect(screen.queryByTestId('protected-content')).not.toBeInTheDocument()
  })

  it('shows loading spinner while auth is resolving', () => {
    vi.mocked(useAuth).mockReturnValue({
      user: null,
      clientId: null,
      token: null,
      role: null,
      loading: true,
      signOut: vi.fn(),
    })

    render(
      <MemoryRouter>
        <ProtectedRoute>
          <div data-testid="protected-content">Protected</div>
        </ProtectedRoute>
      </MemoryRouter>,
    )

    expect(screen.getByRole('status')).toBeInTheDocument()
    expect(screen.queryByTestId('protected-content')).not.toBeInTheDocument()
  })
})
