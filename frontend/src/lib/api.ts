const BASE = (import.meta.env.VITE_API_URL as string | undefined) ?? "";

export interface OverviewMetrics {
  calls_today: number;
  calls_this_week: number;
  bookings_this_week: number;
  booking_rate: number;
  emergencies_this_week: number;
  missed_calls_recovered: number;
}

export interface CallLog {
  id: string;
  call_id: string;
  caller_number: string;
  started_at: string;
  ended_at: string | null;
  was_emergency: boolean;
  was_booked: boolean;
  summary: string | null;
  transcript: Array<{ role: string; content: string }>;
  status: string;
  duration_seconds: number | null;
  recording_url: string | null;
}

export interface AnalyticsData {
  calls_per_day: DailyCount[];
  bookings_per_day: DailyCount[];
  calls_by_hour: HourlyCount[];
  emergency_rate: number;
  period_days: number;
}

export interface CallsResponse {
  calls: CallLog[];
  offset: number;
  limit: number;
  count: number;
}

export interface Booking {
  id: string;
  caller_name: string;
  caller_phone: string;
  caller_address: string;
  problem_description: string;
  appointment_start: string;
  appointment_end: string;
  status: string;
  confirmation_sms_sent: boolean;
  fsm_synced: boolean;
  created_at: string;
}

export interface BookingsResponse {
  bookings: Booking[];
  count: number;
}

export interface DailyCount {
  date: string;
  count: number;
}

export interface HourlyCount {
  hour: number;
  count: number;
}

export interface ClientSettings {
  id: string;
  business_name: string;
  bot_name: string | null;
  emergency_phone_number: string;
  main_phone_number: string | null;
  is_ai_enabled: boolean;
  sms_enabled: boolean;
  timezone: string | null;
  working_hours: Record<string, string>;
  services_offered: string[];
  service_area_description: string;
  google_review_link: string | null;
  vapi_assistant_id: string | null;
  vapi_phone_number: string | null;
  twilio_phone_number: string | null;
  is_active: boolean;
  fsm_type: string | null;
  kb_last_ingested_at: string | null;
  created_at: string;
  updated_at: string;
}

export interface MeResponse {
  user_id: string;
  email: string | null;
  is_admin: boolean;
}

export interface AdminClientSummary {
  id: string;
  business_name: string;
  email: string | null;
  is_active: boolean;
  sms_enabled: boolean;
  vapi_phone_number: string | null;
  twilio_phone_number: string | null;
  vapi_assistant_id: string | null;
  completeness_score: number;
  completeness_breakdown: Record<string, boolean>;
  provisioning_notes: string | null;
  calls_this_month: number;
  last_call_at: string | null;
  bookings_this_month: number;
  monthly_cost_estimate: number;
}

export interface ImpersonateResponse {
  client_id: string;
  business_name: string;
  email: string | null;
  is_active: boolean;
  dashboard_url: string;
}

export interface ClientCreatePayload {
  business_name: string;
  email: string;
  emergency_phone: string;
  services_offered: string[];
  working_hours: Record<string, { open: string; close: string } | null>;
  service_area_description: string;
  zip_codes: string[];
  area_code: string;
  pricing_ranges: Record<string, string>;
  fsm_type?: string | null;
  jobber_api_key?: string | null;
  housecall_pro_api_key?: string | null;
}

export interface ClientCreateResponse {
  client_id: string;
  phone_number: string;
  setup_complete: boolean;
  next_step: string;
  message: string;
}

export interface SettingsPayload {
  business_name?: string;
  bot_name?: string;
  emergency_phone_number?: string;
  main_phone_number?: string;
  is_ai_enabled?: boolean;
  timezone?: string;
  working_hours?: Record<string, string>;
  services_offered?: string[];
  service_area_description?: string;
  google_review_link?: string;
  jobber_api_key?: string;
  housecall_pro_api_key?: string;
}

async function apiFetch<T>(path: string, token: string, options?: RequestInit): Promise<T> {
  const response = await fetch(`${BASE}${path}`, {
    ...options,
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
      ...(options?.headers ?? {}),
    },
  });

  if (!response.ok) {
    const body = await response.text();
    throw new Error(`API ${response.status}: ${body}`);
  }

  return response.json() as Promise<T>;
}

export function getMe(token: string): Promise<MeResponse> {
  return apiFetch("/api/auth/me", token);
}

export function getOverview(token: string, clientId: string): Promise<OverviewMetrics> {
  return apiFetch(`/api/dashboard/overview?client_id=${clientId}`, token);
}

