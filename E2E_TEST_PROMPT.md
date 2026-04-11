# E2E Real Integration Test

I want you to test this product end-to-end using real API keys — 
exactly like a real customer calling a real plumbing business.
Do NOT mock anything. Every test hits the real external service.

Before starting, verify .env has these keys populated (not empty):
- OPENAI_API_KEY
- VAPI_API_KEY
- TWILIO_ACCOUNT_SID + TWILIO_AUTH_TOKEN + TWILIO_FROM_NUMBER
- SUPABASE_URL + SUPABASE_SERVICE_KEY
- GOOGLE_CLIENT_ID + GOOGLE_CLIENT_SECRET
- APP_SECRET_KEY

If any key is missing, stop and tell me which ones are missing.
Do not proceed with empty keys.

---

## REAL TEST SCENARIOS TO RUN (in this exact order):

### TEST 1 — Server health
- Start the FastAPI server
- Hit GET /health
- Expected: {"status": "ok"}
- If this fails: stop. Server is broken. Fix before continuing.

### TEST 2 — Emergency call simulation
Send this real webhook to the running server (no mock):
```
POST /webhook/vapi
{
  "message": {
    "type": "assistant-request",
    "call": {
      "id": "e2e_test_emergency_001",
      "phoneNumber": {"number": "+15550000000"}
    },
    "conversation": [
      {"role": "user", "content": "Help! I have a burst pipe in my basement, water is everywhere!"}
    ]
  }
}
```
Expected behavior:
- Response contains a transfer action (not a text response)
- Response phoneNumber matches the emergency number in test client DB
- call_logs row created in Supabase with was_emergency = true
- Verify in Supabase dashboard: open call_logs table, find this call_id

PASS criteria: transfer action returned + DB row created
FAIL criteria: text response returned, or DB write failed, or 500 error

---

### TEST 3 — Normal call, full qualification flow
Send a sequence of webhooks simulating a real conversation.
Use the SAME call_id for all turns (e2e_test_normal_001).
Wait for each response before sending the next turn.

Turn 1: "Hi, my kitchen sink is completely blocked"
  → Expected: agent asks for name OR asks about urgency. NOT a booking yet.

Turn 2: "My name is John Smith"
  → Expected: agent asks for phone number

Turn 3: "My number is +8801703889336"
  → Expected: agent asks for address

Turn 4: "I'm at 45 Oak Street, Brooklyn"
  → Expected: agent confirms service area OR asks about availability preference

Turn 5: "Can you come this week?"
  → Expected: agent calls check_calendar tool and returns real available slots
             from the test client's connected Google Calendar

After turn 5:
- Verify real Google Calendar was queried (check logs for calendar API call)
- Verify slots returned are within the client's working hours
- Verify slots are not already booked on the calendar

PASS criteria: real calendar slots returned, all DB state updates correct
FAIL criteria: calendar not queried, fake/hardcoded slots, any 500 error

---

### TEST 4 — Full booking with real calendar event
Continue from TEST 3, Turn 6:

Turn 6: "The first slot works for me"
  → Expected: agent calls book_appointment tool
             → real Google Calendar event created
             → real SMS sent to test number via Twilio
             → booking row created in Supabase

After turn 6, verify ALL of the following:
1. GOOGLE CALENDAR: open Google Calendar for the test account
   → find the new event
   → verify title contains "John Smith"
   → verify description contains "kitchen sink" and "45 Oak Street"
   → verify time matches the slot that was offered

2. SUPABASE: open bookings table
   → find row with caller_name = "John Smith"
   → verify appointment_start matches calendar event
   → verify google_event_id is populated
   → verify confirmation_sms_sent = true

3. TWILIO: check Twilio console logs at console.twilio.com
   → find the outbound SMS
   → verify to_number = +8801703889336 (the number from Turn 3)
   → verify message body contains business name and appointment time

4. CALL LOG: open call_logs in Supabase
   → verify was_booked = true for this call_id

PASS criteria: all 4 checks above are confirmed
FAIL criteria: any one of the 4 is missing or wrong

---

### TEST 5 — Missed call recovery SMS
Send a call-ended webhook for a call that had no booking:
```
POST /webhook/vapi
{
  "message": {
    "type": "status-update",
    "status": "ended",
    "call": {
      "id": "e2e_test_missed_001",
      "phoneNumber": {"number": "+8801703889336"},
      "startedAt": "[current time minus 45 seconds]",
      "endedAt": "[current time]"
    }
  }
}
```
Expected:
- Missed call recovery SMS sent to +8801703889336 via real Twilio
- Check Twilio console to verify the SMS was sent
- Verify message body contains business name

PASS criteria: SMS visible in Twilio console
FAIL criteria: SMS not sent, or wrong number, or server error

---

### TEST 6 — FAQ / business info query (RAG test — Phase 3+)
Skip this test if Phase 3 is not yet complete.

Turn 1 for a new call: "Do you fix tankless water heaters?"
  → Expected: agent answers specifically YES or NO based on 
              the test client's services, not a generic answer
  → Verify the answer matches what's in the test client's 
    services_offered field in DB

PASS criteria: answer is specific to the business, not generic
FAIL criteria: generic "I can help with that" non-answer

---

### TEST 7 — Failure recovery (resilience test)
Test that failures don't crash the product.

Test 7a — Simulate calendar being down:
Temporarily set an invalid google_calendar_id for the test client in DB.
Send a booking conversation webhook.
Expected: agent offers callback, does NOT crash, returns 200 not 500.
Restore the correct calendar_id after test.

Test 7b — Simulate SMS failure:
Temporarily set TWILIO_FROM_NUMBER to an invalid number in .env.
Send a booking that would trigger SMS.
Expected: booking STILL completes (saved to DB + calendar),
only SMS fails — logged as failed, server does not crash.
Restore the correct number after test.

PASS criteria: 200 response with graceful fallback message in both cases
FAIL criteria: 500 error, or booking fails because SMS failed

---

## AFTER ALL TESTS — FINAL REPORT

Generate a report in this format:

```
E2E TEST REPORT — [date]
Phase tested: [X]

TEST 1 — Server health:        PASS / FAIL
TEST 2 — Emergency routing:    PASS / FAIL  
TEST 3 — Full qualification:   PASS / FAIL
TEST 4 — Real booking:         PASS / FAIL
TEST 5 — Missed call SMS:      PASS / FAIL
TEST 6 — RAG FAQ (if Phase 3): PASS / FAIL / SKIPPED
TEST 7a — Calendar failure:    PASS / FAIL
TEST 7b — SMS failure:         PASS / FAIL

OVERALL: READY FOR NEXT PHASE / NEEDS FIXES

Issues found:
- [list any failures with root cause and fix applied]

Manual checks needed:
- [anything that requires human eyes — Twilio console, Google Calendar, etc.]
```

---

## IMPORTANT RULES FOR THIS TEST SESSION

1. NEVER delete real data after tests — leave the test bookings and call logs.
   They prove the system works and you can show them to your first client.

2. Use a real phone number you own for SMS tests (your own mobile number).
   Set it as the test client's emergency number in DB before running.

3. If any test creates a real Google Calendar event — leave it.
   You can manually delete it later. Do not write cleanup code that 
   could accidentally delete real client data later.

4. If TEST 2 (emergency) tries to do a real call transfer — 
   that is fine. Vapi will attempt to call your emergency number.
   Make sure your phone is on.

5. Do not run this test suite in production with real client data.
   Only run against your test client with your own phone numbers.
