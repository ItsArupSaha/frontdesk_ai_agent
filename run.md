Open up a terminal in your project folder (ai-frontdesk-agent).
Activate your virtual environment: .\.venv\Scripts\activate

ngrok http --domain=particia-tribadic-genevie.ngrok-free.dev 8000

uvicorn backend.main:app --reload
