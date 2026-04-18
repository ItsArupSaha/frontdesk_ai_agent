import { useEffect, useRef, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Bot, Building2, Check, Clock3, Copy, FileUp, Link2, Phone, Wrench } from "lucide-react";
import { LoadingSpinner } from "../components/LoadingSpinner";
import { useAuth } from "../contexts/AuthContext";
import {
  getSettings,
  reingestKnowledgeBase,
  updateSettings,
  uploadKnowledgeDocument,
  type ClientSettings,
  type SettingsPayload,
} from "../lib/api";

const days = ["mon", "tue", "wed", "thu", "fri", "sat", "sun"] as const;
type Day = (typeof days)[number];

const dayLabels: Record<Day, string> = {
  mon: "Monday",
  tue: "Tuesday",
  wed: "Wednesday",
  thu: "Thursday",
  fri: "Friday",
  sat: "Saturday",
  sun: "Sunday",
};

const inputClass =
  "w-full rounded-[20px] border border-white/10 bg-[#0d0a16] px-4 py-3 text-sm text-white placeholder:text-white/28 focus:outline-none focus:ring-2 focus:ring-violet-500/60";

function Section({
  title,
  icon: Icon,
  children,
}: {
  title: string;
  icon: React.ComponentType<{ className?: string }>;
  children: React.ReactNode;
}) {
  return (
    <section className="rounded-[32px] border border-white/10 bg-[linear-gradient(180deg,rgba(22,17,37,0.74),rgba(11,9,20,0.84))] p-6 shadow-[0_18px_48px_rgba(0,0,0,0.24)]">
      <div className="flex items-center gap-3">
        <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-violet-500/12 text-violet-100">
          <Icon className="h-4.5 w-4.5" />
        </div>
        <h3 className="text-lg font-medium text-white">{title}</h3>
      </div>
      <div className="mt-6 space-y-4">{children}</div>
    </section>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <label className="mb-2 block text-[11px] uppercase tracking-[0.22em] text-white/38">{label}</label>
      {children}
    </div>
  );
}

// Big toggle switch for AI agent on/off
function AgentToggle({
  enabled,
  onChange,
  disabled,
}: {
  enabled: boolean;
  onChange: (v: boolean) => void;
  disabled?: boolean;
}) {
  return (
    <button
      type="button"
      onClick={() => onChange(!enabled)}
      disabled={disabled}
      className={`relative inline-flex h-8 w-14 items-center rounded-full transition-colors focus:outline-none disabled:opacity-50 ${
        enabled ? "bg-emerald-500" : "bg-white/15"
      }`}
      aria-checked={enabled}
      role="switch"
    >
      <span
        className={`inline-block h-6 w-6 rounded-full bg-white shadow-md transition-transform ${
          enabled ? "translate-x-7" : "translate-x-1"
        }`}
      />
    </button>
  );
}

