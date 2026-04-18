import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../contexts/AuthContext";
import { getAdminClients, impersonateClient, updateClientStatus, type AdminClientSummary, type ImpersonateResponse } from "../lib/api";
import { LoadingSpinner } from "../components/LoadingSpinner";
import { DashboardPage } from "./Dashboard";

export function AdminPanelPage() {
  const { role, token, loading: authLoading, signOut } = useAuth();
  const navigate = useNavigate();
  const [clients, setClients] = useState<AdminClientSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [impersonation, setImpersonation] = useState<ImpersonateResponse | null>(null);
  const [statusUpdating, setStatusUpdating] = useState<string | null>(null);

  useEffect(() => {
    if (!authLoading && role !== null && role !== "admin") {
      navigate("/dashboard", { replace: true });
    }
  }, [role, authLoading, navigate]);

  useEffect(() => {
    if (!token || role !== "admin") return;
    void loadClients();
  }, [token, role]);

  async function loadClients() {
    if (!token) return;
    setLoading(true);
    setError(null);
    try {
      setClients(await getAdminClients(token));
    } catch {
      setError("Failed to load clients. Please try again.");
    } finally {
      setLoading(false);
    }
  }

  async function handleToggleStatus(client: AdminClientSummary) {
    if (!token) return;
    setStatusUpdating(client.id);
    try {
      await updateClientStatus(token, client.id, !client.is_active);
      setClients((current) =>
        current.map((item) =>
          item.id === client.id ? { ...item, is_active: !item.is_active } : item,
        ),
      );
    } finally {
      setStatusUpdating(null);
    }
  }

  async function handleViewDashboard(client: AdminClientSummary) {
    if (!token) return;
    try {
      setImpersonation(await impersonateClient(token, client.id));
    } catch {
      setError("Failed to open the client dashboard.");
    }
  }

  async function handleSignOut() {
    await signOut();
    navigate("/", { replace: true });
  }

  if (authLoading || role === null) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-[#06050a]">
        <LoadingSpinner size="lg" />
      </div>
    );
  }

  if (impersonation) {
    return (
      <div className="min-h-screen bg-[#06050a] text-white">
        <div className="flex items-center justify-between bg-amber-500 px-6 py-3 text-sm font-medium text-black">
          <span>
            Viewing: {impersonation.business_name}
            {!impersonation.is_active ? (
              <span className="ml-3 rounded bg-black px-2 py-1 text-[11px] uppercase tracking-[0.2em] text-white">
                Suspended
              </span>
            ) : null}
          </span>
          <button
            onClick={() => setImpersonation(null)}
            className="rounded-full bg-black/85 px-4 py-2 text-xs uppercase tracking-[0.2em] text-white"
          >
            Exit Admin View
          </button>
        </div>
        <DashboardPage overrideClientId={impersonation.client_id} />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#06050a] p-6 text-white">
      <div className="mx-auto max-w-7xl">
        <div className="mb-6 flex items-center justify-between">
          <div>
            <p className="text-xs uppercase tracking-[0.3em] text-white/45">Admin</p>
            <h1 className="mt-2 text-3xl font-semibold tracking-[-0.05em]">Client Management</h1>
            <p className="mt-2 text-sm text-white/55">Manage all clients from one place.</p>
          </div>
          <div className="flex items-center gap-3">
            <button
              onClick={() => navigate("/admin/onboarding")}
              className="rounded-full border border-violet-400/25 bg-violet-500/10 px-4 py-2 text-xs font-medium uppercase tracking-[0.18em] text-violet-100"
            >
              Add Client
            </button>
            <a
              href="/landing"
              className="rounded-full border border-white/10 px-4 py-2 text-xs font-medium uppercase tracking-[0.18em] text-white/75"
            >
              Landing
            </a>
            <button
              onClick={() => void handleSignOut()}
              className="rounded-full border border-white/10 px-4 py-2 text-xs font-medium uppercase tracking-[0.18em] text-white/75"
            >
              Logout
            </button>
          </div>
        </div>

        {error ? (
          <div className="mb-4 rounded-2xl border border-rose-500/20 bg-rose-500/10 p-4 text-sm text-rose-200">
            {error}
          </div>
        ) : null}

        {loading ? (
          <div className="flex justify-center py-24">
            <LoadingSpinner size="lg" />
          </div>
        ) : (
          <div className="overflow-hidden rounded-[28px] border border-white/10 bg-white/[0.03]">
            <div className="overflow-x-auto">
              <table className="w-full min-w-[920px] text-sm">
                <thead>
                  <tr className="border-b border-white/8 text-left text-xs uppercase tracking-[0.22em] text-white/35">
                    <th className="px-4 py-4">Business</th>
                    <th className="px-4 py-4">Status</th>
                    <th className="px-4 py-4">Calls / Mo</th>
                    <th className="px-4 py-4">Last Call</th>
                    <th className="px-4 py-4">Bookings / Mo</th>
                    <th className="px-4 py-4">Est. Cost</th>
                    <th className="px-4 py-4">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {clients.map((client) => (
                    <tr key={client.id} className="border-t border-white/6 text-white/72">
                      <td className="px-4 py-4">
                        <div className="font-medium text-white">{client.business_name}</div>
                        <div className="text-xs text-white/35">{client.email ?? "-"}</div>
                      </td>
                      <td className="px-4 py-4">
                        <span
                          className={`inline-flex rounded-full px-3 py-1 text-xs font-medium ${
                            client.is_active
                              ? "bg-emerald-500/15 text-emerald-200"
                              : "bg-rose-500/15 text-rose-200"
                          }`}
                        >
                          {client.is_active ? "Active" : "Suspended"}
                        </span>
                      </td>
                      <td className="px-4 py-4">{client.calls_this_month}</td>
                      <td className="px-4 py-4 text-white/45">
                        {client.last_call_at
                          ? new Date(client.last_call_at).toLocaleDateString()
                          : "-"}
                      </td>
                      <td className="px-4 py-4">{client.bookings_this_month}</td>
                      <td className="px-4 py-4 font-medium text-white">
                        ${client.monthly_cost_estimate.toFixed(2)}
                      </td>
                      <td className="px-4 py-4">
                        <div className="flex items-center gap-2">
                          <button
                            onClick={() => void handleViewDashboard(client)}
                            className="rounded-full border border-violet-400/25 bg-violet-500/10 px-3 py-1.5 text-xs font-medium text-violet-100"
                          >
                            View Dashboard
                          </button>
                          <button
                            onClick={() => void handleToggleStatus(client)}
                            disabled={statusUpdating === client.id}
                            className={`rounded-full px-3 py-1.5 text-xs font-medium ${
                              client.is_active
                                ? "bg-rose-500/12 text-rose-200"
                                : "bg-emerald-500/12 text-emerald-200"
                            } disabled:opacity-50`}
                          >
                            {statusUpdating === client.id
                              ? "..."
                              : client.is_active
                                ? "Suspend"
                                : "Reactivate"}
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                  {clients.length === 0 ? (
                    <tr>
                      <td colSpan={7} className="px-4 py-10 text-center text-white/35">
                        No clients found.
                      </td>
                    </tr>
                  ) : null}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
