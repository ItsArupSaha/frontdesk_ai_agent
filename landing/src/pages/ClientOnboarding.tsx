import { useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { LoadingSpinner } from "../components/LoadingSpinner";
import { useAuth } from "../contexts/AuthContext";
import { createClient, type ClientCreatePayload, type ClientCreateResponse } from "../lib/api";

type WorkingDay = {
  enabled: boolean;
  open: string;
  close: string;
};

type WorkingHours = Record<string, WorkingDay>;

type FormData = {
  business_name: string;
  email: string;
  emergency_phone: string;
  services_offered: string[];
  working_hours: WorkingHours;
  service_area_description: string;
  zip_codes: string;
  area_code: string;
  pricing_ranges: Record<string, string>;
  calendar_connected: boolean;
  fsm_type: string;
  jobber_api_key: string;
  housecall_pro_api_key: string;
};

const serviceSuggestions = [
  "Drain Cleaning",
  "Pipe Repair",
  "Water Heater",
  "Toilet Repair",
  "Faucet Repair",
  "Gas Piping",
  "Sewer Line",
  "AC Repair",
  "Furnace Repair",
  "Electrical Panel",
  "Outlet Wiring",
];

const days = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];

const defaultHours: WorkingHours = {
  Mon: { enabled: true, open: "08:00", close: "18:00" },
  Tue: { enabled: true, open: "08:00", close: "18:00" },
  Wed: { enabled: true, open: "08:00", close: "18:00" },
  Thu: { enabled: true, open: "08:00", close: "18:00" },
  Fri: { enabled: true, open: "08:00", close: "18:00" },
  Sat: { enabled: true, open: "09:00", close: "14:00" },
  Sun: { enabled: false, open: "09:00", close: "17:00" },
};

const initialForm: FormData = {
  business_name: "",
  email: "",
  emergency_phone: "",
  services_offered: [],
  working_hours: defaultHours,
  service_area_description: "",
  zip_codes: "",
  area_code: "",
  pricing_ranges: {},
  calendar_connected: false,
  fsm_type: "none",
  jobber_api_key: "",
  housecall_pro_api_key: "",
};

const launchSteps = [
  "Creating account...",
  "Setting up voice agent...",
  "Provisioning phone number...",
  "Building knowledge base...",
  "Finalizing...",
];

const inputClass =
  "mt-1.5 block w-full rounded-[16px] border border-white/10 bg-white/[0.04] px-4 py-3 text-sm text-white placeholder:text-white/25 focus:border-violet-400/40 focus:outline-none focus:ring-2 focus:ring-violet-500/20";

function isValidEmail(email: string) {
  return /^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email);
}

function isValidE164(phone: string) {
  return /^\+1[2-9]\d{9}$/.test(phone);
}

function isValidAreaCode(areaCode: string) {
  return /^\d{3}$/.test(areaCode);
}

function ReviewRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-start justify-between gap-4 border-t border-white/8 py-3 first:border-t-0 first:pt-0 last:pb-0">
      <span className="text-sm font-medium text-white/48">{label}</span>
      <span className="text-right text-sm text-white/82">{value}</span>
    </div>
  );
}

function SectionHeader({
  step,
  title,
  description,
}: {
  step: string;
  title: string;
  description?: string;
}) {
  return (
    <div className="mb-6">
      <p className="text-[11px] uppercase tracking-[0.28em] text-violet-200/65">{step}</p>
      <h2 className="mt-3 text-2xl font-semibold tracking-[-0.04em] text-white">{title}</h2>
      {description ? <p className="mt-2 max-w-2xl text-sm leading-7 text-white/52">{description}</p> : null}
    </div>
  );
}

