# Phase 2 — Google Calendar Booking + Lead Qualification + SMS Confirmation
# Estimated time: 1 week
# Depends on: Phase 1 complete and ALL tests passing
# Status: NOT STARTED

## Goal
The agent completes the full booking loop:
qualify caller → collect their details → check real calendar availability
→ book the appointment → confirm verbally → send SMS confirmation.

By end of Phase 2, a real caller can go from "I need my AC fixed"
to a confirmed slot on the Google Calendar AND an SMS in their pocket —
all without a human touching anything.

---

## New environment variables
Add these to backend/.env.example:

```
# Google OAuth2
GOOGLE_CLIENT_ID=
GOOGLE_CLIENT_SECRET=
GOOGLE_REDIRECT_URI=http://localhost:8000/auth/google/callback

# Twilio
TWILIO_ACCOUNT_SID=
TWILIO_AUTH_TOKEN=
TWILIO_FROM_NUMBER=
```

These are YOUR keys (Arup's). Per-client Google refresh tokens are
stored encrypted in the DB — never in .env.

---

## New dependencies
Add to backend/requirements.txt:
```
google-auth==2.29.0
google-auth-oauthlib==1.2.0
google-api-python-client==2.128.0
twilio==9.0.4
cryptography==42.0.5
```

`cryptography` is for Fernet encryption of client API keys stored in DB.

---

## New DB migration

### backend/db/migrations/002_bookings_and_calendar.sql
```sql
-- Bookings table
create table if not exists bookings (
  id uuid primary key default gen_random_uuid(),
  client_id uuid not null references clients(id),
  call_id text references call_logs(call_id),
  caller_name text not null,
  caller_phone text not null,
  caller_address text not null,
  problem_description text not null,
  appointment_start timestamptz not null,
  appointment_end timestamptz not null,
  google_event_id text,
  confirmation_sms_sent boolean not null default false,
  status text not null default 'confirmed',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index on bookings(client_id);
create index on bookings(appointment_start);
create index on bookings(status);

-- Add Google Calendar fields to clients table
alter table clients
  add column if not exists google_calendar_refresh_token_enc text,
  add column if not exists google_calendar_id text default 'primary';

-- Update test client with a placeholder area code for Twilio
alter table clients
  add column if not exists service_area_code text default '718';
```

---

## New files to create (in this exact order)

---

### 1. backend/utils/encryption.py
All sensitive client credentials (refresh tokens, API keys) must be
encrypted before storing in DB. Use Fernet symmetric encryption.

```python
"""
Encrypt and decrypt sensitive strings for DB storage.
Key is derived from APP_SECRET_KEY in settings.
"""
from cryptography.fernet import Fernet
import base64, hashlib
from config import settings

def _get_fernet() -> Fernet:
    # Derive a 32-byte key from APP_SECRET_KEY
    key = hashlib.sha256(settings.app_secret_key.encode()).digest()
    return Fernet(base64.urlsafe_b64encode(key))

def encrypt(plain_text: str) -> str:
    """Encrypt a string. Returns encrypted string safe to store in DB."""
    ...

def decrypt(encrypted_text: str) -> str:
    """Decrypt a string retrieved from DB."""
    ...
```

Implement both functions fully.
Write simple unit tests in tests/test_encryption.py:
- test_encrypt_decrypt_roundtrip()
- test_different_texts_produce_different_ciphertext()
- test_decrypt_wrong_key_raises()

---

### 2. backend/services/calendar_service.py
Full Google Calendar integration. Everything async.

#### Functions to implement:

**`get_oauth_url(client_id: str) -> str`**
- Build Google OAuth2 authorization URL
- Scopes: `https://www.googleapis.com/auth/calendar`
- State parameter: client_id (so we know which client after redirect)
- access_type: "offline" (required to get refresh_token)
- prompt: "consent" (forces refresh_token every time)
- Return the full authorization URL string

**`handle_oauth_callback(code: str, client_id: str) -> None`**
- Exchange authorization code for tokens using google-auth-oauthlib
- Extract refresh_token from response
- Encrypt refresh_token using encryption.encrypt()
- Store in clients.google_calendar_refresh_token_enc in DB
- Raise CalendarAuthError if code exchange fails
- Raise CalendarAuthError if no refresh_token in response
  (this happens if user already authorized — they need to revoke and re-authorize)

**`_get_credentials(client_id: str) -> google.oauth2.credentials.Credentials`**
Private helper. Called by all functions that need Calendar access.
- Fetch encrypted refresh token from DB for this client_id
- If not found → raise CalendarNotConnectedError
- Decrypt it using encryption.decrypt()
- Build Credentials object with refresh_token + client_id + client_secret
- Return credentials (google-auth will auto-refresh access token as needed)

**`get_available_slots(client_id: str, date_preference: str, duration_minutes: int = 60) -> list[dict]`**
- Get credentials via _get_credentials()
- Build Google Calendar API service using build('calendar', 'v3', credentials=creds)
- Determine date range to search:
  - "today" → today only
  - "tomorrow" → tomorrow only
  - "this week" → next 5 business days
  - "Monday" / day name → next occurrence of that day
  - Default (no preference) → next 3 business days
- Call calendar.freebusy().query() to get busy periods
- Use client's working_hours from DB to define the bookable window per day
  (do not offer slots outside working hours)
- Find gaps in the busy periods that fit duration_minutes
- Return at most 3 slots as:
  ```python
  [
    {
      "start": "2024-01-15T10:00:00",
      "end":   "2024-01-15T11:00:00",
      "label": "Monday January 15 at 10:00 AM"
    }
  ]
  ```
- If no slots found → return empty list []
- Error handling: if Google API call fails → raise CalendarAPIError

**`book_appointment(client_id: str, slot: dict, caller_details: dict) -> dict`**
```
caller_details shape:
{
  "name": str,
  "phone": str,
  "address": str,
  "problem_description": str
}
```
- Get credentials via _get_credentials()
- Create Google Calendar event:
  - summary: f"{caller_details['name']} — {caller_details['problem_description'][:60]}"
  - description: full formatted block with all caller details
  - start: slot["start"] with client's timezone (default America/New_York)
  - end: slot["end"]
  - colorId: "11" (red) if problem_description has emergency keywords, else "1" (blue)
- Call calendar.events().insert() with calendarId from client config
- Return the created event dict (includes event id)
- Error handling: if insert fails → raise CalendarBookingError with full context

#### Custom exceptions (define at top of file):
```python
class CalendarNotConnectedError(Exception): pass
class CalendarAuthError(Exception): pass
class CalendarAPIError(Exception): pass
class CalendarBookingError(Exception): pass
```

---

### 3. backend/services/sms_service.py
Twilio SMS. Keep it simple — Twilio SDK handles the complexity.

#### Functions to implement:

**`send_sms(to_number: str, message: str, client_id: str) -> dict`**
- Validate to_number is E.164 format (+1xxxxxxxxxx) — if not, log warning and return failure
- Send via Twilio Python SDK:
  ```python
  from twilio.rest import Client
  client = Client(settings.twilio_account_sid, settings.twilio_auth_token)
  message = client.messages.create(body=message, from_=settings.twilio_from_number, to=to_number)
  ```
- NEVER raise on failure — SMS failing must not crash anything
- On success: return {"success": True, "sid": message.sid}
- On failure: log the error with full context, return {"success": False, "error": str(e)}

**`send_booking_confirmation(booking_details: dict, client_config: dict) -> dict`**
```
booking_details shape:
{
  "caller_name": str,
  "caller_phone": str,
  "appointment_label": str,   # e.g. "Monday January 15 at 10:00 AM"
  "business_name": str
}
```
Message format:
```
Hi {caller_name}! Your appointment with {business_name} is confirmed
for {appointment_label}. We'll see you then! Reply STOP to opt out.
```
- Call send_sms()
- Return result from send_sms()

**`send_missed_call_recovery(caller_number: str, business_name: str, client_id: str) -> dict`**
Message format:
```
Hi! We missed your call at {business_name}. Still need help?
Reply here and we'll get back to you shortly.
```
- Call send_sms()
- Return result

---

### 4. backend/routers/onboarding.py
Google OAuth2 callback route.

**`GET /auth/google/callback`**
- Query params: `code` (str), `state` (str = client_id)
- Call calendar_service.handle_oauth_callback(code, state)
- On success: return HTML page:
  ```html
  <html><body style="font-family:sans-serif;text-align:center;padding:60px">
  <h2>✅ Google Calendar connected!</h2>
  <p>You can close this tab and return to setup.</p>
  </body></html>
  ```
- On CalendarAuthError: return HTML error page with instructions to try again

**`GET /auth/google/connect?client_id=...`**
- Calls calendar_service.get_oauth_url(client_id)
- Redirects user to the Google OAuth URL
- This is what the onboarding form's "Connect Calendar" button hits

---

### 5. Update backend/agents/tools.py — add 3 new tools

**Tool: `check_calendar`**
```
Input schema:
  date_preference: str  — what the caller said ("tomorrow", "this week", "Monday", etc.)

Behavior:
  - Call calendar_service.get_available_slots(client_id, date_preference)
  - If slots found: format as readable string:
    "I have these times available: [1] Monday at 10am, [2] Monday at 2pm,
     [3] Tuesday at 9am. Which works best for you?"
  - If no slots: return "I don't see any openings in that timeframe.
    Let me check with the team and have someone call you back to schedule."

Error handling:
  - CalendarNotConnectedError → "Let me have someone call you back to confirm
    the appointment."
  - Any other error → same fallback
  - Never let calendar errors propagate up to crash the agent
```

**Tool: `book_appointment`**
```
Input schema:
  slot_label: str         — which slot the caller chose (e.g. "Monday at 10am")
  slot_start: str         — ISO datetime string of the slot start
  slot_end: str           — ISO datetime string of the slot end
  caller_name: str
  caller_phone: str
  caller_address: str
  problem_description: str

Behavior:
  - Call calendar_service.book_appointment() with slot and caller details
  - Call sms_service.send_booking_confirmation() with booking and client_config
  - Save booking to DB (bookings table)
  - Update call_logs.was_booked = True for this call_id
  - Return confirmation string for Claude to read:
    "Perfect! I've booked you in for {slot_label}. You'll receive a
     text confirmation shortly. Is there anything else I can help with?"

Error handling:
  - CalendarBookingError → "I had trouble confirming that slot. Let me have
    someone call you right back to lock in your appointment."
  - Never raise — always return a string
```

**Tool: `request_callback`**
```
Input schema:
  caller_name: str
  caller_phone: str
  reason: str

Behavior:
  Use this when: calendar is unavailable, caller prefers callback,
  or caller is outside service area but might be serviced later.
  - Save a "callback_requested" record to DB
  - Return: "Got it, {caller_name}. Someone from our team will call
    you back at {caller_phone} as soon as possible."
```

---

### 6. Update backend/agents/nodes.py — add 2 new nodes

**`collect_info_node(state: AgentState) -> AgentState`**

This node's only job is to collect the 4 things needed to book:
caller name, phone number, address, problem description.

Logic:
```
Check state for each field:
  - caller_name missing → ask "Can I get your name?"
  - caller_phone missing → ask "And what's the best number to reach you?"
  - caller_address missing → ask "What's the service address?"
  - problem_description missing → ask "Can you describe the issue briefly?"

Ask ONE question per turn.
When ALL 4 are collected → set state.collection_complete = True
```

Claude system prompt for this node:
```
You are collecting information to book a service appointment.
Ask for ONE missing piece of information at a time.
Be conversational and natural — don't sound like a form.
Once you have name, phone, address, and problem description,
do not ask anything else. The routing will handle the next step.
```

Update AgentState in state.py to add:
```python
collection_complete: bool = False
available_slots: list[dict] = []
chosen_slot: dict | None = None
```

**`booking_node(state: AgentState) -> AgentState`**

Logic:
```
If state.available_slots is empty:
  → Call check_calendar tool with "this week" as default preference
  → Store returned slots in state.available_slots
  → Read slot options to caller

If caller has chosen a slot (detect from their response):
  → Call book_appointment tool with chosen slot + caller details
  → Set state.booking_complete = True

If caller hasn't chosen yet:
  → Re-read the options naturally:
    "Just to confirm — I have [1] Monday 10am, [2] Monday 2pm.
     Which works for you?"
```

Claude system prompt for this node:
```
You are completing an appointment booking for {business_name}.
You have the customer's details. Now check the calendar and
book them in. Be efficient — offer slots, confirm choice, done.
If the customer expresses a time preference, use it when
calling the check_calendar tool.
```

Add to AgentState:
```python
booking_complete: bool = False
```

---

### 7. Update backend/agents/graph.py

New graph flow:
```
GREETING
  ↓
QUALIFY
  ↓ (conditional routing)
  ├── EMERGENCY → (transfer + END)
  ├── COLLECT_INFO → (loop back until collection_complete)
  │     ↓ (when collection_complete = True)
  ├── BOOKING → (loop until booking_complete or fallback)
  │     ↓
  │   CONFIRM (END)
  └── FAQ → (answer question, loop back to QUALIFY)
```

Update `routing_node(state: AgentState) -> str`:
```python
def routing_node(state: AgentState) -> str:
    if state.get("is_emergency"):
        return "emergency"
    if not state.get("collection_complete"):
        return "collect_info"
    if not state.get("booking_complete"):
        return "booking"
    return END
```

Add `collect_info` and `booking` nodes to the graph.
Add conditional edges from `collect_info` back to itself (loop)
and from `booking` back to itself (loop).

---

### 8. Update backend/db/models.py — add Booking model

```python
class Booking(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: str | None = None
    client_id: str
    call_id: str | None = None
    caller_name: str
    caller_phone: str
    caller_address: str
    problem_description: str
    appointment_start: datetime
    appointment_end: datetime
    google_event_id: str | None = None
    confirmation_sms_sent: bool = False
    status: str = "confirmed"
    created_at: datetime | None = None
    updated_at: datetime | None = None
```

---

### 9. Update backend/routers/vapi_webhook.py

Add missed-call recovery on call-ended webhook:
```python
# On call-ended webhook:
if webhook_type == "status-update" and status == "ended":
    was_booked = await db.get_call_was_booked(call_id)
    call_duration_seconds = ... # from Vapi payload
    
    if not was_booked and call_duration_seconds > 15:
        # Caller hung up without booking — send recovery SMS
        await sms_service.send_missed_call_recovery(
            caller_number=caller_phone,
            business_name=client_config["business_name"],
            client_id=client_id
        )
```

---

## Tests to write

### tests/test_encryption.py
- test_encrypt_decrypt_roundtrip()
- test_different_inputs_produce_different_output()
- test_decrypt_with_wrong_key_raises()
- test_empty_string_encrypt_decrypt()

### tests/test_calendar.py
Mock ALL Google API calls using unittest.mock.patch.

- test_get_available_slots_returns_max_3_slots()
- test_get_available_slots_respects_working_hours()
  (slot at 11pm should NOT appear even if calendar is free)
- test_get_available_slots_skips_busy_periods()
  (if 10am-11am is busy, should not offer 10am)
- test_get_available_slots_returns_empty_list_when_fully_booked()
- test_book_appointment_creates_calendar_event()
- test_book_appointment_returns_event_with_id()
- test_book_appointment_raises_on_google_api_error()
- test_calendar_not_connected_raises_correct_error()
- test_handle_oauth_callback_stores_encrypted_token()
- test_handle_oauth_callback_raises_if_no_refresh_token()

### tests/test_sms.py
Mock Twilio client using unittest.mock.

- test_send_sms_calls_twilio_with_correct_params()
- test_send_sms_returns_success_with_sid()
- test_send_sms_failure_returns_false_not_exception()
  (Twilio down must NOT raise — must return {"success": False})
- test_send_sms_invalid_number_returns_false()
- test_send_booking_confirmation_correct_message_format()
- test_send_missed_call_recovery_correct_message_format()

### tests/test_booking_flow.py
Full integration test — mock all external services.

- test_full_booking_flow_end_to_end()
  Simulate full webhook sequence:
  1. "Hi I need my AC fixed"  → returns qualifying question
  2. "It's not cooling at all" → returns name question
  3. "John Smith" → returns phone question
  4. "555-1234" → returns address question
  5. "123 Main St Brooklyn" → calls check_calendar → returns slot options
  6. "Monday at 10 works" → calls book_appointment → returns confirmation
  Verify: booking in DB, Google Calendar event "created" (mocked), SMS "sent" (mocked)

- test_calendar_down_triggers_callback_offer()
  Simulate check_calendar tool raising CalendarAPIError →
  verify agent returns callback offer, not a crash

- test_missed_call_recovery_sent_on_hangup_without_booking()
  Send call-ended webhook with was_booked=False and duration=30s →
  verify send_missed_call_recovery was called (mocked Twilio)

- test_no_missed_call_recovery_for_short_calls()
  Send call-ended webhook with duration=5s → verify NO SMS sent

### tests/test_collect_info_node.py
- test_asks_name_when_missing()
- test_asks_phone_after_name_collected()
- test_asks_address_after_phone_collected()
- test_sets_collection_complete_when_all_collected()
- test_does_not_ask_already_collected_fields()

---

## How to test Phase 2 locally

### Test the OAuth flow
```bash
# 1. Start server
uvicorn main:app --reload

# 2. Start ngrok to expose localhost
ngrok http 8000

# 3. In .env set GOOGLE_REDIRECT_URI=https://YOUR_NGROK_URL/auth/google/callback

# 4. Visit in browser:
http://localhost:8000/auth/google/connect?client_id=YOUR_TEST_CLIENT_ID

# 5. Complete Google OAuth flow
# 6. Check DB: google_calendar_refresh_token_enc should now be populated
```

### Test the full booking flow via curl
```bash
# Step 1: Initial call
curl -X POST http://localhost:8000/webhook/vapi \
  -H "Content-Type: application/json" \
  -d '{
    "message": {
      "type": "assistant-request",
      "call": {"id": "test_p2_001", "phoneNumber": {"number": "+15550000000"}},
      "conversation": [{"role": "user", "content": "Hi I need my furnace fixed"}]
    }
  }'

# Step 2: Continue conversation (add previous turns to conversation array)
# Keep adding turns until you get a booking confirmation
```

### Test SMS (use Twilio test credentials)
Set TWILIO_ACCOUNT_SID=ACtest... and TWILIO_AUTH_TOKEN=test...
in .env — Twilio test credentials don't send real SMS but validate
the API call format. Verify no exceptions are thrown.

---

## Definition of done for Phase 2
- [ ] All Phase 1 tests still pass (run pytest tests/ -v first)
- [ ] test_encryption.py — all pass
- [ ] test_calendar.py — all pass (fully mocked)
- [ ] test_sms.py — all pass (fully mocked)
- [ ] test_booking_flow.py — all pass
- [ ] test_collect_info_node.py — all pass
- [ ] Google OAuth flow works end-to-end (manual test with real browser)
- [ ] After OAuth: refresh token is stored encrypted in DB
- [ ] Full curl sequence results in a booking saved to DB
- [ ] Missed-call recovery SMS fires on hangup without booking
- [ ] Calendar failure falls back gracefully — no 500 errors

## What Phase 2 does NOT include (do not build yet)
- Appointment reminders (24h before) — Phase 5
- Post-job review requests — Phase 5
- RAG-based knowledge base — Phase 3
- Jobber / Housecall Pro sync — Phase 4
- React dashboard — Phase 6
- Vapi assistant auto-creation — Phase 7
