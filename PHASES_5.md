# Phase 5 — SMS Automation Flows

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
