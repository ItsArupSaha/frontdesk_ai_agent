# Vapi.ai & Ngrok Setup Guide (2026 Edition)

Setting up an AI voice assistant that talks to your own LangGraph backend consists of three main steps: 
1. **Running your local server on the internet via ngrok.**
2. **Creating an Assistant in Vapi.**
3. **Connecting Vapi to your server securely.**

---

## 1. Setting up Ngrok (Getting your Server URL)

Since your backend runs locally on port `8000`, Vapi cannot reach it over the internet. Ngrok creates a secure, public tunnel to your local machine.

### Installation & Authentication
1. Go to [ngrok.com](https://ngrok.com/) and sign up for a free account.
2. Download the ngrok executable for Windows.
3. Once downloaded, open your terminal (PowerShell) and set your authentication token (found on the ngrok dashboard under "Getting Started > Your Authtoken"):
   ```bash
   ngrok config add-authtoken YOUR_AUTH_TOKEN_HERE
   ```

### Securing your Static Free Domain
Ngrok gives free users a **Persistent Dev Domain** so your URL never changes when you turn off your PC!
1. Start your tunnel running to your FastAPI port (8000) using your domain:
   ```bash
   ngrok http --domain=particia-tribadic-genevie.ngrok-free.dev 8000
   ```
2. Keep this terminal window open! 
3. Your base Server URL is now: `https://particia-tribadic-genevie.ngrok-free.dev`

---

## 2. Setting up the Vapi Dashboard (Detailed Configuration)

Now we need to configure Vapi so it acts seamlessly as the "Mouth" and "Ears", but relies entirely on our FastAPI server as the "Brain".

1. Log in to your [Vapi Dashboard](https://dashboard.vapi.ai/).
2. Navigate to **Assistants** in the left sidebar and click **Create Assistant**.
3. Choose **Blank Template**.

### A. The "Brain" (Model & Prompt Settings)
Since we are using LangGraph to manage the conversation state, Vapi's built-in AI settings need to be overridden.

- **Provider & Model:** Set the Provider to **Custom LLM**. This disables Vapi's default OpenAI/Anthropic brains and prepares it to use your server.
- **Server URL:** In the Custom LLM URL box (or under the Advanced -> Server URL tab), paste your ngrok webhook endpoint:  
  `https://particia-tribadic-genevie.ngrok-free.dev/webhook/vapi`
- **System Prompt:** **Leave this completely empty.** 
  *Why?* We manage the System Prompts entirely in our Python code (`backend/agents/nodes.py`). Depending on whether the user is in the `Greeting`, `Qualifying`, or `Emergency` state, our LangGraph backend dynamically changes the prompt. Putting a prompt in Vapi will cause conflicts.
- **First Message:** Leave this blank. Our LangGraph backend detects an empty conversation array and automatically injects a greeting (e.g., "Hello, you've reached Test Plumbing Co. How can I help you today?") based on the `greeting_node`.

### B. The "Ears" (Transcriber / STT Settings)
Speech-to-Text (STT) is crucial because plumbing/electrical issues can involve complex terminology.

- **Provider:** Select **Deepgram**. It is currently the industry leader for latency and accuracy.
- **Model:** Select `nova-2-phonecall` (or just `nova-2`). The `phonecall` variant is specifically fine-tuned for the audio quality of 8kHz telephone network calls, making it vastly superior for recognizing addresses and emergency situations over a cell phone connection.
- **Language:** `en-US` (English - US).
- **Endpointing:** Set this around `0.4s - 0.6s` (400-600ms). This dictates how quickly the AI assumes the user is done talking. We want it fast so the AI feels responsive.

### C. The "Mouth" (Voice / TTS Settings)
Text-to-Speech (TTS) determines how human your agent sounds.

- **Provider:** Select **ElevenLabs**. They offer the most expressive, lifelike voices.
- **Voice ID / Voice:** Pick a calm, highly professional voice like "George", "Callum", or "Rachel".
- **Model:** Select `eleven_turbo_v2.5` (or `eleven_turbo_v2`). 
  *Why?* You **must** select the "Turbo" model rather than the "Multilingual" model. Turbo models are optimized for ultra-low latency (<300ms generation). If you select standard Multilingual, the total response delay will make callers think they have been disconnected.

---

## 3. Webhook Secrets & Security (Authorization Headers)

To ensure your backend rejects traffic from random people on the internet, we use the recommended "Option B" from Vapi: explicitly assigning an `Authorization: Bearer` header on the Server URL.

1. **Create your Secret Locally**
   Open your `backend/.env` file and set the `VAPI_WEBHOOK_SECRET` to a random, secure string (for example, `my_super_secure_hmac_secret_123`). Our FastAPI server (`vapi_webhook.py`) is already configured to read this and verify incoming traffic matching it exactly.

2. **Configure the Header in Vapi Dashboard**
   Because we are primarily serving an **Assistant serverUrl event** (`assistant-request`), you will set this header natively on your assistant:
   - Navigate back to your Assistant.
   - Look under the configuration where you set your Server URL (e.g., under the **Advanced** -> **Server Configuration** tab).
   - Locate the section for **Server URL Headers** (it might also just say "Headers" beneath the endpoint config).
   - Add a new Header. 
   - **Key:** `Authorization`
   - **Value:** `Bearer your_secret_from_env_file` *(Make sure to replace `your_secret_from_env_file` with the exact secret string you put in your `.env`, keeping the word "Bearer " in front)*!

3. **Important:** Also ensure your `VAPI_API_KEY` (from the Vapi API Keys tab) is pasted into your `.env`.

---

## 4. Verify Everything Is Working
1. Ensure your backend is running: Open your terminal in the root `ai-frontdesk-agent` folder and run `uvicorn backend.main:app --reload`
2. Ensure ngrok is running in a second terminal: `ngrok http --domain=particia-tribadic-genevie.ngrok-free.dev 8000`
3. Go back to Vapi and click the **"Talk"** button on the bottom of the Assistant UI. 
4. Say "Hello". You should immediately see a log pop up in your python terminal where your FastAPI server receives the webhook, passing it to `gpt-4o-mini`, and responding back to Vapi!
