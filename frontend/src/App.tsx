import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import { useAuth } from './contexts/AuthContext'
import Navbar from './components/Navbar'
import ProtectedRoute from './components/ProtectedRoute'
import LoadingSpinner from './components/LoadingSpinner'
import Login from './pages/Login'
import Dashboard from './pages/Dashboard'
import CallLogs from './pages/CallLogs'
import Bookings from './pages/Bookings'
import Analytics from './pages/Analytics'
import Settings from './pages/Settings'
import AdminPanel from './pages/AdminPanel'
import ClientOnboarding from './pages/ClientOnboarding'

// ---------------------------------------------------------------------------
// Layouts
// ---------------------------------------------------------------------------

function AppLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex h-screen overflow-hidden bg-gray-50">
      <Navbar />
      <main className="flex-1 overflow-y-auto">{children}</main>
    </div>
  )
}

/** Full-screen layout for admin pages (no sidebar — admin has its own nav). */
function AdminLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen bg-gray-50">
      <div className="border-b border-gray-200 bg-white px-6 py-3">
        <span className="text-sm font-bold text-blue-700">AI Front-Desk — Admin</span>
      </div>
      <main>{children}</main>
    </div>
  )
}

// ---------------------------------------------------------------------------
// AdminRoute guard — redirects non-admin to /dashboard
// ---------------------------------------------------------------------------

function AdminRoute({ children }: { children: React.ReactNode }) {
  const { user, role, loading } = useAuth()

  if (loading) {
    return (
      <div className="flex h-screen w-full items-center justify-center">
        <LoadingSpinner size="lg" />
      </div>
    )
  }

  if (!user) return <Navigate to="/login" replace />
  if (role !== 'admin') return <Navigate to="/dashboard" replace />

  return <>{children}</>
}

// ---------------------------------------------------------------------------
// RootRedirect — admins land on /admin, clients on /dashboard
// ---------------------------------------------------------------------------

function RootRedirect() {
  const { user, role, loading } = useAuth()

  if (loading) {
    return (
      <div className="flex h-screen w-full items-center justify-center">
        <LoadingSpinner size="lg" />
      </div>
    )
  }

  if (!user) return <Navigate to="/login" replace />
  return <Navigate to={role === 'admin' ? '/admin' : '/dashboard'} replace />
}

// ---------------------------------------------------------------------------
// App
// ---------------------------------------------------------------------------

export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        {/* Public */}
        <Route path="/login" element={<Login />} />

        {/* Protected — all wrapped in sidebar layout */}
        <Route
          path="/dashboard"
          element={
            <ProtectedRoute>
              <AppLayout>
                <Dashboard />
              </AppLayout>
            </ProtectedRoute>
          }
        />
        <Route
          path="/calls"
          element={
            <ProtectedRoute>
              <AppLayout>
                <CallLogs />
              </AppLayout>
            </ProtectedRoute>
          }
        />
        <Route
          path="/bookings"
          element={
            <ProtectedRoute>
              <AppLayout>
                <Bookings />
              </AppLayout>
            </ProtectedRoute>
          }
        />
        <Route
          path="/analytics"
          element={
            <ProtectedRoute>
              <AppLayout>
                <Analytics />
              </AppLayout>
            </ProtectedRoute>
          }
        />
        <Route
          path="/settings"
          element={
            <ProtectedRoute>
              <AppLayout>
                <Settings />
              </AppLayout>
            </ProtectedRoute>
          }
        />

        {/* Admin-only routes — require admin role */}
        <Route
          path="/admin"
          element={
            <AdminRoute>
              <AdminLayout>
                <AdminPanel />
              </AdminLayout>
            </AdminRoute>
          }
        />
        <Route
          path="/admin/onboarding"
          element={
            <AdminRoute>
              <AdminLayout>
                <ClientOnboarding />
              </AdminLayout>
            </AdminRoute>
          }
        />

        {/* Root redirect — admins land on /admin, clients on /dashboard */}
        <Route path="/" element={<RootRedirect />} />
        {/* Catch-all */}
        <Route path="*" element={<Navigate to="/dashboard" replace />} />
      </Routes>
    </BrowserRouter>
  )
}
