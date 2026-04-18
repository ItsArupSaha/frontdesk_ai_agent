import { useEffect, useState } from "react";
import { useMutation, useQuery } from "@tanstack/react-query";
import { Building2, Clock3, Link2, Wrench } from "lucide-react";
import { LoadingSpinner } from "../components/LoadingSpinner";
import { useAuth } from "../contexts/AuthContext";
import { getSettings, type ClientSettings, type SettingsPayload, updateSettings } from "../lib/api";

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

export default function SettingsPage() {
  const { token, clientId } = useAuth();
  const [saved, setSaved] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [businessName, setBusinessName] = useState("");
  const [emergencyPhone, setEmergencyPhone] = useState("");
  const [serviceArea, setServiceArea] = useState("");
  const [googleReviewLink, setGoogleReviewLink] = useState("");
  const [services, setServices] = useState<string[]>([]);
  const [serviceInput, setServiceInput] = useState("");
  const [workingHours, setWorkingHours] = useState<Record<string, string>>({});
  const [jobberKey, setJobberKey] = useState("");
  const [housecallKey, setHousecallKey] = useState("");

  const query = useQuery<ClientSettings>({
    queryKey: ["settings", clientId],
    queryFn: () => getSettings(token!, clientId!),
    enabled: !!token && !!clientId,
  });

  useEffect(() => {
    if (!query.data) return;
    setBusinessName(query.data.business_name ?? "");
    setEmergencyPhone(query.data.emergency_phone_number ?? "");
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
      setTimeout(() => setSaved(false), 3000);
    },
    onError: (error: Error) => {
      setErrorMessage(error.message);
    },
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
    if (emergencyPhone) payload.emergency_phone_number = emergencyPhone;
    if (serviceArea) payload.service_area_description = serviceArea;
    if (googleReviewLink) payload.google_review_link = googleReviewLink;
    if (services.length) payload.services_offered = services;
    if (Object.keys(workingHours).length) payload.working_hours = workingHours;
    if (jobberKey) payload.jobber_api_key = jobberKey;
    if (housecallKey) payload.housecall_pro_api_key = housecallKey;
    mutation.mutate(payload);
  }

  if (!token || !clientId || query.isLoading) {
    return (
      <div className="flex h-full items-center justify-center">
        <LoadingSpinner size="lg" />
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-7xl space-y-6 p-6 md:p-8">
      <section className="rounded-[32px] border border-white/10 bg-[linear-gradient(135deg,rgba(70,56,190,0.2),rgba(16,12,28,0.92)_48%,rgba(24,19,39,0.95))] p-7 shadow-[0_28px_80px_rgba(0,0,0,0.22)]">
        <p className="text-[11px] uppercase tracking-[0.28em] text-white/40">Business Controls</p>
        <h2 className="mt-3 text-[clamp(2rem,4vw,3.1rem)] font-semibold tracking-[-0.06em] text-white">
          Configure how your receptionist represents the business.
        </h2>
        <p className="mt-3 max-w-2xl text-sm leading-7 text-white/60">
          Update service coverage, scheduling windows, integrations, and business details without changing the workflow itself.
        </p>
      </section>

      <form onSubmit={handleSubmit} className="space-y-6">
        <div className="grid gap-6 xl:grid-cols-2">
          <Section title="Business Info" icon={Building2}>
            <Field label="Business Name">
              <input type="text" value={businessName} onChange={(e) => setBusinessName(e.target.value)} className={inputClass} />
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
              placeholder="Type a service and press Enter..."
              className={inputClass}
            />
            <Field label="Google Review Link">
              <input
                type="url"
                value={googleReviewLink}
                onChange={(e) => setGoogleReviewLink(e.target.value)}
                className={inputClass}
                placeholder="https://g.page/r/..."
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
            {mutation.isPending ? "Saving..." : "Save Settings"}
          </button>
          {saved ? <span className="text-sm text-emerald-300">Settings saved successfully.</span> : null}
        </div>
      </form>
    </div>
  );
}
