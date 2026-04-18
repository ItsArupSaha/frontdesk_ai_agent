import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useAuth } from "../contexts/AuthContext";
import {
  getAdminClients,
  impersonateClient,
  updateClientStatus,
  updateSmsEnabled,
  type AdminClientSummary,
  type ImpersonateResponse,
} from "../lib/api";
import { LoadingSpinner } from "../components/LoadingSpinner";
import { DashboardPage } from "./Dashboard";

// ---------------------------------------------------------------------------
// Completeness breakdown popover
// ---------------------------------------------------------------------------

function CompletenessCell({ client }: { client: AdminClientSummary }) {
  const [open, setOpen] = useState(false);
  const score = client.completeness_score;
  const color = score >= 90 ? "bg-emerald-400" : score >= 60 ? "bg-amber-400" : "bg-rose-400";
  const textColor = score >= 90 ? "text-emerald-300" : score >= 60 ? "text-amber-300" : "text-rose-300";
  const missing = Object.entries(client.completeness_breakdown).filter(([, done]) => !done);

  return (
    <div className="relative">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className="group flex flex-col gap-1.5 rounded-[12px] border border-white/0 px-2 py-1.5 hover:border-white/10 hover:bg-white/5 transition-colors"
      >
        <div className="flex items-center gap-2">
          <div className="h-1.5 w-20 overflow-hidden rounded-full bg-white/10">
            <div className={`h-full rounded-full ${color} transition-all`} style={{ width: `${score}%` }} />
          </div>
          <span className={`text-xs font-semibold ${textColor}`}>{score}%</span>
        </div>
        <span className="text-left text-[10px] text-white/35 group-hover:text-white/55 transition-colors">
          {missing.length > 0 ? `${missing.length} missing — click to see` : "All complete ✓"}
        </span>
      </button>

      {open ? (
        <>
          <div className="fixed inset-0 z-40" onClick={() => setOpen(false)} />
          <div className="absolute left-0 top-14 z-50 w-72 rounded-[18px] border border-white/12 bg-[#0d0a16] p-4 shadow-2xl">
            <p className="mb-3 text-[10px] uppercase tracking-[0.2em] text-white/40">Setup checklist — {client.business_name}</p>
            <ul className="space-y-2.5">
              {Object.entries(client.completeness_breakdown).map(([label, isDone]) => (
                <li key={label} className="flex items-center gap-2.5 text-xs">
                  <span
                    className={`flex h-5 w-5 shrink-0 items-center justify-center rounded-full text-[10px] font-bold ${
                      isDone ? "bg-emerald-500/20 text-emerald-300" : "bg-rose-500/15 text-rose-300"
                    }`}
                  >
                    {isDone ? "✓" : "✗"}
                  </span>
                  <span className={isDone ? "text-white/50" : "font-medium text-white/90"}>{label}</span>
                  {!isDone && (
                    <span className="ml-auto shrink-0 rounded-full bg-amber-500/15 px-1.5 py-0.5 text-[9px] text-amber-300">
                      Needed
                    </span>
                  )}
                </li>
              ))}
            </ul>
            {missing.length > 0 ? (
              <div className="mt-3 rounded-[12px] bg-amber-500/8 px-3 py-2 text-[10px] text-amber-300/80">
                {missing.length} item{missing.length > 1 ? "s" : ""} remaining for full service
              </div>
            ) : (
              <div className="mt-3 rounded-[12px] bg-emerald-500/8 px-3 py-2 text-[10px] text-emerald-300/80">
                All setup items complete ✓
              </div>
            )}
          </div>
        </>
      ) : null}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Provisioning badges
// ---------------------------------------------------------------------------

function ProvisioningBadges({ client }: { client: AdminClientSummary }) {
  return (
    <div className="flex flex-wrap gap-1">
      <span
        className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-medium ${
          client.vapi_assistant_id ? "bg-emerald-500/15 text-emerald-300" : "bg-white/8 text-white/35"
        }`}
      >
        {client.vapi_assistant_id ? "✓" : "○"} Voice
      </span>
      <span
        className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-medium ${
          client.vapi_phone_number ? "bg-emerald-500/15 text-emerald-300" : "bg-white/8 text-white/35"
        }`}
      >
        {client.vapi_phone_number ? "✓" : "○"} Number
      </span>
      <span
        className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-medium ${
          client.sms_enabled ? "bg-emerald-500/15 text-emerald-300" : "bg-amber-500/15 text-amber-300"
        }`}
      >
        {client.sms_enabled ? "✓" : "⏳"} SMS
      </span>
    </div>
  );
}

// ---------------------------------------------------------------------------
// One-click email helper
// ---------------------------------------------------------------------------

function buildMailtoLink(client: AdminClientSummary): string {
  if (!client.email) return "mailto:";
  const subject = encodeURIComponent(`Your AI Front-Desk Agent is Ready — ${client.business_name}`);
  const missing = Object.entries(client.completeness_breakdown)
    .filter(([, done]) => !done)
    .map(([label]) => `• ${label}`)
    .join("\n");
  const body = encodeURIComponent(
    `Hi there,\n\nYour AI front-desk agent for ${client.business_name} has been set up!\n\n` +
    `Status:\n` +
    `• AI Voice Agent: ${client.vapi_assistant_id ? "✓ Active" : "⏳ Pending"}\n` +
    `• AI Calling Number: ${client.vapi_phone_number ?? "Pending"}\n` +
    `• SMS Features: ${client.sms_enabled ? "✓ Active" : "⏳ Pending (carrier registration in progress)"}\n\n` +
    (missing
      ? `Still needed for full setup:\n${missing}\n\n`
      : "All setup items are complete!\n\n") +
    `To start receiving calls, forward your business number to:\n${client.twilio_phone_number ?? "[Phone number pending]"}\n\n` +
    `Reply to this email with any questions.\n\nBest,\nArup`,
  );
  return `mailto:${client.email}?subject=${subject}&body=${body}`;
}

// ---------------------------------------------------------------------------
// Notes modal
// ---------------------------------------------------------------------------

function NotesModal({
  client,
  onClose,
  onSave,
}: {
  client: AdminClientSummary;
  onClose: () => void;
  onSave: (notes: string) => void;
}) {
  const [text, setText] = useState(client.provisioning_notes ?? "");
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4">
      <div className="w-full max-w-lg rounded-[28px] border border-white/10 bg-[#0d0a16] p-6 shadow-2xl">
        <h3 className="mb-1 text-base font-semibold text-white">Provisioning Notes</h3>
        <p className="mb-4 text-xs text-white/45">{client.business_name}</p>
        <textarea
          value={text}
          onChange={(e) => setText(e.target.value)}
          rows={6}
          className="w-full resize-none rounded-[16px] border border-white/10 bg-[#06050a] px-4 py-3 text-sm text-white placeholder:text-white/28 focus:outline-none focus:ring-2 focus:ring-violet-500/60"
          placeholder="A2P registration ID, approval date, carrier notes…"
        />
        <div className="mt-4 flex justify-end gap-3">
          <button onClick={onClose} className="rounded-full border border-white/10 px-4 py-2 text-xs text-white/60">
            Cancel
          </button>
          <button
            onClick={() => { onSave(text); onClose(); }}
            className="rounded-full bg-violet-500 px-4 py-2 text-xs font-medium text-white hover:bg-violet-400"
          >
            Save Notes
          </button>
        </div>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Main component
// ---------------------------------------------------------------------------

export function AdminPanelPage() {
  const { token, role, loading: authLoading, signOut } = useAuth();
  const navigate = useNavigate();
  const qc = useQueryClient();
  const [impersonation, setImpersonation] = useState<ImpersonateResponse | null>(null);
  const [notesClient, setNotesClient] = useState<AdminClientSummary | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);

  // Per-client loading state — prevents shared mutation from affecting all rows.
  const [statusLoading, setStatusLoading] = useState<Record<string, boolean>>({});
  const [smsLoading, setSmsLoading] = useState<Record<string, boolean>>({});

  const clientsQuery = useQuery<AdminClientSummary[]>({
    queryKey: ["adminClients"],
    queryFn: () => getAdminClients(token!),
    enabled: !!token && role === "admin",
  });

  async function handleToggleStatus(client: AdminClientSummary) {
    if (statusLoading[client.id]) return;
    setStatusLoading((s) => ({ ...s, [client.id]: true }));
    try {
      await updateClientStatus(token!, client.id, !client.is_active);
      await qc.invalidateQueries({ queryKey: ["adminClients"] });
    } catch {
      setActionError("Failed to update client status.");
    } finally {
      setStatusLoading((s) => ({ ...s, [client.id]: false }));
    }
  }

  async function handleToggleSms(client: AdminClientSummary, notes?: string) {
    if (smsLoading[client.id]) return;
    setSmsLoading((s) => ({ ...s, [client.id]: true }));
    try {
      await updateSmsEnabled(token!, client.id, !client.sms_enabled, notes);
      await qc.invalidateQueries({ queryKey: ["adminClients"] });
    } catch {
      setActionError("Failed to update SMS status.");
    } finally {
      setSmsLoading((s) => ({ ...s, [client.id]: false }));
    }
  }

  async function handleViewDashboard(client: AdminClientSummary) {
    try {
      setImpersonation(await impersonateClient(token!, client.id));
    } catch {
      setActionError("Failed to open the client dashboard.");
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

  if (role !== "admin") {
    navigate("/dashboard", { replace: true });
    return null;
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

  const clients = clientsQuery.data ?? [];
  const totalClients = clients.length;
  const activeClients = clients.filter((c) => c.is_active).length;
  const smsReady = clients.filter((c) => c.sms_enabled).length;
  const avgCompleteness =
    clients.length > 0
      ? Math.round(clients.reduce((s, c) => s + c.completeness_score, 0) / clients.length)
      : 0;

  return (
    <div className="min-h-screen bg-[#06050a] p-6 text-white">
      {notesClient ? (
        <NotesModal
          client={notesClient}
          onClose={() => setNotesClient(null)}
          onSave={(notes) => void handleToggleSms(notesClient, notes)}
        />
      ) : null}

      <div className="mx-auto max-w-[1400px]">
        {/* Header */}
        <div className="mb-6 flex items-start justify-between">
          <div>
            <p className="text-xs uppercase tracking-[0.3em] text-white/45">Admin</p>
            <h1 className="mt-2 text-3xl font-semibold tracking-[-0.05em]">Client Management</h1>
            <p className="mt-1 text-sm text-white/50">Manage provisioning, SMS activation, and client access.</p>
          </div>
          <div className="flex items-center gap-3">
            <button
              onClick={() => navigate("/admin/onboarding")}
              className="rounded-full border border-violet-400/25 bg-violet-500/10 px-4 py-2 text-xs font-medium uppercase tracking-[0.18em] text-violet-100 hover:bg-violet-500/18"
            >
              Add Client
            </button>
            <button
              onClick={() => navigate("/landing")}
              className="rounded-full border border-white/10 px-4 py-2 text-xs font-medium uppercase tracking-[0.18em] text-white/75"
            >
              Landing
            </button>
            <button
              onClick={() => void handleSignOut()}
              className="rounded-full border border-white/10 px-4 py-2 text-xs font-medium uppercase tracking-[0.18em] text-white/75"
            >
              Logout
            </button>
          </div>
        </div>

        {/* Summary cards */}
        <div className="mb-6 grid grid-cols-2 gap-4 lg:grid-cols-4">
          {[
            { label: "Total Clients", value: totalClients },
            { label: "Active", value: activeClients },
            { label: "SMS Ready", value: `${smsReady} / ${totalClients}` },
            { label: "Avg Completeness", value: `${avgCompleteness}%` },
          ].map((card) => (
            <div key={card.label} className="rounded-[24px] border border-white/10 bg-white/[0.03] p-5">
              <p className="text-[10px] uppercase tracking-[0.22em] text-white/38">{card.label}</p>
              <p className="mt-2 text-2xl font-semibold tracking-[-0.04em] text-white">{card.value}</p>
            </div>
          ))}
        </div>

        {actionError ? (
          <div className="mb-4 rounded-2xl border border-rose-500/20 bg-rose-500/10 p-4 text-sm text-rose-200">
            {actionError}
            <button className="ml-3 text-rose-300 underline" onClick={() => setActionError(null)}>
              Dismiss
            </button>
          </div>
        ) : null}

        {clientsQuery.isLoading ? (
          <div className="flex justify-center py-24">
            <LoadingSpinner size="lg" />
          </div>
        ) : (
          <div className="overflow-hidden rounded-[28px] border border-white/10 bg-white/[0.03]">
            <div className="overflow-x-auto">
              <table className="w-full min-w-[1100px] text-sm">
                <thead>
                  <tr className="border-b border-white/8 text-left text-[10px] uppercase tracking-[0.22em] text-white/35">
                    <th className="px-4 py-4">Business</th>
                    <th className="px-4 py-4">Status</th>
                    <th className="px-4 py-4">Provisioning</th>
                    <th className="px-4 py-4">Completeness</th>
                    <th className="px-4 py-4">Calls / Mo</th>
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
                        <div className="text-xs text-white/35">{client.email ?? "—"}</div>
                        {client.vapi_phone_number ? (
                          <div className="mt-0.5 font-mono text-[10px] text-white/28">
                            {client.vapi_phone_number}
                          </div>
                        ) : null}
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

                      <td className="px-4 py-4">
                        <ProvisioningBadges client={client} />
                      </td>

                      <td className="px-4 py-4">
                        <CompletenessCell client={client} />
                      </td>

                      <td className="px-4 py-4">{client.calls_this_month}</td>
                      <td className="px-4 py-4">{client.bookings_this_month}</td>
                      <td className="px-4 py-4 font-medium text-white">
                        ${client.monthly_cost_estimate.toFixed(2)}
                      </td>

                      <td className="px-4 py-4">
                        <div className="flex flex-wrap items-center gap-2">
                          {/* View dashboard */}
                          <button
                            onClick={() => void handleViewDashboard(client)}
                            className="rounded-full border border-violet-400/25 bg-violet-500/10 px-3 py-1.5 text-xs font-medium text-violet-100 hover:bg-violet-500/18"
                          >
                            View
                          </button>

                          {/* Suspend / Reactivate */}
                          <button
                            onClick={() => void handleToggleStatus(client)}
                            disabled={statusLoading[client.id]}
                            className={`rounded-full px-3 py-1.5 text-xs font-medium disabled:opacity-50 ${
                              client.is_active
                                ? "bg-rose-500/12 text-rose-200 hover:bg-rose-500/20"
                                : "bg-emerald-500/12 text-emerald-200 hover:bg-emerald-500/20"
                            }`}
                          >
                            {statusLoading[client.id]
                              ? "…"
                              : client.is_active
                                ? "Suspend"
                                : "Reactivate"}
                          </button>

                          {/* SMS toggle — per-client isolated */}
                          <button
                            onClick={() => void handleToggleSms(client)}
                            disabled={smsLoading[client.id]}
                            title={
                              client.sms_enabled
                                ? "Click to disable SMS"
                                : "Enable only after A2P 10DLC carrier registration is approved in Twilio console"
                            }
                            className={`rounded-full px-3 py-1.5 text-xs font-medium disabled:opacity-50 ${
                              client.sms_enabled
                                ? "bg-emerald-500/12 text-emerald-300 hover:bg-emerald-500/20"
                                : "bg-amber-500/10 text-amber-300 hover:bg-amber-500/18"
                            }`}
                          >
                            {smsLoading[client.id]
                              ? "…"
                              : client.sms_enabled
                                ? "SMS On"
                                : "Enable SMS"}
                          </button>

                          {/* Notes */}
                          <button
                            onClick={() => setNotesClient(client)}
                            title="Provisioning notes"
                            className="rounded-full border border-white/10 px-3 py-1.5 text-xs text-white/50 hover:text-white/80"
                          >
                            Notes{client.provisioning_notes ? " ●" : ""}
                          </button>

                          {/* One-click email */}
                          {client.email ? (
                            <a
                              href={buildMailtoLink(client)}
                              title="Open pre-filled email"
                              className="rounded-full border border-violet-400/20 bg-violet-500/8 px-3 py-1.5 text-xs text-violet-300 hover:bg-violet-500/16"
                            >
                              ✉ Email
                            </a>
                          ) : null}
                        </div>
                      </td>
                    </tr>
                  ))}
                  {clients.length === 0 ? (
                    <tr>
                      <td colSpan={8} className="px-4 py-10 text-center text-white/35">
                        No clients yet. Click &ldquo;Add Client&rdquo; to get started.
                      </td>
                    </tr>
                  ) : null}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* SMS provisioning reminder */}
        <div className="mt-6 rounded-[20px] border border-amber-500/20 bg-amber-500/8 p-4 text-sm text-amber-200/80">
          <span className="font-medium text-amber-200">SMS Activation Note — </span>
          US carrier A2P 10DLC registration takes 1–4 weeks and ~$20 one-time fee.
          Complete registration in the Twilio console, then click &ldquo;Enable SMS&rdquo; above.
          Voice calls work from day 1.
        </div>
      </div>
    </div>
  );
}
