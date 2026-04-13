/**
 * Typed wrappers around the backend dashboard API.
 *
 * All functions accept a `token` (Supabase JWT) and a `clientId`.
 * They throw on non-OK responses so callers/React Query can handle errors.
 */

const BASE = (import.meta.env.VITE_API_URL as string | undefined) ?? ''

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface OverviewMetrics {
  calls_today: number
  calls_this_week: number
  bookings_this_week: number
  booking_rate: number
  emergencies_this_week: number
  missed_calls_recovered: number
}

export interface CallLog {
  id: string
  call_id: string
  caller_number: string
  started_at: string
  ended_at: string | null
  was_emergency: boolean
  was_booked: boolean
  summary: string | null
  transcript: Array<{ role: string; content: string }>
  status: string
  duration_seconds: number | null
  /** Vapi call recording URL — null on older calls or if recording disabled. */
  recording_url: string | null
}

export interface CallsResponse {
  calls: CallLog[]
  offset: number
  limit: number
  count: number
}

export interface Booking {
  id: string
  caller_name: string
  caller_phone: string
  caller_address: string
  problem_description: string
  appointment_start: string
  appointment_end: string
  status: string
  confirmation_sms_sent: boolean
  fsm_synced: boolean
  created_at: string
}

export interface BookingsResponse {
  bookings: Booking[]
  count: number
}

export interface DailyCount {
  date: string
  count: number
}

export interface HourlyCount {
  hour: number
  count: number
}

export interface AnalyticsData {
  calls_per_day: DailyCount[]
  bookings_per_day: DailyCount[]
  calls_by_hour: HourlyCount[]
  emergency_rate: number
  period_days: number
}

export interface ClientSettings {
  id: string
  business_name: string
  emergency_phone_number: string
  working_hours: Record<string, string>
  services_offered: string[]
  service_area_description: string
  google_review_link: string | null
  vapi_assistant_id: string | null
  twilio_phone_number: string | null
  is_active: boolean
  fsm_type: string | null
  created_at: string
  updated_at: string
}

export interface MeResponse {
  user_id: string
  email: string | null
  is_admin: boolean
}

// ---------------------------------------------------------------------------
// Admin types
// ---------------------------------------------------------------------------

export interface AdminClientSummary {
  id: string
  business_name: string
  email: string | null
  is_active: boolean
  calls_this_month: number
  last_call_at: string | null
  bookings_this_month: number
  monthly_cost_estimate: number
}

export interface ClientCreatePayload {
  business_name: string
  email: string
  emergency_phone: string
  services_offered: string[]
  working_hours: Record<string, { open: string; close: string } | null>
  service_area_description: string
  zip_codes: string[]
  area_code: string
  pricing_ranges: Record<string, string>
  fsm_type?: string | null
  jobber_api_key?: string | null
  housecall_pro_api_key?: string | null
}

export interface ClientCreateResponse {
  client_id: string
  phone_number: string
  setup_complete: boolean
  next_step: string
  message: string
}

export interface ImpersonateResponse {
  client_id: string
  business_name: string
  email: string | null
  is_active: boolean
  dashboard_url: string
}

export interface SettingsPayload {
  business_name?: string
  emergency_phone_number?: string
  working_hours?: Record<string, string>
  services_offered?: string[]
  service_area_description?: string
  google_review_link?: string
  jobber_api_key?: string
  housecall_pro_api_key?: string
}

// ---------------------------------------------------------------------------
// Fetch helper
// ---------------------------------------------------------------------------

async function apiFetch<T>(
  path: string,
  token: string,
  options?: RequestInit,
): Promise<T> {
  const resp = await fetch(`${BASE}${path}`, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
      ...(options?.headers ?? {}),
    },
  })
  if (!resp.ok) {
    const body = await resp.text()
    throw new Error(`API ${resp.status}: ${body}`)
  }
  return resp.json() as Promise<T>
}

// ---------------------------------------------------------------------------
// API functions
// ---------------------------------------------------------------------------

export function getOverview(token: string, clientId: string): Promise<OverviewMetrics> {
  return apiFetch(`/api/dashboard/overview?client_id=${clientId}`, token)
}

export function getCalls(
  token: string,
  clientId: string,
  params: {
    limit?: number
    offset?: number
    emergency_only?: boolean
    booked_only?: boolean
    start?: string
    end?: string
  } = {},
): Promise<CallsResponse> {
  const q = new URLSearchParams({ client_id: clientId })
  if (params.limit != null) q.set('limit', String(params.limit))
  if (params.offset != null) q.set('offset', String(params.offset))
  if (params.emergency_only) q.set('emergency_only', 'true')
  if (params.booked_only) q.set('booked_only', 'true')
  if (params.start) q.set('start', params.start)
  if (params.end) q.set('end', params.end)
  return apiFetch(`/api/dashboard/calls?${q}`, token)
}

export function getBookings(
  token: string,
  clientId: string,
  start?: string,
  end?: string,
): Promise<BookingsResponse> {
  const q = new URLSearchParams({ client_id: clientId })
  if (start) q.set('start', start)
  if (end) q.set('end', end)
  return apiFetch(`/api/dashboard/bookings?${q}`, token)
}

export function getAnalytics(
  token: string,
  clientId: string,
  period = '30d',
): Promise<AnalyticsData> {
  return apiFetch(`/api/dashboard/analytics?client_id=${clientId}&period=${period}`, token)
}

export function getSettings(token: string, clientId: string): Promise<ClientSettings> {
  return apiFetch(`/api/dashboard/settings?client_id=${clientId}`, token)
}

export function updateSettings(
  token: string,
  clientId: string,
  payload: SettingsPayload,
): Promise<ClientSettings> {
  return apiFetch(`/api/dashboard/settings?client_id=${clientId}`, token, {
    method: 'PUT',
    body: JSON.stringify(payload),
  })
}

export function getMe(token: string): Promise<MeResponse> {
  return apiFetch('/api/auth/me', token)
}

// ---------------------------------------------------------------------------
// Admin API functions
// ---------------------------------------------------------------------------

export function getAdminClients(token: string): Promise<AdminClientSummary[]> {
  return apiFetch('/api/admin/clients', token)
}

export function updateClientStatus(
  token: string,
  clientId: string,
  isActive: boolean,
): Promise<{ client_id: string; is_active: boolean }> {
  return apiFetch(`/api/admin/clients/${clientId}/status`, token, {
    method: 'PUT',
    body: JSON.stringify({ is_active: isActive }),
  })
}

export function impersonateClient(
  token: string,
  clientId: string,
): Promise<ImpersonateResponse> {
  return apiFetch(`/api/admin/clients/${clientId}/impersonate`, token)
}

export function createClient(
  token: string,
  payload: ClientCreatePayload,
): Promise<ClientCreateResponse> {
  return apiFetch('/api/clients/create', token, {
    method: 'POST',
    body: JSON.stringify(payload),
  })
}

export function updateBookingStatus(
  token: string,
  clientId: string,
  bookingId: string,
  status: 'confirmed' | 'completed' | 'cancelled',
): Promise<Booking> {
  const q = new URLSearchParams({ client_id: clientId, status })
  return apiFetch(`/api/dashboard/bookings/${bookingId}?${q}`, token, {
    method: 'PATCH',
  })
}
