import { FormEvent, useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { ArrowRight } from "lucide-react";
import { supabase } from "../lib/supabase";
import { getMe } from "../lib/api";

export function LoginPage() {
  const navigate = useNavigate();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    supabase.auth.getSession().then(async ({ data }) => {
      const session = data.session;
      if (!session?.access_token) return;
      try {
        const me = await getMe(session.access_token);
        navigate(me.is_admin ? "/admin" : "/dashboard", { replace: true });
      } catch {
        navigate("/dashboard", { replace: true });
      }
    });
  }, [navigate]);

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    setLoading(true);
    setError(null);

    const { data, error: authError } = await supabase.auth.signInWithPassword({
      email,
      password,
    });

    if (authError || !data.session?.access_token) {
      setLoading(false);
      setError("Invalid email or password. Please try again.");
      return;
    }

    try {
      const me = await getMe(data.session.access_token);
      navigate(me.is_admin ? "/admin" : "/dashboard", { replace: true });
    } catch {
      navigate("/dashboard", { replace: true });
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="min-h-screen bg-[radial-gradient(circle_at_top,rgba(124,58,237,0.22),transparent_28%),#05030a] px-4 py-12 text-white">
      <div className="mx-auto flex min-h-[calc(100vh-6rem)] max-w-6xl items-center justify-center">
        <div className="grid w-full max-w-5xl overflow-hidden rounded-[32px] border border-white/10 bg-[rgba(9,8,14,0.82)] shadow-[0_40px_120px_rgba(0,0,0,0.45)] backdrop-blur-xl lg:grid-cols-[1.05fr_0.95fr]">
          <div className="hidden border-r border-white/8 bg-[radial-gradient(circle_at_top_left,rgba(124,58,237,0.28),rgba(6,5,10,0.2)_45%,rgba(6,5,10,0.96)_80%)] p-10 lg:block">
            <div className="max-w-md">
              <p className="text-xs uppercase tracking-[0.34em] text-white/50">Client Access</p>
              <h1 className="mt-6 text-[clamp(2.5rem,4vw,4rem)] font-semibold leading-[0.94] tracking-[-0.06em]">
                Log in to your operations workspace.
              </h1>
              <p className="mt-6 max-w-sm text-base leading-8 text-white/62">
                Use your existing portal credentials. Clients go to their dashboard and admins go
                straight to client management.
              </p>
            </div>
          </div>

          <div className="p-6 sm:p-10 lg:p-12">
            <div className="mx-auto max-w-md">
              <a
                href="/"
                className="inline-flex items-center gap-2 text-xs uppercase tracking-[0.28em] text-white/45 transition-colors hover:text-white/70"
              >
                Back to site
              </a>

              <div className="mt-10">
                <p className="text-xs uppercase tracking-[0.3em] text-white/45">Login</p>
                <h2 className="mt-3 text-3xl font-semibold tracking-[-0.05em] text-white">
                  Welcome back
                </h2>
                <p className="mt-3 text-sm leading-7 text-white/55">
                  Enter your email and password to continue.
                </p>
              </div>

              <form onSubmit={handleSubmit} className="mt-10 space-y-5">
                <div>
                  <label htmlFor="email" className="mb-2 block text-sm text-white/72">
                    Email
                  </label>
                  <input
                    id="email"
                    type="email"
                    required
                    autoComplete="email"
                    value={email}
                    onChange={(event) => setEmail(event.target.value)}
                    className="w-full rounded-2xl border border-white/10 bg-white/[0.03] px-4 py-3.5 text-sm text-white outline-none transition focus:border-violet-400/60 focus:bg-white/[0.05]"
                    placeholder="name@company.com"
                  />
                </div>

                <div>
                  <label htmlFor="password" className="mb-2 block text-sm text-white/72">
                    Password
                  </label>
                  <input
                    id="password"
                    type="password"
                    required
                    autoComplete="current-password"
                    value={password}
                    onChange={(event) => setPassword(event.target.value)}
                    className="w-full rounded-2xl border border-white/10 bg-white/[0.03] px-4 py-3.5 text-sm text-white outline-none transition focus:border-violet-400/60 focus:bg-white/[0.05]"
                    placeholder="Enter your password"
                  />
                </div>

                {error ? (
                  <p className="rounded-2xl border border-rose-500/20 bg-rose-500/10 px-4 py-3 text-sm text-rose-200">
                    {error}
                  </p>
                ) : null}

                <button
                  type="submit"
                  disabled={loading}
                  className="inline-flex w-full items-center justify-center gap-2 rounded-2xl bg-[linear-gradient(135deg,#7C3AED_0%,#8B5CF6_100%)] px-5 py-3.5 text-sm font-medium text-white shadow-[0_0_24px_rgba(124,58,237,0.28)] transition hover:opacity-95 disabled:cursor-not-allowed disabled:opacity-60"
                >
                  {loading ? "Logging in..." : "Login"}
                  <ArrowRight className="h-4 w-4" />
                </button>
              </form>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
