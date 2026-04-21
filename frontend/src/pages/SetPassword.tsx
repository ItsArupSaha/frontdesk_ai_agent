import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "../lib/supabase";

export default function SetPasswordPage() {
  const navigate = useNavigate();
  const [ready, setReady] = useState(false);
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState(false);

  // Supabase JS auto-exchanges the #access_token fragment on load.
  // We wait for PASSWORD_RECOVERY event to confirm the session is valid.
  useEffect(() => {
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event) => {
      if (event === "PASSWORD_RECOVERY") {
        setReady(true);
      }
    });
    // Also check if there's already an active session from the hash exchange.
    void supabase.auth.getSession().then(({ data }) => {
      if (data.session) setReady(true);
    });
    return () => subscription.unsubscribe();
  }, []);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    if (password.length < 8) {
      setError("Password must be at least 8 characters.");
      return;
    }
    if (password !== confirm) {
      setError("Passwords don't match.");
      return;
    }
    setLoading(true);
    const { error: updateError } = await supabase.auth.updateUser({ password });
    setLoading(false);
    if (updateError) {
      setError(updateError.message);
      return;
    }
    setDone(true);
    setTimeout(() => navigate("/dashboard", { replace: true }), 2000);
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-[#06050a] p-4">
      <div className="w-full max-w-sm">
        <div className="mb-8 text-center">
          <p className="text-xs uppercase tracking-[0.3em] text-white/40">Dashboard Access</p>
          <h1 className="mt-3 text-2xl font-semibold tracking-[-0.04em] text-white">
            Set Your Password
          </h1>
          <p className="mt-2 text-sm text-white/45">
            Choose a password to access your AI front-desk dashboard.
          </p>
        </div>

        {done ? (
          <div className="rounded-[20px] border border-emerald-500/20 bg-emerald-500/8 p-6 text-center">
            <p className="text-lg">✓</p>
            <p className="mt-1 text-sm font-medium text-emerald-200">Password set successfully!</p>
            <p className="mt-1 text-xs text-emerald-200/60">Redirecting to your dashboard…</p>
          </div>
        ) : !ready ? (
          <div className="rounded-[20px] border border-white/10 bg-white/[0.03] p-6 text-center text-sm text-white/45">
            <span className="inline-block h-4 w-4 animate-spin rounded-full border-2 border-violet-400 border-t-transparent mr-2" />
            Verifying your link…
          </div>
        ) : (
          <form onSubmit={(e) => void handleSubmit(e)} className="space-y-4">
            <div>
              <label className="mb-1.5 block text-xs text-white/55">New Password</label>
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                minLength={8}
                autoFocus
                placeholder="At least 8 characters"
                className="w-full rounded-[14px] border border-white/10 bg-white/[0.05] px-4 py-3 text-sm text-white placeholder:text-white/25 focus:outline-none focus:ring-2 focus:ring-violet-500/60"
              />
            </div>
            <div>
              <label className="mb-1.5 block text-xs text-white/55">Confirm Password</label>
              <input
                type="password"
                value={confirm}
                onChange={(e) => setConfirm(e.target.value)}
                required
                placeholder="Repeat password"
                className="w-full rounded-[14px] border border-white/10 bg-white/[0.05] px-4 py-3 text-sm text-white placeholder:text-white/25 focus:outline-none focus:ring-2 focus:ring-violet-500/60"
              />
            </div>

            {error && (
              <p className="rounded-[12px] bg-rose-500/10 px-4 py-2 text-xs text-rose-300">{error}</p>
            )}

            <button
              type="submit"
              disabled={loading}
              className="w-full rounded-[14px] bg-violet-500 py-3 text-sm font-medium text-white hover:bg-violet-400 disabled:opacity-50"
            >
              {loading ? "Saving…" : "Set Password & Continue"}
            </button>
          </form>
        )}
      </div>
    </div>
  );
}
