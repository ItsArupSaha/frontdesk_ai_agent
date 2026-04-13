"""
Shared slowapi rate limiter instance.

Import this from any router file to apply rate limits.
The limiter is also attached to app.state in main.py so slowapi
can intercept exceeded limits and return 429 responses automatically.

Usage in a router:
    from backend.utils.limiter import limiter
    from fastapi import Request

    @router.post("/webhook/vapi")
    @limiter.limit("60/minute")
    async def vapi_webhook(request: Request) -> dict:
        ...
"""
from slowapi import Limiter
from slowapi.util import get_remote_address

limiter = Limiter(key_func=get_remote_address)
