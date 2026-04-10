# Phase 1 — Voice Agent Skeleton + Emergency Detection
# Estimated time: 2 weeks
# Status: NOT STARTED

# Important: 
We are using OpenAI (gpt-4o) not Anthropic Claude as the LLM. Use langchain-openai and ChatOpenAI everywhere. The API key is OPENAI_API_KEY in .env.

## Goal
A live FastAPI server that receives Vapi webhooks, runs a LangGraph
conversation, uses Claude to respond, and correctly detects + escalates
emergencies. No booking yet. No SMS yet. Just a working, tested voice
agent that can answer a call, have a conversation, and transfer
emergencies to the owner's phone.

By the end of Phase 1, a real phone call should work end-to-end:
  caller dials → Vapi answers → our server responds intelligently →
  emergency keywords trigger immediate transfer to owner.

---

## Files to create (in this exact order)

### 1. backend/requirements.txt
```
fastapi==0.111.0
uvicorn[standard]==0.29.0
openai==1.30.0
langchain-openai==0.1.7
langgraph==0.1.5
pydantic==2.7.1
pydantic-settings==2.2.1
supabase==2.4.6
python-dotenv==1.0.1
structlog==24.1.0
httpx==0.27.0
pytest==8.2.0
pytest-asyncio==0.23.6
respx==0.21.1
```

### 2. backend/.env.example
All environment variables needed for Phase 1:
```
OPENAI_API_KEY=
VAPI_API_KEY=
VAPI_WEBHOOK_SECRET=
SUPABASE_URL=
SUPABASE_SERVICE_KEY=
SUPABASE_ANON_KEY=
APP_ENV=development
APP_SECRET_KEY=change-this-in-production
BASE_URL=http://localhost:8000
```

### 3. backend/config.py
- Use pydantic-settings BaseSettings class
- Load all env vars with type validation
- Expose a single `settings` singleton imported everywhere
- Include: OPENAI_API_KEY, vapi_api_key, vapi_webhook_secret,
  supabase_url, supabase_service_key, app_env, app_secret_key, base_url
- Fail loudly at startup if required vars are missing

### 4. backend/utils/logging.py
- Configure structlog with JSON output in production, pretty output in dev
- Expose a `get_logger(name)` function
- All logs must include: timestamp, level, module name, any extra context passed in

### 5. backend/utils/emergency.py
Emergency detection is the most critical safety feature.

EMERGENCY_KEYWORDS dict (trade → list of phrases):
```python
EMERGENCY_KEYWORDS = {
    "plumbing": [
        "burst pipe", "flooding", "flood", "no water", "water everywhere",
        "sewage backup", "sewer backup", "gas leak", "gas smell",
        "smell gas", "water heater exploded", "pipe burst",
        "water pouring", "leaking everywhere"
    ],
    "hvac": [
        "no heat", "heat not working", "furnace not working", "no hot water",
        "carbon monoxide", "co alarm", "co detector", "gas smell",
        "no ac", "ac not working", "heat pump failed", "boiler not working",
        "freezing", "pipes might freeze"
    ],
    "electrical": [
        "sparking", "sparks", "burning smell", "smoke", "electrical fire",
        "power out", "no power", "tripped breaker won't reset",
        "outlet sparking", "burning outlet", "shocking", "getting shocked",
        "panel hot", "hot panel", "buzzing loudly"
    ],
    "general": [
        "emergency", "urgent", "asap", "immediately", "right now",
        "dangerous", "safety hazard", "could explode", "might explode"
    ]
}
```

Function: `detect_emergency(text: str) -> tuple[bool, str | None]`
- Lowercase the input text before matching
- Return (True, matched_keyword) if any keyword found
- Return (False, None) if no emergency
- Must handle partial matches within words carefully —
  "sparks" should match "sparks" but test edge cases

Tests: write `tests/test_emergency.py` covering:
- Each trade category
- Mixed case input ("BURST PIPE" must match)
- False positives to avoid ("I fixed the sparks last week")
- Empty string, None input

### 6. backend/db/client.py
- Supabase client singleton using settings
- Expose `get_supabase()` function that returns the client
- Use service key (not anon key) for backend operations

### 7. backend/db/models.py
Pydantic v2 models for all DB rows used in Phase 1:

```python
class ClientConfig(BaseModel):
    id: str
    business_name: str
    emergency_phone_number: str
    working_hours: dict  # {"mon": "8am-6pm", ...}
    services_offered: list[str]
    service_area_description: str
    is_active: bool

class CallLog(BaseModel):
    id: str | None = None
    client_id: str
    call_id: str  # Vapi call ID
    caller_number: str
    started_at: datetime
    ended_at: datetime | None = None
    was_emergency: bool = False
    was_booked: bool = False
    summary: str | None = None
    transcript: list[dict] = []
    status: str = "in_progress"  # in_progress | completed | failed

class ConversationState(BaseModel):
    client_id: str
    call_id: str
    current_node: str = "GREETING"
    caller_name: str | None = None
    caller_phone: str | None = None
    problem_description: str | None = None
    is_emergency: bool = False
    messages: list[dict] = []
```

