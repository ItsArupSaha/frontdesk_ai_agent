import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useAuth } from "../contexts/AuthContext";
import {
  getAdminClients,
  impersonateClient,
  updateClientStatus,
  updateSmsEnabled,
  getMagicLink,
  type AdminClientSummary,
  type ImpersonateResponse,
} from "../lib/api";
import { LoadingSpinner } from "../components/LoadingSpinner";
import { DashboardPage } from "./Dashboard";

const API_BASE = (import.meta.env.VITE_API_URL as string | undefined) ?? "";

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
// Subscription / payment badge
// ---------------------------------------------------------------------------

function SubscriptionBadge({ client }: { client: AdminClientSummary }) {
  const { subscription_status, subscription_renews_at } = client;
  const config: Record<string, { label: string; cls: string }> = {
    active: { label: "Paying", cls: "bg-emerald-500/15 text-emerald-300" },
    paused: { label: "Paused", cls: "bg-amber-500/15 text-amber-300" },
    past_due: { label: "Past Due", cls: "bg-rose-500/15 text-rose-300" },
    cancelled: { label: "Cancelled", cls: "bg-rose-500/10 text-rose-400" },
    expired: { label: "Expired", cls: "bg-rose-500/10 text-rose-400" },
    none: { label: "No Sub", cls: "bg-white/8 text-white/35" },
  };
  const { label, cls } = config[subscription_status] ?? config["none"];

  const renewsDate = subscription_renews_at
    ? new Date(subscription_renews_at).toLocaleDateString("en-US", { month: "short", day: "numeric" })
    : null;

  return (
    <div className="flex flex-col gap-1">
      <span className={`inline-flex rounded-full px-2 py-0.5 text-[10px] font-medium ${cls}`}>{label}</span>
      {renewsDate && subscription_status === "active" && (
        <span className="text-[9px] text-white/30">Renews {renewsDate}</span>
      )}
      {renewsDate && subscription_status !== "active" && subscription_status !== "none" && (
        <span className="text-[9px] text-rose-400/60">{subscription_status === "cancelled" ? "Ended" : "Due"} {renewsDate}</span>
      )}
    </div>
  );
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
// Activation SSE progress modal
// ---------------------------------------------------------------------------

type StepStatus = "running" | "done" | "skipped" | "error";

interface ActivationStep {
  step: string;
  status: StepStatus;
  message: string;
}

interface ActivationModalState {
  clientId: string;
  businessName: string;
  email: string;
  steps: ActivationStep[];
  done: boolean;
  error: string | null;
  result: {
    vapi_phone_number?: string;
    twilio_phone_number?: string;
    email?: string;
    business_name?: string;
  } | null;
}

function StepIcon({ status }: { status: StepStatus }) {
  if (status === "running") {
    return (
      <span className="inline-block h-4 w-4 animate-spin rounded-full border-2 border-violet-400 border-t-transparent" />
    );
  }
  if (status === "done") return <span className="text-emerald-400">✓</span>;
  if (status === "skipped") return <span className="text-amber-400">⚠</span>;
  return <span className="text-rose-400">✗</span>;
}

function ActivationModal({
  state,
  onClose,
  onEmailSetup,
}: {
  state: ActivationModalState;
  onClose: () => void;
  onEmailSetup: () => void;
}) {
  const allDone = state.done && !state.error;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 p-4">
      <div className="flex w-full max-w-lg flex-col rounded-[28px] border border-white/10 bg-[#0d0a16] shadow-2xl" style={{ maxHeight: "90vh" }}>
        <div className="shrink-0 px-6 pt-6 pb-5 flex items-start justify-between">
          <div>
            <h3 className="text-base font-semibold text-white">Activating Client</h3>
            <p className="mt-0.5 text-xs text-white/45">{state.businessName} · {state.email}</p>
          </div>
          {state.done && (
            <button onClick={onClose} className="rounded-full border border-white/10 p-1.5 text-white/50 hover:text-white/80">
              ✕
            </button>
          )}
        </div>

        {/* Scrollable body */}
        <div className="overflow-y-auto px-6 pb-4" style={{ flex: "1 1 0" }}>
          <div className="space-y-3">
            {state.steps.map((s) => (
              <div
                key={s.step}
                className={`flex items-start gap-3 rounded-[14px] px-4 py-3 text-sm ${
                  s.status === "done"
                    ? "bg-emerald-500/8 text-emerald-200"
                    : s.status === "running"
                    ? "bg-violet-500/10 text-violet-200"
                    : s.status === "skipped"
                    ? "bg-amber-500/8 text-amber-200"
                    : "bg-rose-500/10 text-rose-200"
                }`}
              >
                <span className="mt-0.5 shrink-0">
                  <StepIcon status={s.status} />
                </span>
                <span>{s.message}</span>
              </div>
            ))}

            {state.steps.length === 0 && !state.error && (
              <div className="flex items-center gap-3 rounded-[14px] bg-white/5 px-4 py-3 text-sm text-white/50">
                <span className="inline-block h-4 w-4 animate-spin rounded-full border-2 border-violet-400 border-t-transparent" />
                Connecting…
              </div>
            )}

            {state.error && (
              <div className="rounded-[14px] bg-rose-500/12 px-4 py-3 text-sm text-rose-200">
                <span className="font-medium">Error: </span>{state.error}
              </div>
            )}
          </div>

          {allDone && state.result && (
            <div className="mt-4 rounded-[18px] border border-emerald-500/20 bg-emerald-500/8 p-4">
              <p className="mb-2 text-xs font-medium uppercase tracking-[0.18em] text-emerald-300">Activation Complete</p>
              {state.result.vapi_phone_number && (
                <p className="font-mono text-sm text-emerald-200">AI Calling Number: {state.result.vapi_phone_number}</p>
              )}
              {state.result.twilio_phone_number && (
                <p className="font-mono text-xs text-emerald-200/70 mt-1">SMS Number: {state.result.twilio_phone_number}</p>
              )}
            </div>
          )}
        </div>

        {/* Footer — always visible */}
        {state.done && (
          <div className="shrink-0 flex justify-end gap-3 border-t border-white/8 px-6 py-4">
            {allDone && (
              <button
                onClick={onEmailSetup}
                className="rounded-full bg-violet-500 px-5 py-2 text-xs font-medium text-white hover:bg-violet-400"
              >
                Send Welcome Email →
              </button>
            )}
            <button onClick={onClose} className="rounded-full border border-white/10 px-4 py-2 text-xs text-white/60">
              {allDone ? "Close" : "Dismiss"}
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Welcome email modal
// ---------------------------------------------------------------------------

interface EmailModalState {
  clientId: string;
  businessName: string;
  email: string;
  vapiPhone: string;
  magicLink: string | null;
  personalMessage: string;
}

function EmailModal({
  state,
  onClose,
}: {
  state: EmailModalState;
  onClose: () => void;
}) {
  const [copied, setCopied] = useState(false);
  const [msg, setMsg] = useState(
    state.personalMessage ||
    `Welcome aboard! It was a pleasure connecting with you, and I am thrilled to officially partner with ${state.businessName}.\n\n` +
    `Your new AI front-desk agent is ready to go to work. From this point forward, you have a system operating 24/7 to ensure every inbound call is answered, leads are qualified, emergencies are immediately routed to you, and appointments are seamlessly booked on your calendar.`,
  );

  function buildBody(currentMsg: string) {
    const lines = [
      `Hi there,`,
      ``,
      currentMsg,
      ``,
      `To finalize your configuration and get the system fully customized for your business, please complete the following three steps (this takes approximately 10 minutes):`,
      ``,
      `──────────────────────────────────────`,
      `STEP 1 — Forward Your Business Number`,
      `──────────────────────────────────────`,
      `Forward your existing business phone number to your new AI calling number:`,
      ``,
      `  ${state.vapiPhone || "[Your AI number — visible in your dashboard]"}`,
      ``,
      `How to forward (most carriers):`,
      `  • iPhone: Settings → Phone → Call Forwarding → enter the number above`,
      `  • Android: Phone app → Settings → Supplementary services → Call forwarding`,
      `  • Landline / VoIP: Contact your carrier and request "unconditional call forwarding"`,
      ``,
      `Once set up, every call to your business number is answered by your AI agent. Your customers will not notice a difference — the agent answers as your business.`,
      ``,
      `──────────────────────────────────────`,
      `STEP 2 — Connect Your Google Calendar`,
      `──────────────────────────────────────`,
      `This allows the AI to check your real availability and book appointments directly onto your calendar — no double-bookings, no manual entry.`,
      ``,
      `  1. Log in to your dashboard using the password link at the bottom of this email.`,
      `  2. Go to Settings → Integrations → Connect Google Calendar.`,
      `  3. Sign in with the Google account that holds your work calendar.`,
      `  4. Done — the AI will now book appointments in real time.`,
      ``,
      `──────────────────────────────────────`,
      `STEP 3 — Review Your Dashboard`,
      `──────────────────────────────────────`,
      `Your dashboard gives you a live view of every call, lead, booking, and emergency routed through your agent. Log in at any time to review call transcripts, manage bookings, and adjust your settings.`,
      ``,
      `Your dashboard also includes a Setup Guide page (in the sidebar) with a step-by-step checklist to ensure everything is configured correctly.`,
      ``,
      `──────────────────────────────────────`,
      `SET YOUR DASHBOARD PASSWORD`,
      `──────────────────────────────────────`,
      `Use the one-click link below to set your password. This link expires in 24 hours.`,
      ``,
      `  ${state.magicLink ?? "[Password link — reply to this email if expired]"}`,
      ``,
      `I am your direct point of contact. If you have any questions or require assistance during the setup process, simply reply to this email and I will personally ensure it gets resolved.`,
      ``,
      `Best regards,`,
      ``,
      `Arup Saha`,
      `Founder, [Your Company Name]`,
      `growwitharup@gmail.com`,
    ];
    return lines.join("\n");
  }

  const subject = `Welcome to [Your Company Name] – Setup instructions for ${state.businessName}`;
  // Short body for mailto (long bodies silently fail in most clients due to URL length limits)
  const shortBody =
    `Hi there,\n\nYour AI front-desk agent for ${state.businessName} is live!\n\n` +
    `[Paste the full email content you copied from the dashboard]\n\n` +
    `Best regards,\nArup Saha`;

  const [bodyCopied, setBodyCopied] = useState(false);

  function openEmailClient() {
    const a = document.createElement("a");
    a.href = `mailto:${state.email}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(shortBody)}`;
    a.style.display = "none";
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
  }

  function copyFullEmail() {
    const full = `Subject: ${subject}\nTo: ${state.email}\n\n${buildBody(msg)}`;
    void navigator.clipboard.writeText(full).then(() => {
      setBodyCopied(true);
      setTimeout(() => setBodyCopied(false), 3000);
    });
  }

  function copyLink() {
    if (state.magicLink) {
      void navigator.clipboard.writeText(state.magicLink);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 p-4">
      <div className="flex w-full max-w-2xl flex-col gap-5 rounded-[28px] border border-white/10 bg-[#0d0a16] p-6 shadow-2xl">
        <div className="flex items-start justify-between">
          <div>
            <h3 className="text-base font-semibold text-white">Send Welcome Email</h3>
            <p className="mt-0.5 text-xs text-white/45">{state.email} · {state.businessName}</p>
          </div>
          <button onClick={onClose} className="rounded-full border border-white/10 p-1.5 text-white/50 hover:text-white/80">
            ✕
          </button>
        </div>

        {/* Magic link */}
        <div className="rounded-[18px] border border-violet-500/20 bg-violet-500/8 p-4">
          <p className="mb-1.5 text-[10px] font-medium uppercase tracking-[0.18em] text-violet-300">
            Password Setup Link (magic link)
          </p>
          {state.magicLink ? (
            <div className="flex items-center gap-3">
              <span className="flex-1 truncate font-mono text-xs text-violet-200">{state.magicLink}</span>
              <button
                onClick={copyLink}
                className="shrink-0 rounded-full bg-violet-500/20 px-3 py-1 text-[10px] font-medium text-violet-200 hover:bg-violet-500/35"
              >
                {copied ? "Copied ✓" : "Copy"}
              </button>
            </div>
          ) : (
            <p className="text-xs text-violet-200/50">Generating…</p>
          )}
          <p className="mt-2 text-[10px] text-violet-200/50">
            One-click link — client sets their own password. Expires in 24 hours.
          </p>
        </div>

        {/* Personal message */}
        <div>
          <label className="mb-1.5 block text-[10px] font-medium uppercase tracking-[0.18em] text-white/45">
            Personal Message (optional)
          </label>
          <textarea
            value={msg}
            onChange={(e) => setMsg(e.target.value)}
            rows={3}
            placeholder="Add a personal note — e.g. 'Great speaking with you today!'"
            className="w-full resize-none rounded-[14px] border border-white/10 bg-[#06050a] px-4 py-3 text-sm text-white placeholder:text-white/28 focus:outline-none focus:ring-2 focus:ring-violet-500/50"
          />
        </div>

        {/* Full email preview */}
        <div>
          <div className="mb-1.5 flex items-center justify-between">
            <label className="text-[10px] font-medium uppercase tracking-[0.18em] text-white/45">
              Full Email Preview
            </label>
            <span className="text-[10px] text-white/30">Read-only — copy below to send</span>
          </div>
          <textarea
            readOnly
            value={buildBody(msg)}
            rows={8}
            className="w-full resize-none rounded-[14px] border border-white/10 bg-[#06050a] px-4 py-3 font-mono text-xs text-white/60 focus:outline-none"
          />
        </div>

        {/* How to send */}
        <div className="rounded-[16px] border border-white/8 bg-white/[0.02] px-4 py-3 text-xs text-white/45">
          <span className="text-white/65 font-medium">How to send: </span>
          Click <span className="text-white/80">"Copy Full Email"</span> → open your email client → paste into new email → send to {state.email}
        </div>

        <div className="flex flex-wrap justify-end gap-3">
          <button onClick={onClose} className="rounded-full border border-white/10 px-4 py-2 text-xs text-white/60">
            Cancel
          </button>
          <button
            onClick={openEmailClient}
            className="rounded-full border border-violet-400/25 bg-violet-500/10 px-4 py-2 text-xs font-medium text-violet-200 hover:bg-violet-500/18"
          >
            Open Email Client
          </button>
          <button
            onClick={copyFullEmail}
            className="rounded-full bg-violet-500 px-5 py-2 text-xs font-medium text-white hover:bg-violet-400"
          >
            {bodyCopied ? "Copied ✓" : "Copy Full Email"}
          </button>
        </div>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// One-click email helper (legacy row button)
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
// Main component
// ---------------------------------------------------------------------------

export function AdminPanelPage() {
  const { token, role, loading: authLoading, signOut } = useAuth();
  const navigate = useNavigate();
  const qc = useQueryClient();
  const [impersonation, setImpersonation] = useState<ImpersonateResponse | null>(null);
  const [notesClient, setNotesClient] = useState<AdminClientSummary | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);

  const [statusLoading, setStatusLoading] = useState<Record<string, boolean>>({});
  const [smsLoading, setSmsLoading] = useState<Record<string, boolean>>({});

  const [activationModal, setActivationModal] = useState<ActivationModalState | null>(null);
  const [emailModal, setEmailModal] = useState<EmailModalState | null>(null);

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
    } catch (err) {
      setActionError(`Status update failed: ${err instanceof Error ? err.message : String(err)}`);
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
    } catch (err) {
      setActionError(`SMS update failed: ${err instanceof Error ? err.message : String(err)}`);
    } finally {
      setSmsLoading((s) => ({ ...s, [client.id]: false }));
    }
  }

  async function handleActivate(client: AdminClientSummary) {
    setActivationModal({
      clientId: client.id,
      businessName: client.business_name,
      email: client.email ?? "",
      steps: [],
      done: false,
      error: null,
      result: null,
    });

    let resp: Response;
    try {
      resp = await fetch(`${API_BASE}/api/admin/clients/${client.id}/activate-stream`, {
        headers: { Authorization: `Bearer ${token!}` },
      });
    } catch (err) {
      setActivationModal((prev) =>
        prev ? { ...prev, error: `Network error: ${String(err)}`, done: true } : null,
      );
      return;
    }

    if (!resp.ok || !resp.body) {
      setActivationModal((prev) =>
        prev ? { ...prev, error: `HTTP ${resp.status}`, done: true } : null,
      );
      return;
    }

    const reader = resp.body.getReader();
    const decoder = new TextDecoder();
    let buffer = "";

    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      buffer += decoder.decode(value, { stream: true });
      const lines = buffer.split("\n");
      buffer = lines.pop() ?? "";
      for (const line of lines) {
        if (!line.startsWith("data: ")) continue;
        let data: Record<string, unknown>;
        try {
          data = JSON.parse(line.slice(6)) as Record<string, unknown>;
        } catch {
          continue;
        }
        if (data.event === "step") {
          const stepData = data as { step: string; status: StepStatus; message: string };
          setActivationModal((prev) => {
            if (!prev) return null;
            const steps = [...prev.steps];
            const idx = steps.findIndex((s) => s.step === stepData.step);
            const entry: ActivationStep = { step: stepData.step, status: stepData.status, message: stepData.message };
            if (idx >= 0) steps[idx] = entry;
            else steps.push(entry);
            return { ...prev, steps };
          });
        } else if (data.event === "done") {
          setActivationModal((prev) =>
            prev ? { ...prev, done: true, result: data as ActivationModalState["result"] } : null,
          );
          await qc.invalidateQueries({ queryKey: ["adminClients"] });
        } else if (data.event === "error") {
          setActivationModal((prev) =>
            prev ? { ...prev, error: String(data.message ?? "Unknown error"), done: true } : null,
          );
        }
      }
    }
  }

  async function handleOpenEmailModal(clientId: string, businessName: string, email: string, vapiPhone: string) {
    setEmailModal({
      clientId,
      businessName,
      email,
      vapiPhone,
      magicLink: null,
      personalMessage: "",
    });
    try {
      const data = await getMagicLink(token!, clientId);
      setEmailModal((prev) => (prev ? { ...prev, magicLink: data.magic_link } : null));
    } catch {
      // Magic link fetch failed — still show modal without it
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
  const activeClients = clients.filter((c) => c.onboarding_status === "active" && c.is_active).length;
  const pendingClients = clients.filter((c) => c.onboarding_status === "pending").length;
  const smsReady = clients.filter((c) => c.sms_enabled).length;
  const payingClients = clients.filter((c) => c.subscription_status === "active").length;

  return (
    <div className="min-h-screen bg-[#06050a] p-6 text-white">
      {/* Modals */}
      {notesClient ? (
        <NotesModal
          client={notesClient}
          onClose={() => setNotesClient(null)}
          onSave={(notes) => void handleToggleSms(notesClient, notes)}
        />
      ) : null}

      {activationModal ? (
        <ActivationModal
          state={activationModal}
          onClose={() => setActivationModal(null)}
          onEmailSetup={() => {
            const r = activationModal.result;
            void handleOpenEmailModal(
              activationModal.clientId,
              activationModal.businessName,
              activationModal.email,
              r?.vapi_phone_number ?? "",
            );
            setActivationModal(null);
          }}
        />
      ) : null}

      {emailModal ? (
        <EmailModal state={emailModal} onClose={() => setEmailModal(null)} />
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
        <div className="mb-6 grid grid-cols-2 gap-4 lg:grid-cols-5">
          {[
            { label: "Total Clients", value: totalClients },
            { label: "Active", value: activeClients },
            { label: "Pending Setup", value: pendingClients, highlight: pendingClients > 0 },
            { label: "Paying", value: `${payingClients} / ${totalClients}` },
            { label: "SMS Ready", value: `${smsReady} / ${totalClients}` },
          ].map((card) => (
            <div
              key={card.label}
              className={`rounded-[24px] border p-5 ${
                "highlight" in card && card.highlight
                  ? "border-amber-500/25 bg-amber-500/8"
                  : "border-white/10 bg-white/[0.03]"
              }`}
            >
              <p className="text-[10px] uppercase tracking-[0.22em] text-white/38">{card.label}</p>
              <p className={`mt-2 text-2xl font-semibold tracking-[-0.04em] ${"highlight" in card && card.highlight ? "text-amber-200" : "text-white"}`}>
                {card.value}
              </p>
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
              <table className="w-full min-w-[1200px] text-sm">
                <thead>
                  <tr className="border-b border-white/8 text-left text-[10px] uppercase tracking-[0.22em] text-white/35">
                    <th className="px-4 py-4">Business</th>
                    <th className="px-4 py-4">Status</th>
                    <th className="px-4 py-4">Payment</th>
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
                        {client.onboarding_status === "pending" ? (
                          <span className="inline-flex rounded-full bg-amber-500/15 px-3 py-1 text-xs font-medium text-amber-200">
                            Pending Setup
                          </span>
                        ) : (
                          <span
                            className={`inline-flex rounded-full px-3 py-1 text-xs font-medium ${
                              client.is_active
                                ? "bg-emerald-500/15 text-emerald-200"
                                : "bg-rose-500/15 text-rose-200"
                            }`}
                          >
                            {client.is_active ? "Active" : "Suspended"}
                          </span>
                        )}
                      </td>

                      <td className="px-4 py-4">
                        <SubscriptionBadge client={client} />
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
                          {/* Activate pending client — opens SSE progress modal */}
                          {client.onboarding_status === "pending" && (
                            <button
                              onClick={() => void handleActivate(client)}
                              className="rounded-full border border-emerald-400/30 bg-emerald-500/12 px-3 py-1.5 text-xs font-medium text-emerald-200 hover:bg-emerald-500/20"
                            >
                              Activate
                            </button>
                          )}

                          {/* Re-send welcome email for active clients */}
                          {client.onboarding_status !== "pending" && client.email && (
                            <button
                              onClick={() =>
                                void handleOpenEmailModal(
                                  client.id,
                                  client.business_name,
                                  client.email!,
                                  client.vapi_phone_number ?? "",
                                )
                              }
                              className="rounded-full border border-violet-400/20 bg-violet-500/8 px-3 py-1.5 text-xs font-medium text-violet-300 hover:bg-violet-500/16"
                            >
                              ✉ Welcome
                            </button>
                          )}

                          {/* View dashboard — only for active clients */}
                          {client.onboarding_status !== "pending" && (
                            <button
                              onClick={() => void handleViewDashboard(client)}
                              className="rounded-full border border-violet-400/25 bg-violet-500/10 px-3 py-1.5 text-xs font-medium text-violet-100 hover:bg-violet-500/18"
                            >
                              View
                            </button>
                          )}

                          {/* Suspend / Reactivate */}
                          {client.onboarding_status !== "pending" && (
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
                          )}

                          {/* SMS toggle */}
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

                          {/* One-click email (legacy) */}
                          {client.email ? (
                            <a
                              href={buildMailtoLink(client)}
                              title="Open pre-filled status email"
                              className="rounded-full border border-white/10 px-3 py-1.5 text-xs text-white/40 hover:text-white/70"
                            >
                              ✉ Status
                            </a>
                          ) : null}
                        </div>
                      </td>
                    </tr>
                  ))}
                  {clients.length === 0 ? (
                    <tr>
                      <td colSpan={9} className="px-4 py-10 text-center text-white/35">
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
