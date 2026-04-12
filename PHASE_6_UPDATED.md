# Phase 6 — React Dashboard (Updated Spec)
# Depends on: Phases 1-5 complete, 87/87 tests passing
# Status: IN PROGRESS — continue from where you stopped

## IMPORTANT — read before continuing
This is the updated spec. Some parts are already built.
Do not rebuild what already works.
Read the current state of frontend/ first, then apply
only what is missing from this spec.

---

## Tech stack (frontend)
- React 18 + Vite + TypeScript
- Tailwind CSS (utility classes only)
- Recharts for analytics charts
- React Query (TanStack Query) for server state
- Supabase JS client for auth and realtime
- React Router v6 for navigation
- date-fns for all date logic (do not do date math manually)

---

## Frontend environment file
Create frontend/.env if it does not exist:
```
VITE_API_URL=http://localhost:8000
VITE_SUPABASE_URL=your_supabase_url
VITE_SUPABASE_ANON_KEY=your_supabase_anon_key
```
All API calls use import.meta.env.VITE_API_URL as base URL.
Never hardcode localhost:8000 anywhere in components.

---

## Auth and client_id mapping
This is how the frontend knows who is logged in:

On login, Supabase returns a user session.
Use supabase.auth.getUser() to get the user.
The user.id from Supabase auth IS the client_id
used in all backend API calls.

Store this in a React context (AuthContext) so
every component can access client_id without prop drilling.

Example:
```typescript
const { data: { user } } = await supabase.auth.getUser()
const clientId = user?.id  // this is your client_id
```

All backend calls: GET /api/dashboard/overview?client_id={clientId}

---

## New backend routes needed

### Update backend/routers/dashboard_api.py
All routes require Supabase JWT verification.
Extract client_id from JWT token — do not trust 
client_id from query params alone.

`GET /api/dashboard/overview`
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

`GET /api/dashboard/calls?limit=50&offset=0`
Returns paginated call_logs with:
- summary, duration, was_emergency, was_booked
- recording_url (from Vapi — may be null on older calls)
- caller_number, started_at, ended_at, status

`GET /api/dashboard/bookings?start=...&end=...`
Returns bookings in date range.

`GET /api/dashboard/analytics?period=30d`
Returns time-series data for calls per day, bookings per day.

`GET /api/dashboard/settings`
Returns client_config (exclude sensitive keys:
google_calendar_refresh_token_enc, jobber_api_key,
housecall_pro_api_key — never send these to frontend).

`PUT /api/dashboard/settings`
Updates client_config.
Re-ingests knowledge base if services or area changed.

---

## Frontend pages to build

### frontend/src/pages/Login.tsx
THIS WAS MISSING FROM ORIGINAL SPEC — build this first.

- Clean centered login form
- Email input + password input
- "Sign in" button
- On submit: call supabase.auth.signInWithPassword()
- On success: redirect to /dashboard
- On error: show inline error ("Invalid email or password")
- If user is already logged in: redirect to /dashboard immediately
- Route: /login
- Unauthenticated users on any route → redirected to /login

### frontend/src/pages/Dashboard.tsx
- 4 metric cards: Calls Today, Bookings This Week, 
  Booking Rate, Missed Calls Recovered
  (use Missed Calls Recovered instead of Emergencies —
  this directly shows ROI to the client)
- Line chart (Recharts): calls per day for last 30 days
- Recent calls table: last 10 calls with status badges
- "Live" badge — Supabase realtime subscription
  increments call count in real time without page refresh

### frontend/src/pages/CallLogs.tsx
- Searchable, filterable table of all calls
- Filters: date range, emergency only, booked only
- Click a row → expand to show:
  - Full transcript
  - AI-generated summary
  - AUDIO PLAYER: if recording_url is present,
    render <audio controls src={recording_url} />
    with a label "Call Recording"
    This is the client's "aha moment" —
    hearing the AI handle their calls perfectly
- Export to CSV button

### frontend/src/pages/Bookings.tsx
DO NOT build a calendar grid from scratch.
Use date-fns for all date logic.

Build a LIST VIEW only:
- Upcoming bookings sorted by appointment_start (ascending)
- Group by date using date-fns format(date, 'EEEE, MMMM d')
- Each booking shows: time, caller name, address, problem, status badge
- Click booking → slide-out or inline details panel:
  caller phone, full problem description, google_event_id link
- Status update button: "Mark as Completed"
  → PUT /api/dashboard/bookings/{id}/status