### 8. backend/db/migrations/001_initial.sql
SQL to create all tables needed for Phase 1:
```sql
-- clients table
create table if not exists clients (
  id uuid primary key default gen_random_uuid(),
  business_name text not null,
  emergency_phone_number text not null,
  working_hours jsonb not null default '{}',
  services_offered text[] not null default '{}',
  service_area_description text not null default '',
  vapi_assistant_id text,
  twilio_phone_number text,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- call_logs table
create table if not exists call_logs (
  id uuid primary key default gen_random_uuid(),
  client_id uuid not null references clients(id),
  call_id text not null unique,
  caller_number text,
  started_at timestamptz not null default now(),
  ended_at timestamptz,
  was_emergency boolean not null default false,
  was_booked boolean not null default false,
  summary text,
  transcript jsonb not null default '[]',
  status text not null default 'in_progress',
  created_at timestamptz not null default now()
);

-- conversation_state table (ephemeral, cleaned up after call ends)
create table if not exists conversation_state (
  call_id text primary key,
  client_id uuid not null references clients(id),
  current_node text not null default 'GREETING',
  caller_name text,
  caller_phone text,
  problem_description text,
  is_emergency boolean not null default false,
  messages jsonb not null default '[]',
  updated_at timestamptz not null default now()
);

-- seed one test client for local development
insert into clients (
  business_name,
  emergency_phone_number,
  working_hours,
  services_offered,
  service_area_description
) values (
  'Test Plumbing Co',
  '+15550000000',
  '{"mon":"8am-6pm","tue":"8am-6pm","wed":"8am-6pm","thu":"8am-6pm","fri":"8am-6pm","sat":"9am-2pm","sun":"closed"}',
  array['plumbing','drain cleaning','water heater repair','emergency plumbing'],
  'Serving Brooklyn, Queens, and Manhattan, New York'
) on conflict do nothing;
```

### 9. backend/agents/state.py
LangGraph state definition:
```python
from typing import TypedDict, Annotated
from langgraph.graph.message import add_messages

class AgentState(TypedDict):
    messages: Annotated[list, add_messages]
    client_id: str
    call_id: str
    current_node: str
    caller_name: str | None
    caller_phone: str | None
    problem_description: str | None
    is_emergency: bool
    service_area_confirmed: bool
    client_config: dict
```

### 10. backend/agents/tools.py
Define all LLM-callable tools for Phase 1 only:

Tool 1: `escalate_call`
- Input: reason (str), caller_summary (str)
- Action: returns a special dict that the webhook handler recognizes
  as a transfer instruction
- Must include the emergency phone number from client_config
- Return format:
  ```python
  {"action": "transfer", "phone": emergency_number, "summary": caller_summary}
  ```

Tool 2: `get_business_info`
- Input: question (str)
- Action: for Phase 1, return from client_config directly
  (RAG/pgvector comes in Phase 3 — for now just format the config as text)
- Return a helpful string: services list, hours, service area

Tool 3: `end_call_gracefully`
- Input: reason (str)
- Action: return a polite goodbye message appropriate to the reason
  ("out_of_area", "not_a_service_we_offer", "call_resolved")

Bind all tools to Claude using `ChatAnthropic.bind_tools()`

### 11. backend/agents/nodes.py
LangGraph node functions. Each node is an async function:

`greeting_node(state: AgentState) -> AgentState`
- System prompt: professional, friendly, trades-specific
- Example: "You are Alex, the AI assistant for {business_name}.
  You answer calls professionally, qualify the caller's needs,
  and help them book appointments or get urgent help.
  Always be warm but efficient — these are busy tradespeople's customers."
- Invoke Claude with tools available
- Return updated state

`qualify_node(state: AgentState) -> AgentState`
- Run emergency detection on the latest user message FIRST
  using detect_emergency() from utils/emergency.py
- If emergency detected: set state.is_emergency = True, go to emergency node
- Otherwise: ask qualifying questions:
  1. What is the problem?
  2. What is the address / are you in our service area?
  3. How urgent is this?
- Do not ask all 3 at once — one question per turn

`emergency_node(state: AgentState) -> AgentState`
- This runs when is_emergency = True
- Claude MUST call the escalate_call tool here — no other option
- System prompt: "This is an emergency. Your ONLY job is to:
  1. Confirm you understand the emergency
  2. Tell the caller you are connecting them to a technician NOW
  3. Call the escalate_call tool immediately
  Do not ask more questions. Do not try to solve the problem.
  Act fast."
- If tool call returns transfer action, return that in state

`routing_node(state: AgentState) -> str`
- This is the LangGraph conditional edge function
- Reads state and returns the name of the next node:
  - "emergency" if is_emergency
  - "booking" if problem described and area confirmed (Phase 2 adds this)
  - "qualify" if still missing info
  - "faq" if caller just has questions

