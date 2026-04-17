import type { ReactNode } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../contexts/AuthContext";

type AppShellProps = {
  children: ReactNode;
};

export function AppShell({ children }: AppShellProps) {
  const navigate = useNavigate();
  const { role, signOut, user } = useAuth();

  async function handleSignOut() {
    await signOut();
    navigate("/", { replace: true });
  }

  return (
    <div className="min-h-screen bg-[#06050a] text-white">
      <header className="border-b border-white/8 bg-[rgba(8,7,12,0.92)] backdrop-blur-xl">
        <div className="mx-auto flex max-w-7xl items-center justify-between px-6 py-4">
          <div>
            <p className="text-xs uppercase tracking-[0.28em] text-white/40">
              {role === "admin" ? "Admin Console" : "Client Portal"}
            </p>
            <h1 className="mt-1 text-lg font-semibold tracking-[-0.03em] text-white">
              AI Frontdesk Dashboard
            </h1>
          </div>
          <div className="flex items-center gap-3">
            <span className="hidden text-sm text-white/45 sm:block">{user?.email}</span>
            <a
              href="/"
              className="rounded-full border border-white/10 px-4 py-2 text-xs uppercase tracking-[0.2em] text-white/75"
            >
              Landing
            </a>
            <button
              onClick={() => void handleSignOut()}
              className="rounded-full bg-[linear-gradient(135deg,#7C3AED_0%,#8B5CF6_100%)] px-4 py-2 text-xs font-medium uppercase tracking-[0.2em] text-white"
            >
              Logout
            </button>
          </div>
        </div>
      </header>
      <main className="mx-auto max-w-7xl px-4 py-6 sm:px-6">{children}</main>
    </div>
  );
}
