# Phase 3 — RAG Knowledge Base + Call Summaries
# Estimated time: 1 week
# Depends on: Phase 2 complete
# Status: NOT STARTED

## Goal
The agent gives accurate, business-specific answers instead of generic ones.
"Do you fix tankless water heaters?" gets a real yes/no from that business's
knowledge base. Call summaries are auto-generated and stored after every call.

---

## New dependency
```
pgvector  (already available in Supabase — enable the extension)
openai==1.30.0  (for text-embedding-3-small embeddings — cheaper than Anthropic)
```
NOTE: We use OpenAI embeddings only. Claude still handles all reasoning.
Add OPENAI_API_KEY to .env.example (embeddings only, ~$0.0001 per query).

---

## New files to create

### backend/db/migrations/003_knowledge_base.sql
```sql
-- Enable pgvector
create extension if not exists vector;

-- Knowledge base chunks per client
create table if not exists knowledge_chunks (
  id uuid primary key default gen_random_uuid(),
  client_id uuid not null references clients(id),
  content text not null,
  embedding vector(1536),
  category text,  -- 'services', 'pricing', 'faq', 'area', 'hours'
  created_at timestamptz not null default now()
);

create index on knowledge_chunks using ivfflat (embedding vector_cosine_ops)
  with (lists = 100);
create index on knowledge_chunks(client_id);
```

### backend/services/rag_service.py

`async def embed_text(text: str) -> list[float]`
- Call OpenAI text-embedding-3-small
- Return 1536-dimension vector

`async def ingest_client_knowledge(client_id: str, client_config: dict) -> None`
- Convert client_config into knowledge chunks:
  - One chunk per service offered
  - One chunk for working hours
  - One chunk for service area description
  - One chunk for pricing ranges if available
  - One chunk for business description
- Embed each chunk
- Upsert into knowledge_chunks table
- Called once during client onboarding, and when client updates their settings

`async def query_knowledge(client_id: str, question: str, top_k: int = 3) -> str`
- Embed the question
- Query knowledge_chunks using cosine similarity:
  ```sql
  select content from knowledge_chunks
  where client_id = $1
  order by embedding <=> $2
  limit $3
  ```
- Concatenate top_k results into a context string
- Return context string for Claude to use

### Update backend/agents/tools.py — update get_business_info tool
- Phase 1 used client_config directly
- Now call rag_service.query_knowledge() instead
- The tool becomes genuinely intelligent:
  "Do you fix commercial HVAC?" → RAG finds relevant chunks → Claude answers accurately

### backend/utils/summarizer.py

`async def generate_call_summary(transcript: list[dict], client_config: dict) -> str`
- Use Claude to generate a structured summary from the transcript
- Prompt: "Summarize this call in 3-4 sentences. Include:
  what the customer needed, what was resolved or booked, any follow-up needed.
  Be factual and concise."
- Return the summary string

### Update backend/routers/vapi_webhook.py
- On call-ended webhook: call generate_call_summary()
- Store summary in call_logs.summary column
- This gives the client readable call history in dashboard

---

## Tests to write

### tests/test_rag.py (mock OpenAI and Supabase)
- test_ingest_creates_chunks_for_each_service()
- test_query_returns_relevant_content()
- test_query_returns_empty_string_if_no_chunks()
- test_embed_text_returns_1536_dimensions()

### tests/test_summarizer.py (mock Claude)
- test_summary_generated_from_transcript()
- test_summary_handles_empty_transcript()
- test_summary_handles_emergency_call()

---

## Definition of done for Phase 3
- [ ] All previous tests still pass
- [ ] Run ingest for test client → verify chunks in DB
- [ ] Query "do you fix water heaters" → returns relevant chunk
- [ ] get_business_info tool now uses RAG (not raw config)
- [ ] Call summaries stored in DB after call-ended webhook
- [ ] All new tests pass

---
---

# Phase 4 — Jobber + Housecall Pro Integrations
# Estimated time: 1 week
# Depends on: Phase 3 complete
# Status: NOT STARTED