### 12. backend/agents/graph.py
Build the LangGraph StateGraph:
```
GREETING → QUALIFY → (conditional) → EMERGENCY
                                    → FAQ (for now, just handles questions)
                                    → END (if resolved)
```

- Use `StateGraph(AgentState)`
- Add all nodes
- Set entry point to "greeting"
- Add conditional edge from "qualify" using routing_node
- Compile the graph
- Expose `compiled_graph` as module-level variable

### 13. backend/routers/vapi_webhook.py
The most important file in Phase 1.

POST `/webhook/vapi`
- Validate Vapi webhook signature (HMAC-SHA256 using VAPI_WEBHOOK_SECRET)
  — if validation fails, return 403
- Parse the incoming webhook body into a typed Pydantic model
- Look up which client owns this phone number from DB
  (for local testing, use a hardcoded test client_id)
- Load client_config from DB
- Load or create conversation_state from DB using call_id
- Run the LangGraph compiled_graph with current state
- Parse the graph output:
  - If output contains transfer action → return Vapi transfer response
  - Otherwise → return Vapi text response
- Save updated conversation_state to DB
- If call-ended webhook type → finalize call_log, generate summary
- Must respond in under 3 seconds total (Vapi timeout is 5s)
- If anything fails → return a safe fallback response to Vapi:
  ```json
  {"response": {"message": "I'm having a technical issue. Let me connect you with someone directly."}}
  ```
  AND trigger escalation to emergency number

Vapi webhook types to handle:
- `assistant-request` → main conversation turn
- `status-update` with status `ended` → finalize call log

### 14. backend/main.py
```python
from fastapi import FastAPI
from contextlib import asynccontextmanager
from routers import vapi_webhook
from utils.logging import get_logger
from config import settings

logger = get_logger(__name__)

@asynccontextmanager
async def lifespan(app: FastAPI):
    logger.info("Starting AI Front-Desk Agent", env=settings.app_env)
    yield
    logger.info("Shutting down")

app = FastAPI(
    title="AI Front-Desk Agent",
    version="0.1.0",
    lifespan=lifespan
)

app.include_router(vapi_webhook.router, prefix="/webhook")

@app.get("/health")
async def health():
    return {"status": "ok", "env": settings.app_env}
```

---

## Tests to write (all in tests/)

### tests/test_emergency.py
- test_burst_pipe_detected()
- test_gas_leak_detected()
- test_no_heat_detected()
- test_sparking_detected()
- test_uppercase_input()
- test_no_emergency_normal_call()
- test_empty_string()

### tests/test_webhook.py
- test_valid_webhook_returns_200()
- test_invalid_signature_returns_403()
- test_emergency_keyword_triggers_transfer()
- test_normal_call_returns_text_response()
- test_vapi_timeout_fallback() — simulate slow graph, ensure fallback fires

### tests/test_agent.py
- test_greeting_node_returns_response()
- test_qualify_node_detects_emergency()
- test_qualify_node_asks_questions()
- test_emergency_node_calls_escalate_tool()
- test_routing_to_emergency()
- test_routing_to_qualify()

---

## How to test Phase 1 locally without a real Vapi account

1. Start server: `uvicorn main:app --reload`
2. Send a test webhook manually:
```bash
curl -X POST http://localhost:8000/webhook/vapi \
  -H "Content-Type: application/json" \
  -d '{
    "message": {
      "type": "assistant-request",
      "call": {
        "id": "test_call_001",
        "phoneNumber": {"number": "+15550000000"}
      },
      "conversation": [
        {"role": "user", "content": "Hi I have a burst pipe in my basement"}
      ]
    }
  }'
```
Expected response: JSON with transfer action to emergency number

3. Test normal call:
```bash
curl -X POST http://localhost:8000/webhook/vapi \
  -H "Content-Type: application/json" \
  -d '{
    "message": {
      "type": "assistant-request",
      "call": {
        "id": "test_call_002",
        "phoneNumber": {"number": "+15550000000"}
      },
      "conversation": [
        {"role": "user", "content": "Hi I need my bathroom sink fixed"}
      ]
    }
  }'
```
Expected response: JSON with text response asking qualifying questions

---

## Definition of done for Phase 1
- [ ] All files created and linted (no errors)
- [ ] All tests pass: `pytest tests/ -v`
- [ ] Health endpoint responds: GET /health → 200 ok
- [ ] Emergency curl test returns transfer action
- [ ] Normal call curl test returns qualifying question
- [ ] Invalid webhook signature returns 403
- [ ] Server handles a crash in graph gracefully (returns fallback, does not 500)

## What Phase 1 does NOT include (do not build yet)
- Google Calendar — Phase 2
- SMS sending — Phase 2
- RAG / pgvector — Phase 3
- Jobber / Housecall Pro — Phase 4
- React dashboard — Phase 6
- Real Vapi assistant creation — do that manually after Phase 1 tests pass