### frontend/src/pages/Analytics.tsx
- Calls per day (line chart, Recharts)
- Booking rate over time (line chart)
- Calls by hour of day (bar chart — shows peak hours)
- Emergency rate: single number, 
  green if <10%, amber if 10-20%, red if >20%

### frontend/src/pages/Settings.tsx
- Business name (text input)
- Services offered (tag-style input — add/remove tags)
- Working hours (toggle per day + start/end time per day)
- Service area (textarea)
- Emergency phone (text input)
- Google review link (text input)
- "Reconnect Google Calendar" button 
  → GET /auth/google/connect?client_id={clientId}
- Jobber API Key (password input, write-only — 
  show only "••••••••" if already set, 
  never read back the actual key)
- Housecall Pro API Key (same pattern)
- Save button → PUT /api/dashboard/settings
- Show success toast on save

---

## Components to build

### frontend/src/components/Navbar.tsx
Sidebar navigation:
- Logo / product name at top
- Links: Dashboard, Call Logs, Bookings, Analytics, Settings
- Active link highlighted
- Logout button at bottom → supabase.auth.signOut() → /login

### frontend/src/components/MetricCard.tsx
Props: label (string), value (string | number), 
       trend? (string), color? ('green'|'red'|'default')
Reusable stat card used in Dashboard.

### frontend/src/components/StatusBadge.tsx
Props: status ('emergency'|'booked'|'missed'|'in_progress')
Colored pill badge. emergency=red, booked=green, 
missed=amber, in_progress=gray.

### frontend/src/components/CallRow.tsx
Props: call (CallLog type)
Expandable row for CallLogs page.
Shows: time, caller number, duration, status badge
On expand: transcript, summary, audio player if recording_url present

### frontend/src/components/LoadingSpinner.tsx
Simple centered spinner for loading states.

### frontend/src/contexts/AuthContext.tsx
Provides: user, clientId, loading, signOut
Wraps the entire app.
On mount: checks existing Supabase session.
Redirects to /login if no session.

---

## Protected route pattern
```typescript
// frontend/src/components/ProtectedRoute.tsx
// Wraps routes that require auth
// If no session → redirect to /login
// If session exists → render children
```

## Router setup (App.tsx)
```
/login          → Login.tsx (public)
/dashboard      → Dashboard.tsx (protected)
/calls          → CallLogs.tsx (protected)
/bookings       → Bookings.tsx (protected)
/analytics      → Analytics.tsx (protected)
/settings       → Settings.tsx (protected)
/ (root)        → redirect to /dashboard
```

---

## lib files

### frontend/src/lib/supabase.ts
```typescript
import { createClient } from '@supabase/supabase-js'
export const supabase = createClient(
  import.meta.env.VITE_SUPABASE_URL,
  import.meta.env.VITE_SUPABASE_ANON_KEY
)
```

### frontend/src/lib/api.ts
All backend API calls in one place.
Base URL from import.meta.env.VITE_API_URL.
Every function attaches the Supabase JWT token
as Authorization: Bearer {token} header.
Functions: getOverview, getCalls, getBookings,
           getAnalytics, getSettings, updateSettings,
           updateBookingStatus

---

## Tests to write (Vitest)
- test Login page renders without crashing
- test Login redirects on successful auth (mock Supabase)
- test Dashboard renders metric cards
- test CallLogs filter by emergency works
- test CallLogs shows audio player when recording_url present
- test CallLogs hides audio player when recording_url is null
- test Settings form submits correctly
- test ProtectedRoute redirects unauthenticated users

---

## Definition of done for Phase 6
- [ ] npm run dev starts without errors
- [ ] Login page works — real Supabase auth
- [ ] Unauthenticated users redirected to /login
- [ ] Dashboard shows real data from backend API
- [ ] Metric cards show correct numbers
- [ ] Realtime call counter increments without page refresh
- [ ] Call logs expand to show transcript + summary
- [ ] Audio player appears on calls with recording_url
- [ ] Bookings list view shows upcoming appointments
  grouped by date using date-fns
- [ ] Analytics charts render with real data
- [ ] Settings saves and persists correctly
- [ ] Knowledge base re-ingests after services/area change
- [ ] npm run build — zero TypeScript errors
- [ ] All Vitest tests pass

## What Phase 6 does NOT include
- Multi-client admin panel — Phase 7
- Client onboarding wizard — Phase 7
- White-label — post-launch
- RLS — apply after Phase 6, before E2E test