## Goal
When a booking is made, a job is automatically created in the client's
FSM (Jobber or Housecall Pro). No manual data entry for the client.
This is a key value-add that justifies the monthly fee.

---

## New env vars (per-client in DB, not .env)
```
jobber_api_key       (optional)
housecall_pro_api_key (optional)
fsm_type             ("jobber" | "housecallpro" | null)
```

---

## New files to create

### backend/services/jobber_service.py
Jobber uses GraphQL API.

`async def create_client_and_request(booking: Booking, jobber_api_key: str) -> dict`
- Step 1: Search for existing client by phone
  GraphQL query: `client(filter: {phone: $phone}) { id }`
- Step 2: If not found → create client
  GraphQL mutation: `clientCreate(input: {...})`
- Step 3: Create request (Jobber's term for a job request)
  GraphQL mutation: `requestCreate(input: {clientId, title, description})`
- Return: {"client_id": "...", "request_id": "..."}
- Error handling: if Jobber API fails, log error, return None
  (do NOT fail the booking — FSM sync is best-effort)

Base URL: https://api.jobber.com/api/graphql
Auth: Bearer token from jobber_api_key
API version header: X-JOBBER-GRAPHQL-VERSION: 2024-01-05

### backend/services/housecall_service.py
Housecall Pro uses REST API.

`async def create_customer_and_job(booking: Booking, hcp_api_key: str) -> dict`
- Step 1: POST /customers — create or update customer
- Step 2: POST /jobs — create job linked to customer
- Return: {"customer_id": "...", "job_id": "..."}
- Same error handling as Jobber — best-effort, never fail the booking

Base URL: https://api.housecallpro.com
Auth: Token token="{hcp_api_key}"

### backend/services/fsm_service.py
Unified interface — callers use this, not the individual services.

`async def sync_booking_to_fsm(booking: Booking, client_config: dict) -> None`
- Read fsm_type from client_config
- If "jobber" → call jobber_service.create_client_and_request()
- If "housecallpro" → call housecall_service.create_customer_and_job()
- If None → skip silently
- Run as FastAPI background task (non-blocking)
- Retry on failure: 3 attempts with 5-second backoff
- After 3 failures: log critical error with full context

### Update backend/agents/tools.py
Tool: `create_fsm_record` — was a stub in Phase 1
- Now actually calls fsm_service.sync_booking_to_fsm()
- Claude calls this automatically after book_appointment tool succeeds

### backend/db/migrations/004_fsm_sync.sql
```sql
-- Track FSM sync status per booking
alter table bookings add column if not exists
  fsm_synced boolean not null default false;
alter table bookings add column if not exists
  fsm_record_id text;
alter table bookings add column if not exists
  fsm_sync_error text;
```

---

## Tests to write

### tests/test_jobber.py (mock httpx)
- test_creates_new_client_when_not_found()
- test_reuses_existing_client_when_found()
- test_creates_request_after_client()
- test_jobber_api_failure_returns_none_not_exception()

### tests/test_housecall.py (mock httpx)
- test_creates_customer_and_job()
- test_hcp_api_failure_returns_none_not_exception()

### tests/test_fsm_service.py
- test_routes_to_jobber_when_fsm_type_is_jobber()
- test_routes_to_hcp_when_fsm_type_is_housecallpro()
- test_skips_when_fsm_type_is_none()
- test_retries_on_failure()

---

## Definition of done for Phase 4
- [ ] All previous tests still pass
- [ ] All new tests pass
- [ ] Booking flow now also syncs to FSM (mocked in tests)
- [ ] FSM failure does NOT break the booking confirmation
- [ ] fsm_synced column updated after successful sync

---
---

# Phase 5 — SMS Automation Flows
# Estimated time: 1 week
# Depends on: Phase 4 complete
# Status: NOT STARTED

## Goal
Three automated SMS workflows running without any manual action:
1. Appointment reminder (24h before appointment)
2. Post-job review request (2h after appointment end time)
3. Missed-call recovery (when call ends without a booking)

---

## New file to create

### backend/services/scheduler.py
Use APScheduler (lightweight, no Redis needed for our scale).

Add to requirements.txt:
```
apscheduler==3.10.4
```

`setup_scheduler(app: FastAPI) -> None`
- Configure AsyncIOScheduler
- Add job: `process_reminders` — runs every 5 minutes
- Add job: `process_review_requests` — runs every 15 minutes
- Start scheduler on app startup, stop on shutdown

`async def process_reminders() -> None`
- Query reminders_queue where:
  scheduled_for <= now() + 10 minutes AND sent = false AND type = 'reminder'
- For each reminder:
  - Get booking details
  - Call sms_service.send_sms() with reminder message
  - Mark sent = true in DB
  - Message format: "Reminder: {business_name} appointment tomorrow
    at {time}. Address confirmation: {address}. Questions? Reply here."

`async def process_review_requests() -> None`
- Query reminders_queue where:
  scheduled_for <= now() AND sent = false AND type = 'review_request'
- For each:
  - Call sms_service.send_sms() with review request
  - Message: "Hi {name}! Hope {business_name} took great care of you today.
    Mind leaving a quick review? It means a lot:
    https://g.page/{google_review_link}/review"
  - Mark sent = true

### backend/db/migrations/005_reminders.sql
```sql
create table if not exists reminders_queue (
  id uuid primary key default gen_random_uuid(),
  client_id uuid not null references clients(id),
  booking_id uuid references bookings(id),
  type text not null,  -- 'reminder' | 'review_request' | 'missed_call_recovery'
  to_number text not null,
  scheduled_for timestamptz not null,
  sent boolean not null default false,
  sent_at timestamptz,
  message_body text not null,
  created_at timestamptz not null default now()
);

create index on reminders_queue(scheduled_for) where sent = false;
```

### Update backend/agents/tools.py — update book_appointment tool
After successful booking:
- Insert reminder_queue row: type='reminder', scheduled_for = appointment_start - 24h
- Insert reminder_queue row: type='review_request', scheduled_for = appointment_end + 2h

### Update backend/routers/vapi_webhook.py — missed call recovery
On call-ended webhook where was_booked = false AND call duration > 15 seconds:
- Insert reminder_queue row: type='missed_call_recovery', scheduled_for = now() + 2 minutes
- Message: "Hi! We missed your call at {business_name}. Still need help?
  Reply here and we'll get back to you shortly."

### Update backend/main.py
- Import scheduler and call setup_scheduler(app) in lifespan

### Update clients table — add google_review_link column
```sql
alter table clients add column if not exists google_review_link text;
```

---

## Tests to write

### tests/test_scheduler.py (mock time and SMS service)
- test_reminder_sent_when_due()
- test_reminder_not_sent_before_due()
- test_reminder_not_sent_twice()
- test_review_request_sent_after_appointment()
- test_missed_call_recovery_triggered_on_no_booking()

---

## Definition of done for Phase 5
- [ ] All previous tests pass
- [ ] Scheduler starts with the app (check logs on startup)
- [ ] Insert test reminder with scheduled_for = now() → verify SMS sent within 5 min
- [ ] Insert test missed-call recovery → verify SMS sent
- [ ] All new tests pass

---
---

# Phase 6 — React Dashboard
# Estimated time: 1 week
# Depends on: Phase 5 complete
# Status: NOT STARTED

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

---
---

# Phase 7 — Multi-Client Panel + Client Onboarding + Polish
# Estimated time: 1 week
# Depends on: Phase 6 complete
# Status: NOT STARTED

## Goal
You (Arup) can manage all clients from one panel. New clients
can onboard themselves through a guided form. The product is
production-ready: error handling is solid, edge cases are covered,
and you can confidently demo this to a real business.

---

## New pages and features

### frontend/src/pages/AdminPanel.tsx (Arup only — role-gated)
- Table of all clients: name, status (active/inactive), calls this month,
  last call time, monthly cost estimate
- "Add new client" button → opens onboarding wizard
- Click client → view their dashboard as if you were them
- Suspend/reactivate client toggle

### frontend/src/pages/ClientOnboarding.tsx
A multi-step wizard for onboarding a new client:

Step 1: Business basics
- Business name, phone number, services (checkboxes: plumbing, HVAC, electrical,
  plus free-text for others), emergency contact phone

Step 2: Working hours
- Toggle per day, start/end time per day

Step 3: Service area
- Text description + zip codes (comma separated)

Step 4: Pricing info (optional but recommended for RAG)
- Rough pricing ranges per service type

Step 5: Connect Google Calendar
- "Connect Calendar" button → triggers OAuth
- Show green checkmark when connected

Step 6: FSM integration (optional)
- Dropdown: "Do you use Jobber, Housecall Pro, or neither?"
- If Jobber/HCP → show API key input with instructions

Step 7: Review and launch
- Summary of all settings
- "Launch Agent" button → calls POST /api/clients/create
  - Creates client record in DB
  - Creates Vapi assistant via Vapi API
  - Provisions Twilio number
  - Ingests knowledge base (RAG)
  - Returns the phone number to forward calls to

### backend/routers/onboarding.py — new routes

`POST /api/clients/create`
- Creates client record in DB
- Calls vapi_service.create_assistant(client_config) → gets assistant_id
- Calls twilio to purchase a local phone number in client's area code
- Stores vapi_assistant_id and twilio_phone_number in DB
- Calls rag_service.ingest_client_knowledge()
- Returns: {"phone_number": "+1...", "setup_complete": true}

### backend/services/vapi_service.py
`async def create_assistant(client_config: dict) -> str`
- POST to Vapi API to create a new assistant
- Configure it with:
  - Webhook URL pointing to our /webhook/vapi endpoint
  - Voice: ElevenLabs with a natural-sounding voice
  - First message: "Thanks for calling {business_name}, this is Alex!
    How can I help you today?"
- Return assistant_id

`async def update_assistant(assistant_id: str, client_config: dict) -> None`
- Called when client updates settings
- Updates assistant's first message and webhook URL if changed

---

## Polish items for Phase 7

### Error handling audit
Go through every integration and confirm:
- Calendar down → agent says "let me have someone call you back"
- Twilio down → booking still works, SMS logged as failed
- Vapi webhook timeout → fallback fires, not a 500 error
- DB unreachable → log critical, return safe fallback to Vapi
- All errors trigger a notification (for now: log to console + structured log)

### Security audit
- All client API keys encrypted at rest (Fernet symmetric encryption)
- All dashboard routes verify JWT
- Vapi webhook verifies signature
- Rate limiting on all public endpoints (use slowapi)
- Never log phone numbers or API keys

### Load test
- Simulate 10 concurrent Vapi webhooks hitting the server
- Verify all 10 get responses within 3 seconds
- Confirm no DB connection pool exhaustion

### Documentation
- docs/setup.md: complete local setup guide
- docs/client-onboarding.md: step-by-step guide you give to new clients
- Update CLAUDE.md: mark all phases complete, add any known issues

---

## Definition of done for Phase 7 (= Production Ready)
- [ ] Admin panel shows all clients and their stats
- [ ] Onboarding wizard creates a new client end-to-end
- [ ] "Launch Agent" returns a working phone number
- [ ] Calling that number reaches the Vapi agent
- [ ] Emergency keyword transfers to the right phone
- [ ] Normal call books appointment → appears in DB + Google Calendar
- [ ] SMS confirmation received on real phone
- [ ] Dashboard shows the call and booking in real time
- [ ] All tests pass: pytest tests/ -v (0 failures)
- [ ] No TypeScript errors: npm run build
- [ ] Security audit items complete
- [ ] Load test passes

## You are now ready to sell.
