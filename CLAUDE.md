# AI Front-Desk & Booking Agent — Master Context

## What we are building
A production-grade AI front-desk and booking agent for small-to-mid size
plumbing, HVAC, and electrical businesses in the US. The agent answers
inbound phone calls 24/7, qualifies leads, detects emergencies, books
appointments, sends SMS confirmations, and syncs bookings to the client's
field service management software (Jobber or Housecall Pro).

This is a multi-tenant SaaS product. One deployment serves multiple
client businesses. Each client gets their own phone number, calendar
connection, and isolated data.

## Business context
- Builder: Arup (solo developer, software engineering background)
- Target customers: plumbing / HVAC / electrical businesses, 1–20 employees
- Pricing: ~$150/month per client
- Goal: 5 clients = $500/month net profit (after infra costs ~$42/client)
- Non-negotiable: zero compromise on reliability. This product handles
  real emergencies (burst pipes, gas leaks, no heat in winter).

---

## Architecture overview

### Layer 1 — Voice (Vapi.ai)
- Vapi handles telephony: phone number, inbound call routing, STT (Deepgram), TTS (ElevenLabs)
- We receive text webhooks from Vapi, return text responses
- We write ZERO audio or telephony code
- One Vapi assistant per client, configured via Vapi API

### Layer 2 — Brain (FastAPI + LangGraph + Claude)
- FastAPI: async Python web server, receives Vapi webhooks
- LangGraph: conversation state machine
- gpt-4o-mini: LLM for reasoning and tool-calling
- States: GREETING → QUALIFY → (EMERGENCY | BOOK | OUT_OF_AREA | FAQ) → CONFIRM

### Layer 3 — Integrations (direct API, NO Zapier or middleware)
- Google Calendar API (OAuth2) — check availability, create appointments
- Twilio SMS — confirmations, reminders, review requests, missed-call recovery
- Jobber GraphQL API — create clients and jobs (optional per client)
- Housecall Pro REST API — create customers and jobs (optional per client)

### Layer 4 — Data (Supabase / PostgreSQL + pgvector)
- Multi-tenant: one schema per client
- Tables: clients, conversations, call_logs, bookings, reminders_queue, business_config
- pgvector for knowledge base embeddings (RAG for business-specific FAQ)
- Supabase auth for dashboard login
- Supabase realtime for live dashboard updates

### Layer 5 — Dashboard (React + Vite + TypeScript + Tailwind + Recharts)
- Client admin panel: call logs, bookings, analytics, settings
- Arup's multi-client management panel
- Deployed to Vercel

### Layer 6 — Infrastructure
- Backend: Railway ($5/month)
- Frontend: Vercel (free)
- Database: Supabase (free tier)
- Voice: Vapi.ai (pay per minute ~$0.05/min)
- SMS: Twilio (pay per message ~$0.0075)

---

## Tech stack

| Layer | Technology | Why |
|---|---|---|
| Backend language | Python 3.11+ | LangGraph is Python-native |
| Web framework | FastAPI | Async, fast, auto-docs |
| Agent framework | LangGraph | State machine for conversation flow |
| LLM | OpenAI gpt-4o-mini | Best tool-calling |
| Voice | Vapi.ai | Handles all telephony |
| SMS | Twilio Python SDK | Industry standard, direct API |
| Database | PostgreSQL via Supabase | Managed, free tier, realtime |
| Vector store | pgvector (Supabase extension) | No extra DB for RAG |
| Frontend | React + Vite + TypeScript + Tailwind + Recharts | Production-grade |
| Deployment (backend) | Railway | Simple, affordable |
| Deployment (frontend) | Vercel | Free, instant GitHub deploys |
| Package manager | uv (Python) | Fastest Python package manager |
| Env management | python-dotenv | Standard |

---

## Project structure

```
ai-frontdesk-agent/
├── CLAUDE.md                    # This file — always read first
├── backend/
│   ├── main.py                  # FastAPI app entry point
│   ├── config.py                # All settings and env vars
│   ├── requirements.txt
│   ├── .env.example
│   ├── agents/
│   │   ├── __init__.py
│   │   ├── graph.py             # LangGraph state machine definition
│   │   ├── state.py             # Conversation state types
│   │   ├── nodes.py             # LangGraph node functions
│   │   └── tools.py             # All LLM-callable tools
│   ├── routers/
│   │   ├── __init__.py
│   │   ├── vapi_webhook.py      # POST /webhook/vapi
│   │   ├── dashboard_api.py     # Dashboard data endpoints
│   │   └── onboarding.py        # Client onboarding endpoints
│   ├── services/
│   │   ├── __init__.py
│   │   ├── calendar_service.py  # Google Calendar integration
│   │   ├── sms_service.py       # Twilio SMS
│   │   ├── jobber_service.py    # Jobber GraphQL
│   │   ├── housecall_service.py # Housecall Pro REST
│   │   ├── rag_service.py       # pgvector knowledge base
│   │   └── vapi_service.py      # Vapi assistant management
│   ├── db/
│   │   ├── __init__.py
│   │   ├── client.py            # Supabase client singleton
│   │   ├── models.py            # Pydantic models for DB rows
│   │   └── migrations/          # SQL migration files
│   └── utils/
│       ├── __init__.py
│       ├── emergency.py         # Emergency keyword detection
│       └── logging.py           # Structured logging
├── frontend/
│   ├── src/
│   │   ├── main.tsx
│   │   ├── App.tsx
│   │   ├── pages/
│   │   │   ├── Dashboard.tsx
│   │   │   ├── CallLogs.tsx
│   │   │   ├── Bookings.tsx
│   │   │   ├── Analytics.tsx
│   │   │   └── Settings.tsx
│   │   ├── components/
│   │   └── lib/
│   │       ├── supabase.ts
│   │       └── api.ts
│   ├── package.json
│   └── vite.config.ts
├── tests/
│   ├── test_webhook.py
│   ├── test_agent.py
│   ├── test_calendar.py
│   └── test_sms.py
└── docs/
    ├── setup.md
    └── client-onboarding.md
```

