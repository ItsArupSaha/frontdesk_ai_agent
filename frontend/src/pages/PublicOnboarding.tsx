import { useRef, useState } from "react";
import { submitOnboarding, type OnboardingSubmitPayload } from "../lib/api";

type WorkingDay = { enabled: boolean; open: string; close: string };
type WorkingHours = Record<string, WorkingDay>;

type FormData = {
  business_name: string;
  email: string;
  emergency_phone: string;
  services_offered: string[];
  working_hours: WorkingHours;
  service_area_description: string;
  area_code: string;
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
  area_code: "",
};

const TOTAL_STEPS = 5;

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

function SectionHeader({ step, title, description }: { step: string; title: string; description?: string }) {
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

function ReviewRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-start justify-between gap-4 border-t border-white/8 py-3 first:border-t-0 first:pt-0 last:pb-0">
      <span className="text-sm font-medium text-white/48">{label}</span>
      <span className="text-right text-sm text-white/82">{value}</span>
    </div>
  );
}

export default function PublicOnboardingPage() {
  const serviceInputRef = useRef<HTMLInputElement>(null);
  const [step, setStep] = useState(1);
  const [form, setForm] = useState<FormData>(initialForm);
  const [serviceInput, setServiceInput] = useState("");
  const [stepErrors, setStepErrors] = useState<string[]>([]);
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);

  function setField<K extends keyof FormData>(key: K, value: FormData[K]) {
    setForm((c) => ({ ...c, [key]: value }));
  }

  function addService(raw: string) {
    const service = raw.trim();
    if (!service || form.services_offered.includes(service)) return;
    setForm((c) => ({ ...c, services_offered: [...c.services_offered, service] }));
    setServiceInput("");
    serviceInputRef.current?.focus();
  }

  function removeService(service: string) {
    setForm((c) => ({ ...c, services_offered: c.services_offered.filter((s) => s !== service) }));
  }

  function setDayField(day: string, field: keyof WorkingDay, value: boolean | string) {
    setForm((c) => ({
      ...c,
      working_hours: { ...c.working_hours, [day]: { ...c.working_hours[day], [field]: value } },
    }));
  }

  function validateStep(s: number): string[] {
    const errors: string[] = [];
    if (s === 1) {
      if (!form.business_name.trim()) errors.push("Business name is required.");
      if (!form.email.trim()) errors.push("Email is required.");
      else if (!isValidEmail(form.email)) errors.push("Enter a valid email address.");
      if (!form.emergency_phone.trim()) errors.push("Emergency phone is required.");
      else if (!isValidE164(form.emergency_phone)) errors.push("Phone must be US E.164 format: +1XXXXXXXXXX");
      if (form.services_offered.length === 0) errors.push("Add at least one service.");
    }
    if (s === 3) {
      if (!form.area_code.trim()) errors.push("Area code is required.");
      else if (!isValidAreaCode(form.area_code)) errors.push("Area code must be 3 digits.");
    }
    return errors;
  }

  function handleNext() {
    const errors = validateStep(step);
    if (errors.length > 0) { setStepErrors(errors); return; }
    setStepErrors([]);
    setStep((s) => s + 1);
  }

  async function handleSubmit() {
    setSubmitting(true);
    setSubmitError(null);

    const workingHoursPayload = Object.fromEntries(
      days.map((day) => [
        day,
        form.working_hours[day]?.enabled
          ? { open: form.working_hours[day].open, close: form.working_hours[day].close }
          : null,
      ]),
    );

    const payload: OnboardingSubmitPayload = {
      business_name: form.business_name.trim(),
      email: form.email.trim().toLowerCase(),
      emergency_phone: form.emergency_phone.trim(),
      services_offered: form.services_offered,
      working_hours: workingHoursPayload,
      service_area_description: form.service_area_description.trim(),
      area_code: form.area_code.trim() || "212",
    };

    try {
      await submitOnboarding(payload);
      setSubmitted(true);
    } catch (error: unknown) {
      setSubmitError(error instanceof Error ? error.message : String(error));
    } finally {
      setSubmitting(false);
    }
  }

  // Success screen
  if (submitted) {
    return (
      <div className="min-h-screen bg-[#06050a] px-4 py-10 text-white sm:px-6">
        <div className="mx-auto max-w-lg">
          <StepCard>
            <div className="text-center py-6">
              <div className="mx-auto mb-5 flex h-20 w-20 items-center justify-center rounded-full border border-emerald-400/20 bg-emerald-500/10 text-3xl text-emerald-300">
                ✓
              </div>
              <p className="text-[11px] uppercase tracking-[0.28em] text-emerald-200/65">Application Received</p>
              <h1 className="mt-3 text-3xl font-semibold tracking-[-0.05em] text-white">
                You're all set!
              </h1>
              <p className="mx-auto mt-4 max-w-md text-sm leading-7 text-white/55">
                We've received your application for{" "}
                <span className="text-white/80">{form.business_name}</span>. Your AI front-desk
                service will be activated within{" "}
                <span className="text-violet-300">30–90 minutes</span>.
              </p>
              <div className="mx-auto mt-8 max-w-md rounded-[22px] border border-violet-400/15 bg-white/[0.03] p-5 text-left space-y-3">
                <p className="text-xs uppercase tracking-[0.22em] text-violet-200/55">What happens next</p>
                <div className="flex items-start gap-3 text-sm text-white/60">
                  <span className="mt-0.5 text-violet-300">1.</span>
                  <span>We review your application and activate your account</span>
                </div>
                <div className="flex items-start gap-3 text-sm text-white/60">
                  <span className="mt-0.5 text-violet-300">2.</span>
                  <span>You'll receive a login link at <strong className="text-white/75">{form.email}</strong></span>
                </div>
                <div className="flex items-start gap-3 text-sm text-white/60">
                  <span className="mt-0.5 text-violet-300">3.</span>
                  <span>Forward your business phone to the AI number we provision for you</span>
                </div>
                <div className="flex items-start gap-3 text-sm text-white/60">
                  <span className="mt-0.5 text-violet-300">4.</span>
                  <span>Connect your Google Calendar in the settings after logging in</span>
                </div>
              </div>
            </div>
          </StepCard>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#06050a] px-4 py-8 text-white sm:px-6">
      <div className="mx-auto max-w-2xl">
        {/* Header */}
        <div className="mb-8 text-center">
          <p className="text-[11px] uppercase tracking-[0.32em] text-violet-200/65">Setup</p>
          <h1 className="mt-3 text-4xl font-semibold tracking-[-0.06em] text-white">
            Set Up Your AI Front-Desk
          </h1>
          <p className="mt-3 text-sm leading-7 text-white/52">
            Fill in your business details below. Your AI agent will be live within 30–90 minutes.
          </p>
        </div>

        {/* Progress */}
        <div className="mb-6 rounded-[22px] border border-white/8 bg-white/[0.02] p-4">
          <div className="mb-2 flex items-center justify-between text-xs uppercase tracking-[0.22em] text-white/38">
            <span>Step {step} of {TOTAL_STEPS}</span>
            <span>{Math.round((step / TOTAL_STEPS) * 100)}%</span>
          </div>
          <div className="h-1.5 overflow-hidden rounded-full bg-white/8">
            <div
              className="h-full rounded-full bg-[linear-gradient(135deg,#7C3AED_0%,#8B5CF6_100%)] transition-all duration-300"
              style={{ width: `${(step / TOTAL_STEPS) * 100}%` }}
            />
          </div>
        </div>

        {/* Errors */}
        {stepErrors.length > 0 && (
          <div className="mb-4 rounded-[20px] border border-rose-500/20 bg-rose-500/10 p-4 text-sm text-rose-200">
            {stepErrors.map((e, i) => <div key={i}>{e}</div>)}
          </div>
        )}
        {submitError && (
          <div className="mb-4 rounded-[20px] border border-rose-500/20 bg-rose-500/10 p-4 text-sm text-rose-200">
            {submitError}
          </div>
        )}

        <StepCard>
          {/* Step 1: Business Basics */}
          {step === 1 && (
            <div>
              <SectionHeader
                step="Step 1 of 5"
                title="Business Basics"
                description="Your business name, contact email, and the services your team provides."
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
                  <span className="text-sm font-medium text-white/78">Your email *</span>
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
                <p className="mt-1 text-xs text-white/35">US number in E.164 format: +1XXXXXXXXXX</p>
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
                <p className="mt-1 text-xs text-white/35">The agent will recognize and quote these services.</p>
                {form.services_offered.length > 0 && (
                  <div className="mt-3 flex flex-wrap gap-2">
                    {form.services_offered.map((service) => (
                      <span
                        key={service}
                        className="inline-flex items-center gap-2 rounded-full border border-violet-400/18 bg-violet-500/10 px-3 py-1.5 text-xs font-medium text-violet-100"
                      >
                        {service}
                        <button type="button" onClick={() => removeService(service)} className="leading-none text-violet-200/70 hover:text-rose-200">×</button>
                      </span>
                    ))}
                  </div>
                )}
                <div className="mt-3 flex gap-2">
                  <input
                    ref={serviceInputRef}
                    type="text"
                    value={serviceInput}
                    onChange={(e) => setServiceInput(e.target.value)}
                    onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); addService(serviceInput); } }}
                    className={`${inputClass} mt-0 flex-1`}
                    placeholder="Drain Cleaning"
                  />
                  <button type="button" onClick={() => addService(serviceInput)} className="rounded-[16px] border border-violet-400/25 bg-violet-500/10 px-4 text-sm font-semibold text-violet-100">
                    Add
                  </button>
                </div>
                <div className="mt-3 flex flex-wrap gap-2">
                  {serviceSuggestions.filter((s) => !form.services_offered.includes(s)).map((service) => (
                    <button
                      key={service}
                      type="button"
                      onClick={() => addService(service)}
                      className="rounded-full border border-white/8 bg-white/[0.03] px-3 py-1 text-xs text-white/48 hover:border-violet-400/18 hover:bg-violet-500/10 hover:text-violet-100"
                    >
                      + {service}
                    </button>
                  ))}
                </div>
              </div>
            </div>
          )}

          {/* Step 2: Working Hours */}
          {step === 2 && (
            <div>
              <SectionHeader step="Step 2 of 5" title="Working Hours" description="When should the agent offer appointment slots?" />
              <div className="space-y-3">
                {days.map((day) => {
                  const d = form.working_hours[day];
                  return (
                    <div key={day} className="flex flex-col gap-3 rounded-[18px] border border-white/8 bg-white/[0.02] px-4 py-4 sm:flex-row sm:items-center sm:justify-between">
                      <label className="flex items-center gap-3">
                        <input type="checkbox" checked={d.enabled} onChange={(e) => setDayField(day, "enabled", e.target.checked)} className="h-4 w-4 rounded border-white/20 bg-transparent text-violet-500" />
                        <span className="text-sm font-medium text-white">{day}</span>
                      </label>
                      {d.enabled ? (
                        <div className="flex items-center gap-2">
                          <input type="time" value={d.open} onChange={(e) => setDayField(day, "open", e.target.value)} className="rounded-[14px] border border-white/10 bg-white/[0.04] px-3 py-2 text-sm text-white" />
                          <span className="text-sm text-white/35">to</span>
                          <input type="time" value={d.close} onChange={(e) => setDayField(day, "close", e.target.value)} className="rounded-[14px] border border-white/10 bg-white/[0.04] px-3 py-2 text-sm text-white" />
                        </div>
                      ) : (
                        <span className="text-sm text-white/35">Closed</span>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* Step 3: Service Area */}
          {step === 3 && (
            <div>
              <SectionHeader step="Step 3 of 5" title="Service Area" description="Where do you serve? The agent will use this to qualify callers by location." />
              <div className="space-y-5">
                <label className="block">
                  <span className="text-sm font-medium text-white/78">Service area description</span>
                  <textarea
                    value={form.service_area_description}
                    onChange={(e) => setField("service_area_description", e.target.value)}
                    rows={3}
                    className={`${inputClass} resize-none`}
                    placeholder="Serving Brooklyn, Queens, and Manhattan"
                  />
                </label>
                <label className="block">
                  <span className="text-sm font-medium text-white/78">Local area code *</span>
                  <p className="mt-1 text-xs text-white/35">Used to provision a local AI phone number for your business.</p>
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
          )}

          {/* Step 4: Google Calendar notice */}
          {step === 4 && (
            <div>
              <SectionHeader step="Step 4 of 5" title="Google Calendar" description="Your AI agent books appointments directly into your Google Calendar." />
              <div className="rounded-[22px] border border-violet-400/15 bg-violet-500/[0.06] p-6">
                <p className="text-sm leading-7 text-white/65">
                  You'll connect your Google Calendar <strong className="text-violet-300">after logging in</strong> to your dashboard. We'll send you a login link once your account is activated.
                </p>
                <p className="mt-3 text-sm leading-7 text-white/55">
                  Calendar connection takes less than 2 minutes — just click "Connect Calendar" in your Settings page.
                </p>
              </div>
            </div>
          )}

          {/* Step 5: Review & Submit */}
          {step === 5 && (
            <div>
              <SectionHeader step="Step 5 of 5" title="Review & Submit" description="Double-check your details before we set everything up." />
              <div className="rounded-[22px] border border-white/8 bg-white/[0.02] p-5">
                <ReviewRow label="Business" value={form.business_name} />
                <ReviewRow label="Email" value={form.email} />
                <ReviewRow label="Emergency Phone" value={form.emergency_phone} />
                <ReviewRow label="Services" value={form.services_offered.join(", ") || "-"} />
                <ReviewRow label="Area Code" value={form.area_code || "-"} />
                <ReviewRow label="Service Area" value={form.service_area_description || "Not specified"} />
              </div>
              <button
                onClick={() => void handleSubmit()}
                disabled={submitting}
                className="mt-6 w-full rounded-[18px] border border-emerald-400/20 bg-emerald-500/12 py-4 text-sm font-semibold text-emerald-100 transition-colors hover:bg-emerald-500/18 disabled:opacity-50"
              >
                {submitting ? "Submitting…" : "Submit Application"}
              </button>
            </div>
          )}

          {/* Nav */}
          <div className="mt-8 flex items-center justify-between border-t border-white/8 pt-6">
            {step > 1 ? (
              <button onClick={() => setStep((s) => s - 1)} className="rounded-full border border-white/10 px-4 py-2 text-xs uppercase tracking-[0.2em] text-white/55 hover:border-white/20 hover:text-white/85">
                ← Back
              </button>
            ) : <span />}
            {step < TOTAL_STEPS && (
              <button onClick={handleNext} className="rounded-full border border-violet-400/25 bg-violet-500/10 px-5 py-3 text-xs font-medium uppercase tracking-[0.2em] text-violet-100">
                Continue →
              </button>
            )}
          </div>
        </StepCard>
      </div>
    </div>
  );
}
