import { useEffect, useState } from "react";
import { useMutation, useQuery } from "@tanstack/react-query";
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
  "w-full rounded-md border border-gray-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-violet-500";

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="rounded-lg border border-gray-200 bg-white p-5">
      <h3 className="mb-4 text-sm font-semibold text-gray-700">{title}</h3>
      <div className="space-y-3">{children}</div>
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <label className="mb-1 block text-xs font-medium text-gray-500">{label}</label>
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
    <div className="p-6">
      <h2 className="mb-6 text-xl font-semibold text-gray-800">Settings</h2>

      <form onSubmit={handleSubmit} className="max-w-2xl space-y-6">
        <Section title="Business Info">
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

        <Section title="Services Offered">
          <div className="flex flex-wrap gap-2">
            {services.map((service) => (
              <span
                key={service}
                className="flex items-center gap-1 rounded-full bg-blue-100 px-3 py-1 text-sm text-blue-700"
              >
                {service}
                <button
                  type="button"
                  onClick={() => setServices((current) => current.filter((item) => item !== service))}
                  className="ml-1 text-blue-400 hover:text-blue-700"
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
            className={`${inputClass} mt-2`}
          />
        </Section>

        <Section title="Service Area">
          <textarea
            value={serviceArea}
            onChange={(e) => setServiceArea(e.target.value)}
            rows={3}
            className={`${inputClass} resize-none`}
            placeholder="Serving Brooklyn, Queens, and Manhattan, New York"
          />
        </Section>

        <Section title="Working Hours">
          <div className="space-y-2">
            {days.map((day) => (
              <div key={day} className="flex items-center gap-3">
                <span className="w-24 text-sm text-gray-600">{dayLabels[day]}</span>
                <input
                  type="text"
                  value={workingHours[day] ?? ""}
                  onChange={(e) =>
                    setWorkingHours((current) => ({ ...current, [day]: e.target.value }))
                  }
                  placeholder="8am-6pm or closed"
                  className={`${inputClass} flex-1`}
                />
              </div>
            ))}
          </div>
        </Section>

        <Section title="Google Calendar">
          <button
            type="button"
            onClick={() => {
              window.location.href = `/auth/google/connect?client_id=${clientId}`;
            }}
            className="rounded-md border border-blue-300 bg-blue-50 px-4 py-2 text-sm text-blue-700 hover:bg-blue-100"
          >
            Reconnect Google Calendar
          </button>
        </Section>

        <Section title="Integrations (optional)">
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

        {errorMessage ? <p className="rounded-md bg-red-50 p-3 text-sm text-red-600">{errorMessage}</p> : null}

        <div className="flex items-center gap-4">
          <button
            type="submit"
            disabled={mutation.isPending}
            className="rounded-md bg-violet-600 px-5 py-2 text-sm font-medium text-white hover:bg-violet-700 disabled:opacity-50"
          >
            {mutation.isPending ? "Saving..." : "Save Settings"}
          </button>
          {saved ? <span className="text-sm text-green-600">Settings saved successfully.</span> : null}
        </div>
      </form>
    </div>
  );
}
