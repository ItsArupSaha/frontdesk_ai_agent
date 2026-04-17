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
  calls_per_day: Array<{ date: string; count: number }>;
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
  params: { limit?: number; offset?: number } = {},
): Promise<{ calls: CallLog[] }> {
  const query = new URLSearchParams({ client_id: clientId });
  if (params.limit != null) query.set("limit", String(params.limit));
  if (params.offset != null) query.set("offset", String(params.offset));
  return apiFetch(`/api/dashboard/calls?${query.toString()}`, token);
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
