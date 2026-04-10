# Phase 1 — Audit + Real Integration Test

Read CLAUDE.md and PHASE_1.md fully before touching anything.

I built Phase 1 using Gemini. The server is working — I already talked to the voice agent live via Vapi + ngrok. Now I need you to:

1. Audit the codebase against the spec
2. Fix anything wrong
3. Run unit tests
4. Run real E2E tests with real API keys

Work through these 4 stages in order. Do not skip ahead.
Do not ask me questions between stages unless something is
genuinely not covered in CLAUDE.md or PHASE_1.md.

---

## STAGE 1 — Codebase audit

Read every file in the backend/ folder.
Compare each file against what PHASE_1.md specifies.

Check for:

1. Missing files — does every file listed in PHASE_1.md exist?
2. Missing functions — does every function described exist and 
   have the correct signature?
3. Security gaps:
   - Is Vapi webhook signature being validated (HMAC-SHA256)?
     If not, add it. This is non-negotiable.
   - Are there any bare `except:` clauses? Replace with specific exceptions.
   - Are any API keys hardcoded anywhere? They must come from settings only.
4. Emergency detection — does utils/emergency.py use the full keyword
   list from PHASE_1.md? Compare the actual keywords against the spec.
5. Fallback safety — if the LangGraph graph crashes, does the webhook
   handler return a safe fallback response to Vapi instead of a 500?
   If not, add a try/except around the graph invocation.
6. LangGraph state — does AgentState in agents/state.py have all the
   fields listed in PHASE_1.md?
7. DB models — does db/models.py have ClientConfig, CallLog, 
   and ConversationState as specified?
8. OpenAI — we are using OpenAI gpt-4o, NOT Anthropic Claude.
   Verify all LLM calls use ChatOpenAI from langchain-openai.
   If any Anthropic imports exist, replace them with OpenAI equivalents.

After the audit, give me a clear list:
- What matches the spec exactly
- What was missing or wrong and what you fixed
- Any files you had to create from scratch

Do not proceed to Stage 2 until all audit issues are fixed.

---

## STAGE 2 — Unit tests

Run: pytest tests/ -v

If tests folder is empty or missing tests, write them now based 
on the test list in PHASE_1.md:
- tests/test_emergency.py
- tests/test_webhook.py  
- tests/test_agent.py

Rules:
- Mock all external services (OpenAI, Vapi, Supabase)
- Do not hit real APIs in unit tests
- Fix every failing test before moving to Stage 3
- Do not comment out failing tests — fix them

When all tests pass, show me the full pytest output.

---

## STAGE 3 — Real integration tests

Now test with real API keys. Verify .env has these populated:
- OPENAI_API_KEY
- VAPI_API_KEY
- VAPI_WEBHOOK_SECRET
- SUPABASE_URL
- SUPABASE_SERVICE_KEY
- APP_SECRET_KEY

If any are empty, stop and tell me which ones are missing.

Make sure the FastAPI server is running and ngrok is active.

Run these real tests one by one:

### Real test 1 — Health check
Hit GET /health
Expected: {"status": "ok"}
If this fails, fix the server before continuing.

### Real test 2 — Emergency detection (real webhook, real OpenAI, real Supabase)
Send this to your running server:
```
curl -X POST http://localhost:8000/webhook/vapi \
  -H "Content-Type: application/json" \
  -d '{
    "message": {
      "type": "assistant-request",
      "call": {
        "id": "audit_test_emergency_001",
        "phoneNumber": {"number": "+15550000000"}
      },
      "conversation": [
        {"role": "user", "content": "Help! I have a burst pipe, water is flooding my basement!"}
      ]
    }
  }'
```
Expected: response contains transfer action, NOT a text response.
Also verify in Supabase: call_logs row created with was_emergency = true.

### Real test 3 — Normal call (real OpenAI call)
```
curl -X POST http://localhost:8000/webhook/vapi \
  -H "Content-Type: application/json" \
  -d '{
    "message": {
      "type": "assistant-request",
      "call": {
        "id": "audit_test_normal_001",
        "phoneNumber": {"number": "+15550000000"}
      },
      "conversation": [
        {"role": "user", "content": "Hi, my bathroom sink is draining really slowly"}
      ]
    }
  }'
```
Expected: text response asking a qualifying question (name, problem, 
urgency, or area). NOT a transfer. NOT a booking attempt yet.
Verify OpenAI was actually called (check logs for the LLM call).

### Real test 4 — Invalid webhook signature
```
curl -X POST http://localhost:8000/webhook/vapi \
  -H "Content-Type: application/json" \
  -H "x-vapi-signature: invalidsignature" \
  -d '{"message": {"type": "assistant-request"}}'
```
Expected: 403 response.
If you get 200, webhook validation is not working — fix it.

### Real test 5 — Crash resilience
Send a malformed webhook that would cause the graph to fail:
```
curl -X POST http://localhost:8000/webhook/vapi \
  -H "Content-Type: application/json" \
  -d '{
    "message": {
      "type": "assistant-request",
      "call": {"id": "audit_test_crash_001", "phoneNumber": {"number": "+15550000000"}},
      "conversation": null
    }
  }'
```
Expected: 200 response with a safe fallback message like 
"I'm having a technical issue, let me connect you with someone."
NOT a 500 error. NOT an unhandled exception in logs.

---

## STAGE 4 — Final report

After all stages complete, give me this report:

```
PHASE 1 AUDIT + TEST REPORT
============================

After Stage 1 (audit + fixes) completes, just say "Stage 1 done" in the chat before moving to Stage 2. Do the same for all the stages. 

CODEBASE AUDIT
--------------
Files matching spec:       [list]
Issues found and fixed:    [list each issue + what you changed]
Files created from scratch:[list if any]

UNIT TESTS
----------
Total tests:    X
Passed:         X  
Failed:         0
Test output:    [paste full pytest -v output]

REAL INTEGRATION TESTS
----------------------
Health check:              PASS / FAIL
Emergency detection:       PASS / FAIL
Normal call (OpenAI live): PASS / FAIL
Signature validation:      PASS / FAIL
Crash resilience:          PASS / FAIL

OVERALL STATUS
--------------
Phase 1: SOLID — ready to build Phase 2
   OR
Phase 1: NEEDS WORK — [list remaining issues]

MANUAL CHECKS FOR YOU (Arup)
-----------------------------
[anything that needs human eyes — Supabase dashboard, 
 Vapi console, ngrok logs, etc.]
```
