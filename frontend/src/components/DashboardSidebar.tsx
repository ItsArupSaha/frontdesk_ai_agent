import {
  BarChart3,
  CalendarRange,
  LayoutDashboard,
  LogOut,
  Menu,
  MessageSquare,
  Phone,
  Settings,
  Sparkles,
  BookOpen,
  X,
} from "lucide-react";
import { useState } from "react";
import { NavLink, useNavigate } from "react-router-dom";
import { useAuth } from "../contexts/AuthContext";

const links = [
  { to: "/dashboard", label: "Dashboard", icon: LayoutDashboard },
  { to: "/calls", label: "Call Logs", icon: Phone },
  { to: "/bookings", label: "Bookings", icon: CalendarRange },
  { to: "/analytics", label: "Analytics", icon: BarChart3 },
  { to: "/settings", label: "Settings", icon: Settings },
  { to: "/setup-guide", label: "Setup Guide", icon: BookOpen },
];

function SidebarContent({ onClose }: { onClose?: () => void }) {
  const { signOut } = useAuth();
  const navigate = useNavigate();

  async function handleSignOut() {
    await signOut();
    navigate("/login", { replace: true });
  }

  return (
    <div className="relative flex min-h-full flex-col px-6 py-7">
      <div className="mb-8 flex items-start justify-between">
        <div>
          <div className="flex h-12 w-12 items-center justify-center rounded-2xl border border-violet-300/20 bg-violet-500/12 text-violet-100">
            <Sparkles className="h-5 w-5" />
          </div>
          <h1 className="mt-5 text-[1.85rem] font-semibold tracking-[-0.05em] text-white">
            FrondexAI
          </h1>
          <p className="mt-1 text-xs uppercase tracking-[0.3em] text-white/40">Client Portal</p>
        </div>
        {onClose && (
          <button onClick={onClose} className="mt-1 text-white/50 hover:text-white lg:hidden">
            <X className="h-5 w-5" />
          </button>
        )}
      </div>

      <nav className="flex-1 space-y-2.5">
        {links.map(({ to, label, icon: Icon }) => (
          <NavLink
            key={to}
            to={to}
            onClick={onClose}
            className={({ isActive }) =>
              `group flex items-center gap-2.5 rounded-[22px] border px-4 py-3 text-sm font-medium transition-all ${
                isActive
                  ? "border-violet-300/30 bg-[linear-gradient(135deg,rgba(139,92,246,0.24),rgba(79,70,229,0.14))] text-white shadow-[0_0_0_1px_rgba(139,92,246,0.08),0_18px_44px_rgba(67,56,202,0.18)]"
                  : "border-transparent bg-white/[0.02] text-white/62 hover:border-white/10 hover:bg-white/[0.06] hover:text-white"
              }`
            }
          >
            <span className="flex h-8 w-8 items-center justify-center rounded-xl border border-white/8 bg-black/10 transition-colors group-hover:border-violet-300/20 group-hover:bg-violet-500/10">
              <Icon className="h-4 w-4" />
            </span>
            <span>{label}</span>
          </NavLink>
        ))}
      </nav>

      <div className="mt-6 space-y-3">
        <NavLink
          to="/feedback"
          onClick={onClose}
          className="flex items-center justify-center gap-2 rounded-[20px] border border-white/10 bg-white/[0.04] px-4 py-3 text-sm text-white/74 transition-colors hover:bg-white/[0.08] hover:text-white"
        >
          <MessageSquare className="h-4 w-4" />
          Feedback & Support
        </NavLink>
        <button
          onClick={() => void handleSignOut()}
          className="flex w-full items-center justify-center gap-2 rounded-[20px] border border-white/10 bg-white/[0.04] px-4 py-3 text-sm text-white/74 transition-colors hover:bg-white/[0.08] hover:text-white"
        >
          <LogOut className="h-4 w-4" />
          Sign out
        </button>
      </div>
    </div>
  );
}

export function DashboardSidebar() {
  const [open, setOpen] = useState(false);

  return (
    <>
      {/* Mobile top bar */}
      <div className="fixed inset-x-0 top-0 z-50 flex items-center justify-between border-b border-white/10 bg-[#07050d]/90 px-4 py-3 backdrop-blur-xl lg:hidden">
        <div className="flex items-center gap-2 text-white">
          <Sparkles className="h-4 w-4 text-violet-400" />
          <span className="text-sm font-semibold tracking-tight">FrondexAI</span>
        </div>
        <button
          onClick={() => setOpen(true)}
          className="rounded-xl border border-white/10 bg-white/[0.06] p-2 text-white/70 hover:text-white"
        >
          <Menu className="h-5 w-5" />
        </button>
      </div>

      {/* Mobile drawer overlay */}
      {open && (
        <div
          className="fixed inset-0 z-40 bg-black/60 backdrop-blur-sm lg:hidden"
          onClick={() => setOpen(false)}
        />
      )}

      {/* Mobile drawer */}
      <div
        className={`fixed inset-y-0 left-0 z-50 w-72 transform bg-[#0b0916] transition-transform duration-300 lg:hidden ${
          open ? "translate-x-0" : "-translate-x-full"
        }`}
      >
        <SidebarContent onClose={() => setOpen(false)} />
      </div>

      {/* Desktop sidebar */}
      <aside className="relative z-10 hidden w-[292px] shrink-0 lg:block">
        <div className="absolute inset-y-5 left-5 right-0 overflow-y-auto rounded-[34px] border border-white/10 bg-[linear-gradient(180deg,rgba(26,20,45,0.88),rgba(11,9,22,0.95))] shadow-[0_30px_80px_rgba(0,0,0,0.32)] backdrop-blur-xl">
          <div className="pointer-events-none absolute inset-x-0 top-0 h-44 rounded-t-[34px] bg-[radial-gradient(circle_at_top,rgba(139,92,246,0.28),transparent_68%)]" />
          <SidebarContent />
        </div>
      </aside>
    </>
  );
}