function StepCard({ children }: { children: React.ReactNode }) {
  return (
    <div className="overflow-hidden rounded-[28px] border border-white/10 bg-[linear-gradient(180deg,rgba(16,16,22,0.98),rgba(10,10,14,0.96))] shadow-[0_0_0_1px_rgba(255,255,255,0.02),0_24px_80px_rgba(0,0,0,0.32),0_0_40px_rgba(124,58,237,0.08)]">
      <div className="h-px bg-[linear-gradient(90deg,transparent,rgba(139,92,246,0.5),transparent)]" />
      <div className="p-6 sm:p-8">{children}</div>
    </div>
  );
}

export default function ClientOnboardingPage() {
  const { token } = useAuth();
  const navigate = useNavigate();
  const serviceInputRef = useRef<HTMLInputElement>(null);
  const [step, setStep] = useState(1);
  const [form, setForm] = useState<FormData>(initialForm);
  const [serviceInput, setServiceInput] = useState("");
  const [stepErrors, setStepErrors] = useState<string[]>([]);
  const [launching, setLaunching] = useState(false);
  const [launchStep, setLaunchStep] = useState(0);
  const [launchError, setLaunchError] = useState<string | null>(null);
  const [result, setResult] = useState<ClientCreateResponse | null>(null);

  function setField<K extends keyof FormData>(key: K, value: FormData[K]) {
    setForm((current) => ({ ...current, [key]: value }));
  }

  function addService(raw: string) {
    const service = raw.trim();
    if (!service || form.services_offered.includes(service)) return;
    setForm((current) => ({
      ...current,
      services_offered: [...current.services_offered, service],
    }));
    setServiceInput("");
    serviceInputRef.current?.focus();
  }

  function removeService(service: string) {
    setForm((current) => ({
      ...current,
      services_offered: current.services_offered.filter((item) => item !== service),
      pricing_ranges: Object.fromEntries(
        Object.entries(current.pricing_ranges).filter(([key]) => key !== service),
      ),
    }));
  }

  function setDayField(day: string, field: keyof WorkingDay, value: boolean | string) {
    setForm((current) => ({
      ...current,
      working_hours: {
        ...current.working_hours,
        [day]: { ...current.working_hours[day], [field]: value },
      },
    }));
  }

  function validateStep(currentStep: number) {
    const errors: string[] = [];
    if (currentStep === 1) {
      if (!form.business_name.trim()) errors.push("Business name is required.");
      if (!form.email.trim()) errors.push("Email is required.");
      else if (!isValidEmail(form.email)) errors.push("Enter a valid email address.");
      if (!form.emergency_phone.trim()) errors.push("Emergency phone is required.");
      else if (!isValidE164(form.emergency_phone)) {
        errors.push("Phone must be US E.164 format: +1XXXXXXXXXX");
      }
      if (form.services_offered.length === 0) errors.push("Add at least one service.");
    }
    if (currentStep === 3) {
      if (!form.area_code.trim()) errors.push("Area code is required.");
      else if (!isValidAreaCode(form.area_code)) errors.push("Area code must be 3 digits.");
    }
    return errors;
  }

  function handleNext() {
    const errors = validateStep(step);
    if (errors.length > 0) {
      setStepErrors(errors);
      return;
    }
    setStepErrors([]);
    setStep((current) => current + 1);
  }

  async function handleLaunch() {
    if (!token) return;
    setLaunching(true);
    setLaunchError(null);
    setLaunchStep(0);

    const interval = window.setInterval(() => {
      setLaunchStep((current) => (current < launchSteps.length - 1 ? current + 1 : current));
    }, 1500);

    const workingHoursPayload = Object.fromEntries(
      days.map((day) => [
        day,
        form.working_hours[day]?.enabled
          ? {
              open: form.working_hours[day].open,
              close: form.working_hours[day].close,
            }
          : null,
      ]),
    );

    const payload: ClientCreatePayload = {
      business_name: form.business_name.trim(),
      email: form.email.trim().toLowerCase(),
      emergency_phone: form.emergency_phone.trim(),
      services_offered: form.services_offered,
      working_hours: workingHoursPayload,
      service_area_description: form.service_area_description.trim(),
      zip_codes: form.zip_codes
        .split(",")
        .map((value) => value.trim())
        .filter(Boolean),
      area_code: form.area_code.trim(),
      pricing_ranges: form.pricing_ranges,
      fsm_type: form.fsm_type === "none" ? null : form.fsm_type,
      jobber_api_key: form.fsm_type === "jobber" ? form.jobber_api_key || null : null,
      housecall_pro_api_key:
        form.fsm_type === "housecall_pro" ? form.housecall_pro_api_key || null : null,
    };

    try {
      const response = await createClient(token, payload);
      window.clearInterval(interval);
      setLaunchStep(launchSteps.length - 1);
      window.setTimeout(() => setResult(response), 500);
    } catch (error: unknown) {
      window.clearInterval(interval);
      setLaunchError(error instanceof Error ? error.message : String(error));
    } finally {
      setLaunching(false);
    }
  }

  if (result) {
    const formatted = result.phone_number.replace(/^\+1(\d{3})(\d{3})(\d{4})$/, "+1 ($1) $2-$3");
    return (
      <div className="min-h-screen bg-[#06050a] px-4 py-10 text-white sm:px-6">
        <div className="mx-auto max-w-2xl">
          <StepCard>
            <div className="text-center">
              <div className="mx-auto mb-5 flex h-20 w-20 items-center justify-center rounded-full border border-emerald-400/20 bg-emerald-500/10 text-3xl text-emerald-300">
                ✓
              </div>
              <p className="text-[11px] uppercase tracking-[0.28em] text-emerald-200/65">Provisioned</p>
              <h1 className="mt-3 text-3xl font-semibold tracking-[-0.05em] text-white">Agent is live!</h1>
              <p className="mx-auto mt-3 max-w-lg text-sm leading-7 text-white/55">
                {form.business_name} is now set up and ready to receive calls.
              </p>
              <div className="mx-auto mt-8 max-w-md rounded-[22px] border border-violet-400/15 bg-white/[0.03] p-5">
                <p className="text-[11px] font-semibold uppercase tracking-[0.24em] text-violet-200/70">
                  Phone Number To Forward Calls To
                </p>
                <p className="mt-3 text-3xl font-semibold tracking-[-0.05em] text-white">{formatted}</p>
              </div>
              <button
                onClick={() => navigate("/admin")}
                className="mt-8 rounded-full border border-violet-400/25 bg-violet-500/10 px-5 py-3 text-sm font-medium text-violet-100"
              >
                Back to Admin Panel
              </button>
            </div>
          </StepCard>
        </div>
      </div>
    );
  }

  if (launching || launchError) {
    return (
      <div className="min-h-screen bg-[#06050a] px-4 py-10 text-white sm:px-6">
        <div className="mx-auto max-w-xl">
          <StepCard>
            <div className="text-center">
              {launching ? (
                <>
                  <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full border border-violet-400/20 bg-violet-500/10">
                    <LoadingSpinner size="lg" className="mx-auto" />
                  </div>
                  <h2 className="mt-6 text-2xl font-semibold tracking-[-0.04em] text-white">
                    Provisioning Client
                  </h2>
                  <p className="mt-2 text-sm text-white/55">{launchSteps[launchStep]}</p>
                  <div className="mt-8 space-y-2 text-left">
                    {launchSteps.map((label, index) => (
                      <div
                        key={index}
                        className={`rounded-[14px] border px-4 py-3 text-sm ${
                          index < launchStep
                            ? "border-emerald-400/15 bg-emerald-500/10 text-emerald-200"
                            : index === launchStep
                              ? "border-violet-400/25 bg-violet-500/10 text-violet-100"
                              : "border-white/8 bg-white/[0.02] text-white/35"
                        }`}
                      >
                        {index < launchStep ? "✓ " : index === launchStep ? "→ " : "○ "}
                        {label}
                      </div>
                    ))}
                  </div>
                </>
              ) : (
                <>
                  <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full border border-rose-400/20 bg-rose-500/10 text-2xl text-rose-200">
                    ✕
                  </div>
                  <h2 className="mt-6 text-2xl font-semibold tracking-[-0.04em] text-white">
                    Launch failed
                  </h2>
                  <p className="mt-3 text-sm leading-7 text-white/55">{launchError}</p>
                  <button
                    onClick={() => {
                      setLaunchError(null);
                      setStep(7);
                    }}
                    className="mt-8 rounded-full border border-violet-400/25 bg-violet-500/10 px-5 py-3 text-sm font-medium text-violet-100"
                  >
                    Retry
                  </button>
                </>
              )}
            </div>
          </StepCard>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#06050a] px-4 py-8 text-white sm:px-6">
      <div className="mx-auto max-w-6xl">
        <button
          onClick={() => navigate("/admin")}
          className="mb-6 inline-flex items-center rounded-full border border-white/10 px-4 py-2 text-xs uppercase tracking-[0.2em] text-white/55 transition-colors hover:border-white/20 hover:text-white/85"
        >
          ← Admin Panel
        </button>

        <div className="mb-8 grid gap-6 lg:grid-cols-[0.88fr_1.12fr]">
          <div>
            <p className="text-[11px] uppercase tracking-[0.32em] text-violet-200/65">Onboarding</p>
            <h1 className="mt-4 text-4xl font-semibold tracking-[-0.06em] text-white">
              Add New Client
            </h1>
            <p className="mt-4 max-w-xl text-sm leading-7 text-white/55">
              Complete all seven steps to provision a new agent with business context,
              scheduling rules, service area coverage, and integrations.
            </p>
          </div>

          <div className="rounded-[28px] border border-white/10 bg-white/[0.03] p-6 shadow-[0_24px_80px_rgba(0,0,0,0.24)]">
            <div className="mb-3 flex items-center justify-between text-xs uppercase tracking-[0.22em] text-white/38">
              <span>Progress</span>
              <span>{Math.round((step / 7) * 100)}%</span>
            </div>
            <div className="h-2 overflow-hidden rounded-full bg-white/8">
              <div
                className="h-full rounded-full bg-[linear-gradient(135deg,#7C3AED_0%,#8B5CF6_100%)] transition-all duration-300"
                style={{ width: `${(step / 7) * 100}%` }}
              />
            </div>
            <div className="mt-5 grid grid-cols-7 gap-2">
              {Array.from({ length: 7 }).map((_, index) => {
                const current = index + 1;
                const active = current === step;
                const done = current < step;
                return (
                  <div
                    key={current}
                    className={`rounded-[14px] border px-2 py-3 text-center text-xs font-medium ${
                      active
                        ? "border-violet-400/30 bg-violet-500/12 text-violet-100"
                        : done
                          ? "border-emerald-400/18 bg-emerald-500/10 text-emerald-200"
                          : "border-white/8 bg-white/[0.02] text-white/35"
                    }`}
                  >
                    {current}
                  </div>
                );
              })}
            </div>
          </div>
        </div>

        {stepErrors.length > 0 ? (
          <div className="mb-6 rounded-[20px] border border-rose-500/20 bg-rose-500/10 p-4 text-sm text-rose-200">
            {stepErrors.map((error, index) => (
              <div key={index}>{error}</div>
            ))}
          </div>
        ) : null}

        <StepCard>
          {step === 1 ? (
            <div>
              <SectionHeader
                step="Step 1"
                title="Business Basics"
                description="Define the business identity, primary contact, and the service catalog the receptionist should understand."
              />
              <div className="grid gap-5 md:grid-cols-2">
                <label className="block">
                  <span className="text-sm font-medium text-white/78">Business name *</span>
                  <input
                    type="text"
                    value={form.business_name}
                    onChange={(e) => setField("business_name", e.target.value)}
                    className={inputClass}
                    placeholder="Brooklyn Plumbing Co"
                  />
                </label>
                <label className="block">
                  <span className="text-sm font-medium text-white/78">Client email *</span>
                  <input
                    type="email"
                    value={form.email}
                    onChange={(e) => setField("email", e.target.value)}
                    className={inputClass}
                    placeholder="owner@business.com"
                  />
                </label>
              </div>

              <label className="mt-5 block">
                <span className="text-sm font-medium text-white/78">Emergency contact phone *</span>
                <p className="mt-1 text-xs text-white/35">Format: +1XXXXXXXXXX</p>
                <input
                  type="tel"
                  value={form.emergency_phone}
                  onChange={(e) => setField("emergency_phone", e.target.value)}
                  className={inputClass}
                  placeholder="+17185551234"
                />
              </label>

              <div className="mt-6">
                <span className="text-sm font-medium text-white/78">Services offered *</span>
                <p className="mt-1 text-xs text-white/35">
                  Add the exact service names the agent should recognize during calls.
                </p>

                {form.services_offered.length > 0 ? (
                  <div className="mt-4 flex flex-wrap gap-2">
                    {form.services_offered.map((service) => (
                      <span
                        key={service}
                        className="inline-flex items-center gap-2 rounded-full border border-violet-400/18 bg-violet-500/10 px-3 py-1.5 text-xs font-medium text-violet-100"
                      >
                        {service}
                        <button
                          type="button"
                          onClick={() => removeService(service)}
                          className="leading-none text-violet-200/70 hover:text-rose-200"
                        >
                          ×
                        </button>
                      </span>
                    ))}
                  </div>
                ) : null}

                <div className="mt-4 flex gap-2">
                  <input
                    ref={serviceInputRef}
                    type="text"
                    value={serviceInput}
                    onChange={(e) => setServiceInput(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter") {
                        e.preventDefault();
                        addService(serviceInput);
                      }
                    }}
                    className={`${inputClass} mt-0 flex-1`}
                    placeholder="Drain Cleaning"
                  />
                  <button
                    type="button"
                    onClick={() => addService(serviceInput)}
                    className="rounded-[16px] border border-violet-400/25 bg-violet-500/10 px-4 text-sm font-semibold text-violet-100"
                  >
                    Add
                  </button>
                </div>

                <div className="mt-4 flex flex-wrap gap-2">
                  {serviceSuggestions
                    .filter((service) => !form.services_offered.includes(service))
                    .map((service) => (
                      <button
                        key={service}
                        type="button"
                        onClick={() => addService(service)}
                        className="rounded-full border border-white/8 bg-white/[0.03] px-3 py-1 text-xs text-white/48 transition-colors hover:border-violet-400/18 hover:bg-violet-500/10 hover:text-violet-100"
                      >
                        + {service}
                      </button>
                    ))}
                </div>
              </div>
            </div>
          ) : null}

          {step === 2 ? (
            <div>
              <SectionHeader
                step="Step 2"
                title="Working Hours"
                description="These hours determine when the agent should offer bookable appointment windows."
              />
              <div className="space-y-3">
                {days.map((day) => {
                  const dayConfig = form.working_hours[day];
                  return (
                    <div
                      key={day}
                      className="flex flex-col gap-3 rounded-[18px] border border-white/8 bg-white/[0.02] px-4 py-4 sm:flex-row sm:items-center sm:justify-between"
                    >
                      <label className="flex items-center gap-3">
                        <input
                          type="checkbox"
                          checked={dayConfig.enabled}
                          onChange={(e) => setDayField(day, "enabled", e.target.checked)}
                          className="h-4 w-4 rounded border-white/20 bg-transparent text-violet-500"
                        />
                        <span className="text-sm font-medium text-white">{day}</span>
                      </label>

                      {dayConfig.enabled ? (
                        <div className="flex items-center gap-2">
                          <input
                            type="time"
                            value={dayConfig.open}
                            onChange={(e) => setDayField(day, "open", e.target.value)}
                            className="rounded-[14px] border border-white/10 bg-white/[0.04] px-3 py-2 text-sm text-white"
                          />
                          <span className="text-sm text-white/35">to</span>
                          <input
                            type="time"
                            value={dayConfig.close}
                            onChange={(e) => setDayField(day, "close", e.target.value)}
                            className="rounded-[14px] border border-white/10 bg-white/[0.04] px-3 py-2 text-sm text-white"
                          />
                        </div>
                      ) : (
                        <span className="text-sm text-white/35">Closed</span>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          ) : null}

          {step === 3 ? (
            <div>
              <SectionHeader
                step="Step 3"
                title="Service Area"
                description="Define the geographic area and preferred local area code for provisioning."
              />
              <div className="space-y-5">
                <label className="block">
                  <span className="text-sm font-medium text-white/78">Area description</span>
                  <textarea
                    value={form.service_area_description}
                    onChange={(e) => setField("service_area_description", e.target.value)}
                    rows={4}
                    className={`${inputClass} resize-none`}
                    placeholder="Serving Brooklyn, Queens, and Manhattan"
                  />
                </label>
                <div className="grid gap-5 md:grid-cols-[1fr_160px]">
                  <label className="block">
                    <span className="text-sm font-medium text-white/78">ZIP codes (comma separated)</span>
                    <input
                      type="text"
                      value={form.zip_codes}
                      onChange={(e) => setField("zip_codes", e.target.value)}
                      className={inputClass}
                      placeholder="11201, 11211, 10001"
                    />
                  </label>
                  <label className="block">
                    <span className="text-sm font-medium text-white/78">Area code *</span>
                    <input
                      type="text"
                      value={form.area_code}
                      onChange={(e) => setField("area_code", e.target.value.replace(/\D/g, "").slice(0, 3))}
                      maxLength={3}
                      className={inputClass}
                      placeholder="718"
                    />
                  </label>
                </div>
              </div>
            </div>
          ) : null}

          {step === 4 ? (
            <div>
              <SectionHeader
                step="Step 4"
                title="Pricing Ranges"
                description="Optional. Add quick pricing guidance so the receptionist can answer basic cost questions."
              />
              <div className="space-y-4">
                {form.services_offered.map((service) => (
                  <label key={service} className="block">
                    <span className="text-sm font-medium text-white/78">{service}</span>
                    <input
                      type="text"
                      value={form.pricing_ranges[service] ?? ""}
                      onChange={(e) =>
                        setField("pricing_ranges", { ...form.pricing_ranges, [service]: e.target.value })
                      }
                      placeholder="e.g. $150-$300"
                      className={inputClass}
                    />
                  </label>
                ))}
                {form.services_offered.length === 0 ? (
                  <p className="text-sm text-white/35">No services added yet.</p>
                ) : null}
              </div>
            </div>
          ) : null}

          {step === 5 ? (
            <div>
              <SectionHeader
                step="Step 5"
                title="Google Calendar"
                description="Connect scheduling so the agent can verify availability and place appointments correctly."
              />
              {form.calendar_connected ? (
                <div className="rounded-[20px] border border-emerald-400/18 bg-emerald-500/10 p-5 text-sm text-emerald-200">
                  Google Calendar connected successfully.
                </div>
              ) : (
                <div className="rounded-[22px] border border-dashed border-white/12 bg-white/[0.02] p-8 text-center">
                  <p className="mx-auto max-w-md text-sm leading-7 text-white/52">
                    Open Google OAuth in a new tab, then return here once the account is connected.
                  </p>
                  <a
                    href="/auth/google/connect?client_id=pending"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="mt-5 inline-flex rounded-full border border-violet-400/25 bg-violet-500/10 px-5 py-3 text-sm font-medium text-violet-100"
                  >
                    Connect Calendar
                  </a>
                  <div className="mt-4">
                    <button
                      onClick={() => setField("calendar_connected", true)}
                      className="text-xs uppercase tracking-[0.18em] text-white/45 hover:text-violet-100"
                    >
                      I&apos;ve connected it
                    </button>
                  </div>
                </div>
              )}
            </div>
          ) : null}

          {step === 6 ? (
            <div>
              <SectionHeader
                step="Step 6"
                title="FSM Integration"
                description="Optional. Connect the field service platform used to create downstream jobs automatically."
              />
              <div className="space-y-5">
                <select
                  value={form.fsm_type}
                  onChange={(e) => setField("fsm_type", e.target.value)}
                  className="block w-full rounded-[16px] border border-white/10 bg-white/[0.04] px-4 py-3 text-sm text-white focus:border-violet-400/40 focus:outline-none focus:ring-2 focus:ring-violet-500/20"
                >
                  <option value="none">Neither - skip FSM integration</option>
                  <option value="jobber">Jobber</option>
                  <option value="housecall_pro">Housecall Pro</option>
                </select>

                {form.fsm_type === "jobber" ? (
                  <input
                    type="text"
                    value={form.jobber_api_key}
                    onChange={(e) => setField("jobber_api_key", e.target.value)}
                    placeholder="jbk_live_..."
                    className={inputClass}
                  />
                ) : null}

                {form.fsm_type === "housecall_pro" ? (
                  <input
                    type="text"
                    value={form.housecall_pro_api_key}
                    onChange={(e) => setField("housecall_pro_api_key", e.target.value)}
                    placeholder="hcp_..."
                    className={inputClass}
                  />
                ) : null}
              </div>
            </div>
          ) : null}

          {step === 7 ? (
            <div>
              <SectionHeader
                step="Step 7"
                title="Review & Launch"
                description="Confirm the setup details before provisioning the new client environment."
              />
              <div className="rounded-[22px] border border-white/8 bg-white/[0.02] p-5">
                <ReviewRow label="Business" value={form.business_name} />
                <ReviewRow label="Email" value={form.email} />
                <ReviewRow label="Emergency Phone" value={form.emergency_phone} />
                <ReviewRow label="Services" value={form.services_offered.join(", ") || "-"} />
                <ReviewRow label="Area Code" value={form.area_code || "-"} />
                <ReviewRow label="Service Area" value={form.service_area_description || "-"} />
                <ReviewRow label="Calendar" value={form.calendar_connected ? "Connected" : "Not connected"} />
                <ReviewRow
                  label="FSM"
                  value={
                    form.fsm_type === "none"
                      ? "None"
                      : form.fsm_type === "jobber"
                        ? "Jobber"
                        : "Housecall Pro"
                  }
                />
              </div>
              <button
                onClick={() => void handleLaunch()}
                className="mt-6 w-full rounded-[18px] border border-emerald-400/20 bg-emerald-500/12 py-4 text-sm font-semibold text-emerald-100 transition-colors hover:bg-emerald-500/18"
              >
                Launch Agent
              </button>
            </div>
          ) : null}

          <div className="mt-8 flex items-center justify-between border-t border-white/8 pt-6">
            {step > 1 ? (
              <button
                onClick={() => setStep((current) => current - 1)}
                className="rounded-full border border-white/10 px-4 py-2 text-xs uppercase tracking-[0.2em] text-white/55 hover:border-white/20 hover:text-white/85"
              >
                ← Back
              </button>
            ) : (
              <span />
            )}
            {step < 7 ? (
              <button
                onClick={handleNext}
                className="rounded-full border border-violet-400/25 bg-violet-500/10 px-5 py-3 text-xs font-medium uppercase tracking-[0.2em] text-violet-100"
              >
                Continue
              </button>
            ) : null}
          </div>
        </StepCard>
      </div>
    </div>
  );
}