---

## LangGraph conversation states

```
GREETING
  └─► QUALIFY
        ├─► EMERGENCY     (burst pipe / gas leak / sparking / no heat)
        │     └─► ESCALATE_CALL (transfer live call to emergency number)
        ├─► OUT_OF_AREA   (caller not in service zone)
        │     └─► POLITE_END
        ├─► FAQ            (caller has questions, not booking)
        │     └─► (back to QUALIFY or CONFIRM)
        └─► BOOK
              ├─► CHECK_CALENDAR
              ├─► CONFIRM_BOOKING
              └─► SEND_SMS_CONFIRMATION
```

---

## LLM tools (OpenAI can call these)

| Tool name | What it does |
|---|---|
| check_calendar | Query Google Calendar for available time slots |
| book_appointment | Create calendar event + DB booking record |
| send_sms | Send SMS via Twilio |
| escalate_call | Trigger Vapi to transfer call to emergency number |
| get_business_info | RAG query for business-specific answers |
| create_fsm_record | Create job in Jobber or Housecall Pro |
| check_service_area | Verify caller's address is in coverage zone |

---

## Vapi webhook contract

### Incoming (Vapi → our server)
```json
{
  "message": {
    "type": "assistant-request",
    "call": {
      "id": "call_xyz",
      "phoneNumber": { "number": "+1xxxxxxxxxx" }
    },
    "conversation": [
      { "role": "user", "content": "Hi I have a burst pipe" }
    ]
  }
}
```

### Outgoing (our server → Vapi)
```json
{
  "response": {
    "message": "Oh no, that sounds urgent! Are you safe right now? I'm going to connect you with our emergency line immediately."
  }
}
```

### For call transfer (escalation)
```json
{
  "response": {
    "action": "transfer-call",
    "phoneNumber": "+1xxxxxxxxxx",
    "message": "Connecting you to our emergency technician now."
  }
}
```

---

## Environment variables

### Backend .env (Arup owns all of these)
```
# Anthropic
OPENAI_API_KEY=

# Vapi
VAPI_API_KEY=
VAPI_PHONE_NUMBER_ID=

# Twilio
TWILIO_ACCOUNT_SID=
TWILIO_AUTH_TOKEN=
TWILIO_FROM_NUMBER=

# Supabase
SUPABASE_URL=
SUPABASE_SERVICE_KEY=
SUPABASE_ANON_KEY=

# Google OAuth
GOOGLE_CLIENT_ID=
GOOGLE_CLIENT_SECRET=

# App
APP_ENV=development
APP_SECRET_KEY=
BASE_URL=http://localhost:8000
```

### Per-client config (stored encrypted in DB, NOT in .env)
```
google_calendar_refresh_token
jobber_api_key (optional)
housecall_pro_api_key (optional)
emergency_phone_number
service_area_zip_codes
business_name
services_offered
working_hours
pricing_ranges
```

---

## Coding standards

### General
- Python 3.11+ with full type hints on every function
- Pydantic v2 for all data models
- async/await everywhere in FastAPI and services
- Never use bare except — always catch specific exceptions
- Every function has a docstring
- Log all errors with full context using structlog

### Error handling philosophy
This product handles real emergencies. A bug that causes an escalation
to fail could mean someone's house floods. Treat every integration point
as potentially failing and handle it gracefully:
- If calendar booking fails → still confirm the call, log error, notify Arup
- If SMS fails → log error, do not crash the webhook response
- If FSM sync fails → background retry 3 times, then notify Arup
- If LLM call fails → fall back to "Let me connect you with someone" + escalate

### Testing
- Every tool function has a unit test with mocked external calls
- Every LangGraph state transition has a test
- Every webhook endpoint has an integration test
- Run tests before every commit: `pytest tests/ -v`

### Security
- All client API keys stored encrypted in Supabase (use Fernet encryption)
- Never log API keys or tokens
- Webhook endpoints validate Vapi signature header
- Rate limit all public endpoints

---

## Known constraints and decisions

- NO Zapier or any workflow middleware — all integrations are direct API calls in Python
- NO raw Twilio for voice — Vapi handles all telephony
- NO external vector database — pgvector in Supabase is sufficient
- Multi-tenant isolation: every DB query MUST filter by client_id
- Vapi webhook must respond in under 5 seconds or Vapi times out
- Emergency detection must happen BEFORE any other LangGraph node

---

## Current status
Phase 1 — Completed
Phase 2 — Completed
Phase 3 — Completed
Phase 4 — Completed
Next action: Phase 5 implementation.
