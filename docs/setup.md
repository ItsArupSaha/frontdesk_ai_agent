# Developer Setup Guide

This guide walks you (Arup) through setting up the AI Front-Desk Agent
from scratch on a new machine, running migrations, and deploying to production.

---

## Prerequisites

- Python 3.11+ (tested on 3.14)
- Node.js 18+
- A Supabase project (free tier works)
- A Vapi.ai account
- A Twilio account
- A Google Cloud project with Calendar API enabled
- An OpenAI API key

---

## 1. Clone and install

```bash
git clone https://github.com/yourusername/ai-frontdesk-agent.git
cd ai-frontdesk-agent

# Backend
pip install uv
uv venv
source .venv/bin/activate  # Windows: .venv\Scripts\activate
uv pip install -r backend/requirements.txt

# Frontend
cd frontend
npm install
cd ..
```

---

## 2. Environment variables

Copy the example and fill in every value:

```bash
cp backend/.env.example backend/.env
```

| Variable | Where to get it |
|---|---|
| `OPENAI_API_KEY` | platform.openai.com → API Keys |
| `VAPI_API_KEY` | dashboard.vapi.ai → Account → API Keys |
| `VAPI_WEBHOOK_SECRET` | Create any random string (32+ chars). Set same value in Vapi assistant webhook settings |
| `VAPI_WEBHOOK_BASE_URL` | Your Railway domain in prod; ngrok URL in local dev |
| `SUPABASE_URL` | Supabase dashboard → Settings → API |
| `SUPABASE_SERVICE_KEY` | Supabase dashboard → Settings → API → service_role key |
| `SUPABASE_ANON_KEY` | Supabase dashboard → Settings → API → anon key |
| `GOOGLE_CLIENT_ID` | Google Cloud Console → APIs & Services → Credentials |
| `GOOGLE_CLIENT_SECRET` | Same place as above |
| `TWILIO_ACCOUNT_SID` | console.twilio.com |
| `TWILIO_AUTH_TOKEN` | console.twilio.com |
| `TWILIO_FROM_NUMBER` | Your Twilio purchased number |
| `APP_SECRET_KEY` | Any random 32-char string |
| `BASE_URL` | `http://localhost:8000` in dev, your Railway URL in prod |

Frontend `.env` (copy from `frontend/.env.example` if it exists):

```bash
VITE_API_URL=http://localhost:8000
VITE_SUPABASE_URL=<same as SUPABASE_URL>
VITE_SUPABASE_ANON_KEY=<same as SUPABASE_ANON_KEY>
```

---

## 3. Run database migrations

Open the Supabase SQL editor (Dashboard → SQL Editor) and run each migration
file in order:

```
backend/db/migrations/001_initial.sql
backend/db/migrations/002_bookings_and_calendar.sql
backend/db/migrations/003_knowledge_base.sql
backend/db/migrations/004_fsm_sync.sql
backend/db/migrations/005_fsm_client_config.sql
backend/db/migrations/006_reminders.sql
backend/db/migrations/007_recording_url.sql
backend/db/migrations/008_rls.sql
backend/db/migrations/009_roles.sql
```

After running 009:

```sql
-- Set yourself as admin (replace with your real Supabase user ID and email)
update clients set role = 'admin', email = 'your@email.com'
where id = 'your-supabase-user-id';
```

---

## 4. Run the backend locally

```bash
cd backend
uvicorn main:app --reload --port 8000
```

The API will be available at `http://localhost:8000`.
Interactive docs: `http://localhost:8000/docs`

For local Vapi webhook testing, use ngrok:

```bash
ngrok http 8000
```

Set `VAPI_WEBHOOK_BASE_URL=https://xxxx.ngrok.io` in your `.env`.

---

## 5. Run the frontend locally

```bash
cd frontend
npm run dev
```

Frontend runs at `http://localhost:5173`.

---

## 6. Run tests

```bash
# All unit + integration tests (exclude load test)
pytest tests/ -v --ignore=tests/load_test.py

# Load test only (10 concurrent webhooks, p95 < 4s)
pytest tests/load_test.py -v -s

# Frontend tests
cd frontend && npm test
```

All 130+ backend tests and 27 frontend tests must pass before any commit.

---

## 7. Deploy to Railway (backend)

1. Push to GitHub.
2. Create a new Railway project → Deploy from GitHub.
3. Set all environment variables from step 2 in Railway dashboard.
4. Set `APP_ENV=production` and `BASE_URL=https://your-app.railway.app`.
5. Railway auto-deploys on every push to `main`.

Verify deployment:

```bash
curl https://your-app.railway.app/health
# → {"status":"ok","env":"production"}
```

---

## 8. Deploy to Vercel (frontend)

1. Push frontend to GitHub.
2. Import the repo in Vercel, set root to `frontend/`.
3. Set environment variables: `VITE_API_URL`, `VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY`.
4. Vercel auto-deploys on every push to `main`.

---

## 9. First client onboarding

1. Log into the dashboard at your Vercel URL with your admin credentials.
2. Navigate to `/admin` (only visible to admin role).
3. Click "Add New Client" → complete the 7-step wizard.
4. The provisioned phone number appears on the success screen.
5. Send the setup email to the client using the "Send setup instructions" button.

---

## Troubleshooting

| Problem | Fix |
|---|---|
| `ModuleNotFoundError: slowapi` | `pip install slowapi==0.1.9` |
| Vapi webhook signature fails | Check `VAPI_WEBHOOK_SECRET` matches what you set in the Vapi assistant |
| Calendar booking fails | Re-connect Google Calendar from Settings → Connect Calendar |
| SMS not sending | Verify Twilio number is active, `TWILIO_FROM_NUMBER` is correct |
| `pgvector` errors | Enable the `vector` extension in Supabase → Database → Extensions |
