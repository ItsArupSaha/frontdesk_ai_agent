import { NavLink, useNavigate } from 'react-router-dom'
import { useAuth } from '../contexts/AuthContext'

const links = [
  { to: '/dashboard',  label: 'Dashboard'  },
  { to: '/calls',      label: 'Call Logs'  },
  { to: '/bookings',   label: 'Bookings'   },
  { to: '/analytics',  label: 'Analytics'  },
  { to: '/settings',   label: 'Settings'   },
]

export default function Navbar() {
  const { signOut } = useAuth()
  const navigate = useNavigate()

  async function handleSignOut() {
    await signOut()
    navigate('/login', { replace: true })
  }

  return (
    <nav className="flex h-screen w-56 shrink-0 flex-col border-r border-gray-200 bg-white p-4">
      <div className="mb-8">
        <h1 className="text-lg font-bold text-brand-600">AI Front-Desk</h1>
        <p className="text-xs text-gray-400">Dashboard</p>
      </div>

      <ul className="flex-1 space-y-1">
        {links.map(({ to, label }) => (
          <li key={to}>
            <NavLink
              to={to}
              className={({ isActive }) =>
                `block rounded-md px-3 py-2 text-sm font-medium transition-colors ${
                  isActive
                    ? 'bg-brand-50 text-brand-700'
                    : 'text-gray-600 hover:bg-gray-100 hover:text-gray-900'
                }`
              }
            >
              {label}
            </NavLink>
          </li>
        ))}
      </ul>

      <button
        onClick={handleSignOut}
        className="mt-4 w-full rounded-md border border-gray-200 px-3 py-2 text-sm text-gray-500 hover:bg-gray-50"
      >
        Sign out
      </button>
    </nav>
  )
}
