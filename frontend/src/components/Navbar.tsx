import { motion } from "framer-motion";
import { useEffect, useState } from "react";
import { ArrowUpRight, ChevronDown, LayoutDashboard, LogOut } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../contexts/AuthContext";

const NAV_LINKS = [
  { label: "Home", href: "#home" },
  { label: "Solutions", href: "#solutions" },
  { label: "Pricing", href: "#pricing" },
  { label: "FAQ", href: "#faq" },
];

export function Navbar() {
  const navigate = useNavigate();
  const { user, role, signOut } = useAuth();
  const [mounted, setMounted] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);

  useEffect(() => {
    const timer = window.setTimeout(() => setMounted(true), 1500);
    return () => window.clearTimeout(timer);
  }, []);

  useEffect(() => {
    setMenuOpen(false);
  }, [user?.id]);

  async function handleSignOut() {
    await signOut();
    navigate("/", { replace: true });
  }

  const dashboardPath = role === "admin" ? "/admin" : "/dashboard";
  const initials = user?.email?.slice(0, 1).toUpperCase() ?? "U";

  return (
    <motion.header
      initial={{ opacity: 0, y: -10 }}
      animate={mounted ? { opacity: 1, y: 0 } : { opacity: 0, y: -10 }}
      transition={{ duration: 0.9, ease: [0.16, 1, 0.3, 1] }}
      className="fixed inset-x-0 top-0 z-50 border-b border-[rgba(255,255,255,0.07)] backdrop-blur-[8px]"
      style={{ backgroundColor: "rgba(0,0,0,0.72)" }}
    >
      <div className="mx-auto flex max-w-[1240px] items-center justify-between px-5 py-3 sm:px-8">
        <a href="#home" className="flex items-center gap-2.5" aria-label="FrondexAI home">
          <span
            className="flex h-7 w-7 items-center justify-center rounded-[6px]"
            style={{
              background: "linear-gradient(135deg,#7C3AED 0%,#5B21B6 100%)",
              boxShadow: "0 0 14px rgba(124,58,237,0.40)",
            }}
            aria-hidden="true"
          >
            <span className="text-xs font-bold text-white">F</span>
          </span>
          <span className="text-sm font-bold tracking-[0.18em] text-white">FRONDEXAI</span>
        </a>

        <nav className="hidden items-center gap-7 md:flex" aria-label="Primary navigation">
          {NAV_LINKS.map((item) => (
            <a
              key={item.label}
              href={item.href}
              className="text-sm text-[rgba(255,255,255,0.78)] transition-colors duration-150 hover:text-white"
            >
              {item.label}
            </a>
          ))}
        </nav>

        {user ? (
          <div className="flex items-center gap-3">
            <button
              onClick={() => navigate(dashboardPath)}
              className="inline-flex items-center gap-2 rounded-[10px] border border-white/10 bg-white/[0.05] px-3.5 py-2 text-xs font-medium text-white transition-colors hover:bg-white/[0.08]"
            >
              <LayoutDashboard className="h-3.5 w-3.5" />
              Dashboard
            </button>
            <div className="relative">
              <button
                onClick={() => setMenuOpen((current) => !current)}
                className="inline-flex items-center gap-2 rounded-[10px] border border-white/10 bg-white/[0.05] px-2.5 py-1.5 text-xs font-medium text-white"
              >
                <span className="flex h-7 w-7 items-center justify-center rounded-full bg-[linear-gradient(135deg,#7C3AED_0%,#8B5CF6_100%)] text-[11px] font-semibold">
                  {initials}
                </span>
                <ChevronDown className="h-3.5 w-3.5 text-white/60" />
              </button>
              {menuOpen ? (
                <div className="absolute right-0 mt-2 w-56 overflow-hidden rounded-2xl border border-white/10 bg-[#0d0b13] p-2 shadow-[0_24px_60px_rgba(0,0,0,0.45)]">
                  <div className="px-3 py-2">
                    <p className="truncate text-sm text-white">{user.email}</p>
                    <p className="mt-1 text-[11px] uppercase tracking-[0.2em] text-white/40">
                      {role === "admin" ? "Admin" : "Client"}
                    </p>
                  </div>
                  <button
                    onClick={() => void handleSignOut()}
                    className="flex w-full items-center gap-2 rounded-xl px-3 py-2 text-sm text-white/72 transition-colors hover:bg-white/[0.05] hover:text-white"
                  >
                    <LogOut className="h-4 w-4" />
                    Logout
                  </button>
                </div>
              ) : null}
            </div>
          </div>
        ) : (
          <button
            onClick={() => navigate("/login")}
            className="inline-flex items-center gap-1.5 rounded-[8px] px-3.5 py-1.5 text-xs font-medium text-white transition-opacity duration-150 hover:opacity-90"
            style={{
              background: "linear-gradient(135deg,#7C3AED 0%,#8B5CF6 100%)",
              boxShadow: "0 0 16px rgba(124,58,237,0.30)",
            }}
          >
            Login
            <ArrowUpRight className="h-3.5 w-3.5" aria-hidden="true" />
          </button>
        )}
      </div>
    </motion.header>
  );
}
