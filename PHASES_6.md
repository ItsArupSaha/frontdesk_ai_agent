# Phase 6 — React Dashboard

## Goal
A clean, functional dashboard that the client logs into to see:
call history, bookings, live activity, and business settings.
This is what justifies the monthly fee visually — the client sees
the product working for them every day.

---

## Tech stack (frontend)
- React 18 + Vite + TypeScript
- Tailwind CSS (utility classes only — no component library like shadcn yet)
- Recharts for analytics charts
- React Query (TanStack Query) for server state
- Supabase JS client for auth and realtime
- React Router v6 for navigation

---

## New backend routes needed

### Update backend/routers/dashboard_api.py
All routes require authentication (Supabase JWT verification).

`GET /api/dashboard/overview?client_id=...`
Returns:
```json
{
  "calls_today": 12,
  "calls_this_week": 47,
  "bookings_this_week": 8,
  "booking_rate": 0.17,
  "emergencies_this_week": 2,
  "missed_calls_recovered": 3
}
```

`GET /api/dashboard/calls?client_id=...&limit=50&offset=0`
Returns paginated call_logs with summary, duration, was_emergency, was_booked.

`GET /api/dashboard/bookings?client_id=...&start=...&end=...`
Returns bookings in date range.

`GET /api/dashboard/analytics?client_id=...&period=30d`
Returns time-series data for calls per day, bookings per day.

`GET /api/dashboard/settings?client_id=...`
Returns client_config (excluding sensitive API keys).

`PUT /api/dashboard/settings?client_id=...`
Updates client_config. Re-ingests knowledge base if services/area changed.

---

## Frontend pages to build

### frontend/src/pages/Dashboard.tsx
- 4 metric cards at top: Calls Today, Bookings This Week, Booking Rate, Emergencies
- Line chart (Recharts): calls per day for last 30 days
- Recent calls table: last 10 calls with status badges
- "Live" indicator — Supabase realtime subscription updates call count in real time

### frontend/src/pages/CallLogs.tsx
- Searchable, filterable table of all calls
- Filters: date range, emergency only, booked only
- Click a row → expand to show full transcript and summary
- Export to CSV button

### frontend/src/pages/Bookings.tsx
- Calendar view (simple week grid — build from scratch, no library)
- List view toggle
- Click booking → show details panel with caller info, problem, status
- Status update: mark as completed

### frontend/src/pages/Analytics.tsx
- Calls per day (line chart)
- Booking rate over time (line chart)
- Calls by hour of day (bar chart — shows when calls peak)
- Emergency rate (single number with color: green if <10%, red if higher)

### frontend/src/pages/Settings.tsx
- Form: business name, services (tag input), working hours (per-day inputs),
  service area (text area), emergency phone, pricing ranges, Google review link
- "Reconnect Google Calendar" button → triggers OAuth flow
- "Add Jobber API Key" section (password input, stored securely)
- "Add Housecall Pro API Key" section
- Save button → PUT /api/dashboard/settings

### frontend/src/components/
- Navbar.tsx — sidebar navigation with page links
- MetricCard.tsx — reusable stat card
- StatusBadge.tsx — colored pill for call status
- CallRow.tsx — expandable call log row
- LoadingSpinner.tsx

---

## Tests to write
- Basic React component tests using Vitest
- test that Dashboard renders without crashing
- test that CallLogs filters work correctly
- test that Settings form submits correctly

---

## Definition of done for Phase 6
- [ ] `npm run dev` starts frontend without errors
- [ ] Login with Supabase auth works
- [ ] Dashboard page shows real data from backend
- [ ] Call logs page shows all calls and expands transcripts
- [ ] Settings page saves and loads correctly
- [ ] Realtime counter updates when a new call comes in
- [ ] `npm run build` produces no TypeScript errors