export default function SettingsPage() {
  const { token, clientId } = useAuth();
  const qc = useQueryClient();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [saved, setSaved] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  // Form state — mirrors ClientSettings fields
  const [businessName, setBusinessName] = useState("");
  const [botName, setBotName] = useState("");
  const [mainPhone, setMainPhone] = useState("");
  const [emergencyPhone, setEmergencyPhone] = useState("");
  const [isAiEnabled, setIsAiEnabled] = useState(true);
  const [serviceArea, setServiceArea] = useState("");
  const [googleReviewLink, setGoogleReviewLink] = useState("");
  const [services, setServices] = useState<string[]>([]);
  const [serviceInput, setServiceInput] = useState("");
  const [workingHours, setWorkingHours] = useState<Record<string, string>>({});
  const [jobberKey, setJobberKey] = useState("");
  const [housecallKey, setHousecallKey] = useState("");

  // Copy-number state
  const [numberCopied, setNumberCopied] = useState(false);

  // KB upload state
  const [uploadStatus, setUploadStatus] = useState<"idle" | "uploading" | "done" | "error">("idle");
  const [uploadMessage, setUploadMessage] = useState("");
  const [reingestStatus, setReingestStatus] = useState<"idle" | "loading" | "done" | "error">("idle");

  const query = useQuery<ClientSettings>({
    queryKey: ["settings", clientId],
    queryFn: () => getSettings(token!, clientId!),
    enabled: !!token && !!clientId,
  });

  useEffect(() => {
    if (!query.data) return;
    setBusinessName(query.data.business_name ?? "");
    setBotName(query.data.bot_name ?? "");
    setMainPhone(query.data.main_phone_number ?? "");
    setEmergencyPhone(query.data.emergency_phone_number ?? "");
    setIsAiEnabled(query.data.is_ai_enabled ?? true);
    setServiceArea(query.data.service_area_description ?? "");
    setGoogleReviewLink(query.data.google_review_link ?? "");
    setServices(query.data.services_offered ?? []);
    setWorkingHours(query.data.working_hours ?? {});
  }, [query.data]);

  const mutation = useMutation({
    mutationFn: (payload: SettingsPayload) => updateSettings(token!, clientId!, payload),
    onSuccess: () => {
      setSaved(true);
      setErrorMessage(null);
      void qc.invalidateQueries({ queryKey: ["settings", clientId] });
      setTimeout(() => setSaved(false), 3000);
    },
    onError: (error: Error) => {
      setErrorMessage(error.message);
    },
  });

  // Immediate AI toggle (separate mutation so it fires instantly without full form submit)
  const aiToggleMutation = useMutation({
    mutationFn: (enabled: boolean) => updateSettings(token!, clientId!, { is_ai_enabled: enabled }),
    onSuccess: (data) => {
      setIsAiEnabled(data.is_ai_enabled ?? true);
      void qc.invalidateQueries({ queryKey: ["settings", clientId] });
    },
    onError: () => setErrorMessage("Failed to toggle agent — please try again."),
  });

  function addService(event: React.KeyboardEvent<HTMLInputElement>) {
    if (event.key === "Enter" && serviceInput.trim()) {
      event.preventDefault();
      const value = serviceInput.trim().toLowerCase();
      if (!services.includes(value)) setServices((current) => [...current, value]);
      setServiceInput("");
    }
  }

  function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    const payload: SettingsPayload = {};
    if (businessName) payload.business_name = businessName;
    if (botName) payload.bot_name = botName;
    if (mainPhone) payload.main_phone_number = mainPhone;
    if (emergencyPhone) payload.emergency_phone_number = emergencyPhone;
    if (serviceArea) payload.service_area_description = serviceArea;
    if (googleReviewLink) payload.google_review_link = googleReviewLink;
    if (services.length) payload.services_offered = services;
    if (Object.keys(workingHours).length) payload.working_hours = workingHours;
    if (jobberKey) payload.jobber_api_key = jobberKey;
    if (housecallKey) payload.housecall_pro_api_key = housecallKey;
    mutation.mutate(payload);
  }

  async function handleFileUpload(file: File) {
    if (!token || !clientId) return;
    setUploadStatus("uploading");
    setUploadMessage("");
    try {
      const result = await uploadKnowledgeDocument(token, clientId, file);
      setUploadStatus("done");
      setUploadMessage(result.message);
    } catch (err) {
      setUploadStatus("error");
      setUploadMessage(err instanceof Error ? err.message : "Upload failed");
    }
  }

  async function handleReingest() {
    if (!token || !clientId) return;
    setReingestStatus("loading");
    try {
      await reingestKnowledgeBase(token, clientId);
      setReingestStatus("done");
      void qc.invalidateQueries({ queryKey: ["settings", clientId] });
      setTimeout(() => setReingestStatus("idle"), 4000);
    } catch {
      setReingestStatus("error");
    }
  }

  if (!token || !clientId || query.isLoading) {
    return (
      <div className="flex h-full items-center justify-center">
        <LoadingSpinner size="lg" />
      </div>
    );
  }

  const settings = query.data;
  const kbLastIngested = settings?.kb_last_ingested_at
    ? new Date(settings.kb_last_ingested_at).toLocaleDateString(undefined, {
        month: "short",
        day: "numeric",
        year: "numeric",
      })
    : null;

  return (
    <div className="mx-auto max-w-7xl space-y-6 p-6 md:p-8">
      {/* Page header */}
      <section className="rounded-[32px] border border-white/10 bg-[linear-gradient(135deg,rgba(70,56,190,0.2),rgba(16,12,28,0.92)_48%,rgba(24,19,39,0.95))] p-7 shadow-[0_28px_80px_rgba(0,0,0,0.22)]">
        <p className="text-[11px] uppercase tracking-[0.28em] text-white/40">Business Controls</p>
        <h2 className="mt-3 text-[clamp(2rem,4vw,3.1rem)] font-semibold tracking-[-0.06em] text-white">
          Configure your AI receptionist.
        </h2>
        <p className="mt-3 max-w-2xl text-sm leading-7 text-white/60">
          Toggle the agent on or off, update coverage, scheduling, integrations, and knowledge base.
        </p>
      </section>

      {/* Your AI phone number + call forwarding guide */}
      <section className="rounded-[32px] border border-violet-400/20 bg-[linear-gradient(135deg,rgba(70,56,190,0.14),rgba(11,9,20,0.96))] p-6 shadow-[0_18px_48px_rgba(0,0,0,0.24)]">
        <div className="flex items-center gap-3">
          <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-violet-500/12 text-violet-100">
            <Phone className="h-4.5 w-4.5" />
          </div>
          <div>
            <h3 className="text-lg font-medium text-white">Your AI Phone Number</h3>
            <p className="text-xs text-white/40">Forward your business calls to this number to activate the agent</p>
          </div>
        </div>

        {settings?.vapi_phone_number ? (
          <div className="mt-5">
            {/* Big copyable number */}
            <div className="flex items-center gap-3">
              <span className="font-mono text-3xl font-semibold tracking-wide text-white">
                {settings.vapi_phone_number}
              </span>
              <button
                type="button"
                onClick={async () => {
                  await navigator.clipboard.writeText(settings.vapi_phone_number!);
                  setNumberCopied(true);
                  setTimeout(() => setNumberCopied(false), 2500);
                }}
                className="flex items-center gap-1.5 rounded-full border border-violet-400/25 bg-violet-500/10 px-3 py-1.5 text-xs text-violet-200 hover:bg-violet-500/18"
              >
                {numberCopied ? <Check className="h-3.5 w-3.5 text-emerald-300" /> : <Copy className="h-3.5 w-3.5" />}
                {numberCopied ? "Copied!" : "Copy"}
              </button>
            </div>

            {/* Call forwarding guide */}
            <div className="mt-5 rounded-[22px] border border-white/8 bg-white/[0.03] p-5">
              <p className="mb-4 text-sm font-medium text-white/80">How to set up call forwarding</p>
              <div className="space-y-4 text-sm text-white/60">
                <div>
                  <p className="mb-1 font-medium text-white/80">iPhone</p>
                  <p>Settings → Phone → Call Forwarding → turn On → enter your AI number above</p>
                </div>
                <div>
                  <p className="mb-1 font-medium text-white/80">Android</p>
                  <p>Phone app → ⋮ Menu → Settings → Calling accounts → Call forwarding → Always forward → enter your AI number</p>
                </div>
                <div>
                  <p className="mb-1 font-medium text-white/80">Landline or VoIP (most US carriers)</p>
                  <p>
                    Dial <span className="font-mono text-white/90">*72</span> then your AI number, then press Call.
                    To cancel forwarding later, dial <span className="font-mono text-white/90">*73</span>.
                  </p>
                </div>
                <div>
                  <p className="mb-1 font-medium text-white/80">Google Voice</p>
                  <p>voice.google.com → Settings → Calls → Call forwarding → add your AI number</p>
                </div>
              </div>
              <p className="mt-4 text-xs text-amber-300/80">
                Make sure to set <strong>Always forward</strong> (not "forward when busy/no answer") so every call reaches your AI agent.
              </p>
            </div>
          </div>
        ) : (
          <div className="mt-4 rounded-[20px] border border-amber-500/20 bg-amber-500/8 px-5 py-4 text-sm text-amber-200/80">
            Your phone number is being provisioned — it will appear here once setup is complete (usually within a few minutes of account activation).
          </div>
        )}
      </section>

      {/* AI Agent toggle — top priority, standalone card */}
      <section className="rounded-[32px] border border-white/10 bg-[linear-gradient(180deg,rgba(22,17,37,0.74),rgba(11,9,20,0.84))] p-6 shadow-[0_18px_48px_rgba(0,0,0,0.24)]">
        <div className="flex items-center gap-3">
          <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-violet-500/12 text-violet-100">
            <Bot className="h-4.5 w-4.5" />
          </div>
          <h3 className="text-lg font-medium text-white">AI Agent</h3>
        </div>
        <div className="mt-6 flex items-start justify-between gap-6">
          <div>
            <p className="text-sm font-medium text-white">
              {isAiEnabled ? "Agent is active" : "Agent is paused"}
            </p>
            <p className="mt-1 max-w-md text-sm text-white/50">
              {isAiEnabled
                ? "Your AI receptionist is answering calls. Toggle off to forward calls directly to your main phone number."
                : "Calls are being forwarded to your main phone number. Toggle on to reactivate the AI receptionist."}
            </p>
            {!isAiEnabled && !settings?.main_phone_number ? (
              <p className="mt-2 text-xs text-amber-300">
                Warning: no main phone number set. Set one below so calls have somewhere to go.
              </p>
            ) : null}
          </div>
          <div className="flex shrink-0 flex-col items-end gap-2">
            <AgentToggle
              enabled={isAiEnabled}
              onChange={(v) => {
                setIsAiEnabled(v);
                aiToggleMutation.mutate(v);
              }}
              disabled={aiToggleMutation.isPending}
            />
            <span className={`text-xs ${isAiEnabled ? "text-emerald-300" : "text-white/40"}`}>
              {aiToggleMutation.isPending ? "Saving…" : isAiEnabled ? "On" : "Off"}
            </span>
          </div>
        </div>
      </section>

      <form onSubmit={handleSubmit} className="space-y-6">
        <div className="grid gap-6 xl:grid-cols-2">
          <Section title="Business Info" icon={Building2}>
            <Field label="Business Name">
              <input type="text" value={businessName} onChange={(e) => setBusinessName(e.target.value)} className={inputClass} />
            </Field>
            <Field label="Bot / Receptionist Name">
              <input
                type="text"
                value={botName}
                onChange={(e) => setBotName(e.target.value)}
                className={inputClass}
                placeholder="e.g. Alex from PlumbRight"
              />
            </Field>
            <Field label="Main Phone Number (forwarding destination when AI is off)">
              <input
                type="tel"
                value={mainPhone}
                onChange={(e) => setMainPhone(e.target.value)}
                className={inputClass}
                placeholder="+15550000000"
              />
            </Field>
            <Field label="Emergency Phone Number">
              <input
                type="tel"
                value={emergencyPhone}
                onChange={(e) => setEmergencyPhone(e.target.value)}
                className={inputClass}
                placeholder="+15550000000"
              />
            </Field>
            <Field label="Service Area">
              <textarea
                value={serviceArea}
                onChange={(e) => setServiceArea(e.target.value)}
                rows={4}
                className={`${inputClass} resize-none`}
                placeholder="Serving Brooklyn, Queens, and Manhattan, New York"
              />
            </Field>
          </Section>

          <Section title="Services Offered" icon={Wrench}>
            <div className="flex flex-wrap gap-2">
              {services.map((service) => (
                <span
                  key={service}
                  className="flex items-center gap-1 rounded-full border border-violet-400/20 bg-violet-500/10 px-3 py-1 text-sm text-violet-200"
                >
                  {service}
                  <button
                    type="button"
                    onClick={() => setServices((current) => current.filter((item) => item !== service))}
                    className="ml-1 text-violet-300/70 hover:text-violet-200"
                  >
                    ×
                  </button>
                </span>
              ))}
            </div>
            <input
              type="text"
              value={serviceInput}
              onChange={(e) => setServiceInput(e.target.value)}
              onKeyDown={addService}
              placeholder="Type a service and press Enter…"
              className={inputClass}
            />
            <Field label="Google Review Link">
              <input
                type="url"
                value={googleReviewLink}
                onChange={(e) => setGoogleReviewLink(e.target.value)}
                className={inputClass}
                placeholder="https://g.page/r/…"
              />
            </Field>
          </Section>
        </div>

        <div className="grid gap-6 xl:grid-cols-[1.2fr_0.8fr]">
          <Section title="Working Hours" icon={Clock3}>
            <div className="grid gap-3">
              {days.map((day) => (
                <div key={day} className="grid gap-3 rounded-[24px] border border-white/10 bg-white/[0.03] p-4 md:grid-cols-[140px_1fr] md:items-center">
                  <span className="text-sm text-white/62">{dayLabels[day]}</span>
                  <input
                    type="text"
                    value={workingHours[day] ?? ""}
                    onChange={(e) =>
                      setWorkingHours((current) => ({ ...current, [day]: e.target.value }))
                    }
                    placeholder="8am-6pm or closed"
                    className={inputClass}
                  />
                </div>
              ))}
            </div>
          </Section>

          <Section title="Integrations" icon={Link2}>
            <button
              type="button"
              onClick={() => {
                window.location.href = `/auth/google/connect?client_id=${clientId}`;
              }}
              className="rounded-[20px] border border-violet-400/20 bg-violet-500/10 px-4 py-3 text-sm text-violet-200 transition-colors hover:bg-violet-500/16"
            >
              Reconnect Google Calendar
            </button>
            <Field label="Jobber API Key">
              <input
                type="password"
                value={jobberKey}
                onChange={(e) => setJobberKey(e.target.value)}
                className={inputClass}
                placeholder="Leave blank to keep existing"
                autoComplete="off"
              />
            </Field>
            <Field label="Housecall Pro API Key">
              <input
                type="password"
                value={housecallKey}
                onChange={(e) => setHousecallKey(e.target.value)}
                className={inputClass}
                placeholder="Leave blank to keep existing"
                autoComplete="off"
              />
            </Field>
          </Section>
        </div>

        {errorMessage ? (
          <p className="rounded-[24px] border border-rose-500/20 bg-rose-500/10 p-4 text-sm text-rose-200">
            {errorMessage}
          </p>
        ) : null}

        <div className="flex items-center gap-4">
          <button
            type="submit"
            disabled={mutation.isPending}
            className="rounded-full bg-violet-500 px-6 py-3 text-sm font-medium text-white transition-colors hover:bg-violet-400 disabled:opacity-50"
          >
            {mutation.isPending ? "Saving…" : "Save Settings"}
          </button>
          {saved ? <span className="text-sm text-emerald-300">Settings saved.</span> : null}
        </div>
      </form>

      {/* Knowledge Base section */}
      <section className="rounded-[32px] border border-white/10 bg-[linear-gradient(180deg,rgba(22,17,37,0.74),rgba(11,9,20,0.84))] p-6 shadow-[0_18px_48px_rgba(0,0,0,0.24)]">
        <div className="flex items-center gap-3">
          <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-violet-500/12 text-violet-100">
            <FileUp className="h-4.5 w-4.5" />
          </div>
          <div>
            <h3 className="text-lg font-medium text-white">Knowledge Base</h3>
            {kbLastIngested ? (
              <p className="text-xs text-white/38">Last updated {kbLastIngested}</p>
            ) : (
              <p className="text-xs text-amber-300/70">Not yet ingested</p>
            )}
          </div>
        </div>
        <div className="mt-6 space-y-4">
          <p className="text-sm text-white/55">
            Upload company documents (PDFs, text files) so your AI agent can answer caller questions
            accurately. After updating settings above, click &ldquo;Re-sync from Settings&rdquo; to refresh.
          </p>

          {/* File upload dropzone */}
          <div
            onClick={() => fileInputRef.current?.click()}
            onDragOver={(e) => e.preventDefault()}
            onDrop={(e) => {
              e.preventDefault();
              const file = e.dataTransfer.files[0];
              if (file) void handleFileUpload(file);
            }}
            className="flex cursor-pointer flex-col items-center justify-center gap-3 rounded-[24px] border border-dashed border-white/18 bg-white/[0.02] p-8 text-center transition-colors hover:border-violet-400/30 hover:bg-violet-500/5"
          >
            <FileUp className="h-8 w-8 text-white/25" />
            <div>
              <p className="text-sm text-white/60">Drag a file here or click to browse</p>
              <p className="mt-1 text-xs text-white/35">PDF, TXT, MD — max 5 MB</p>
            </div>
            {uploadStatus === "uploading" ? (
              <LoadingSpinner size="sm" />
            ) : null}
          </div>
          <input
            ref={fileInputRef}
            type="file"
            accept=".pdf,.txt,.md"
            className="hidden"
            onChange={(e) => {
              const file = e.target.files?.[0];
              if (file) void handleFileUpload(file);
              e.target.value = "";
            }}
          />

          {uploadStatus === "done" ? (
            <p className="text-sm text-emerald-300">{uploadMessage}</p>
          ) : uploadStatus === "error" ? (
            <p className="text-sm text-rose-300">{uploadMessage}</p>
          ) : null}

          {/* Reingest from settings */}
          <div className="flex items-center gap-4">
            <button
              type="button"
              onClick={() => void handleReingest()}
              disabled={reingestStatus === "loading"}
              className="rounded-full border border-violet-400/20 bg-violet-500/8 px-5 py-2.5 text-sm text-violet-200 hover:bg-violet-500/15 disabled:opacity-50"
            >
              {reingestStatus === "loading" ? "Syncing…" : "Re-sync from Settings"}
            </button>
            {reingestStatus === "done" ? (
              <span className="text-sm text-emerald-300">Knowledge base synced.</span>
            ) : reingestStatus === "error" ? (
              <span className="text-sm text-rose-300">Sync failed — try again.</span>
            ) : null}
          </div>
          <p className="text-xs text-white/35">
            Re-sync embeds your current services, hours, pricing, and service area into the AI&apos;s memory.
          </p>
        </div>
      </section>
    </div>
  );
}