export function getCalls(
  token: string,
  clientId: string,
  params: {
    limit?: number;
    offset?: number;
    emergency_only?: boolean;
    booked_only?: boolean;
    start?: string;
    end?: string;
  } = {},
): Promise<CallsResponse> {
  const query = new URLSearchParams({ client_id: clientId });
  if (params.limit != null) query.set("limit", String(params.limit));
  if (params.offset != null) query.set("offset", String(params.offset));
  if (params.emergency_only) query.set("emergency_only", "true");
  if (params.booked_only) query.set("booked_only", "true");
  if (params.start) query.set("start", params.start);
  if (params.end) query.set("end", params.end);
  return apiFetch(`/api/dashboard/calls?${query.toString()}`, token);
}

export function getBookings(
  token: string,
  clientId: string,
  start?: string,
  end?: string,
): Promise<BookingsResponse> {
  const query = new URLSearchParams({ client_id: clientId });
  if (start) query.set("start", start);
  if (end) query.set("end", end);
  return apiFetch(`/api/dashboard/bookings?${query.toString()}`, token);
}

export function getAnalytics(
  token: string,
  clientId: string,
  period = "30d",
): Promise<AnalyticsData> {
  return apiFetch(`/api/dashboard/analytics?client_id=${clientId}&period=${period}`, token);
}

export function getAdminClients(token: string): Promise<AdminClientSummary[]> {
  return apiFetch("/api/admin/clients", token);
}

export function updateClientStatus(
  token: string,
  clientId: string,
  isActive: boolean,
): Promise<{ client_id: string; is_active: boolean }> {
  return apiFetch(`/api/admin/clients/${clientId}/status`, token, {
    method: "PUT",
    body: JSON.stringify({ is_active: isActive }),
  });
}

export function impersonateClient(
  token: string,
  clientId: string,
): Promise<ImpersonateResponse> {
  return apiFetch(`/api/admin/clients/${clientId}/impersonate`, token);
}

export function getSettings(token: string, clientId: string): Promise<ClientSettings> {
  return apiFetch(`/api/dashboard/settings?client_id=${clientId}`, token);
}

export function updateSettings(
  token: string,
  clientId: string,
  payload: SettingsPayload,
): Promise<ClientSettings> {
  return apiFetch(`/api/dashboard/settings?client_id=${clientId}`, token, {
    method: "PUT",
    body: JSON.stringify(payload),
  });
}

export function createClient(
  token: string,
  payload: ClientCreatePayload,
): Promise<ClientCreateResponse> {
  return apiFetch("/api/clients/create", token, {
    method: "POST",
    body: JSON.stringify(payload),
  });
}

export function updateBookingStatus(
  token: string,
  clientId: string,
  bookingId: string,
  status: "confirmed" | "completed" | "cancelled",
): Promise<Booking> {
  const query = new URLSearchParams({ client_id: clientId, status });
  return apiFetch(`/api/dashboard/bookings/${bookingId}?${query.toString()}`, token, {
    method: "PATCH",
  });
}

export function updateSmsEnabled(
  token: string,
  clientId: string,
  smsEnabled: boolean,
  provisioningNotes?: string,
): Promise<{ client_id: string; sms_enabled: boolean }> {
  return apiFetch(`/api/admin/clients/${clientId}/sms-enabled`, token, {
    method: "PUT",
    body: JSON.stringify({ sms_enabled: smsEnabled, provisioning_notes: provisioningNotes ?? null }),
  });
}

export function reingestKnowledgeBase(
  token: string,
  clientId: string,
): Promise<{ status: string; message: string }> {
  return apiFetch(`/api/dashboard/knowledge-base/reingest?client_id=${clientId}`, token, {
    method: "POST",
  });
}

export async function uploadKnowledgeDocument(
  token: string,
  clientId: string,
  file: File,
): Promise<{ status: string; filename: string; chunks_ingested: number; message: string }> {
  const form = new FormData();
  form.append("file", file);
  const response = await fetch(`${BASE}/api/dashboard/knowledge-base/upload?client_id=${clientId}`, {
    method: "POST",
    headers: { Authorization: `Bearer ${token}` },
    body: form,
  });
  if (!response.ok) {
    const body = await response.text();
    throw new Error(`API ${response.status}: ${body}`);
  }
  return response.json() as Promise<{ status: string; filename: string; chunks_ingested: number; message: string }>;
}
