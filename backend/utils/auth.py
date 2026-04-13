"""
Authentication and authorization utilities.

Provides FastAPI dependencies for:
- JWT verification via Supabase (get_current_user)
- Admin-only route protection (require_admin)

Admin identity is stored in the `admins` table (keyed to Supabase auth user ID).
Admins are NOT in the `clients` table — the clients table is for paying client
businesses only.

Dev bypass: pass Authorization: Bearer dev-bypass when APP_ENV != 'production'
to skip real JWT verification. In dev-bypass mode the user is treated as admin
so all admin tests can run without a real Supabase instance.
"""
from __future__ import annotations

from typing import Any

from fastapi import Depends, HTTPException
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer

from backend.db.client import get_supabase
from backend.utils.logging import get_logger

logger = get_logger(__name__)

_bearer = HTTPBearer(auto_error=False)


async def get_current_user(
    credentials: HTTPAuthorizationCredentials | None = Depends(_bearer),
) -> dict[str, Any]:
    """Verify Supabase JWT and return the decoded user payload.

    Returns a dict with at minimum: ``sub`` (user UUID), ``email``.
    In development, the special token ``dev-bypass`` is accepted and returns
    a synthetic admin user so integration tests run without Supabase.

    Raises:
        HTTPException 401: if token is missing or invalid.
    """
    from backend.config import settings

    if credentials is None:
        raise HTTPException(status_code=401, detail="Missing Authorization header")

    token = credentials.credentials

    # Dev bypass — only outside production.
    if settings.app_env != "production" and token == "dev-bypass":
        return {"sub": "dev-user", "email": "dev@localhost", "role": "authenticated"}

    try:
        sb = get_supabase()
        resp = sb.auth.get_user(token)
        if resp is None or resp.user is None:
            raise HTTPException(status_code=401, detail="Invalid or expired token")
        return {
            "sub": resp.user.id,
            "email": resp.user.email,
            "role": "authenticated",
        }
    except HTTPException:
        raise
    except Exception as exc:
        logger.warning("JWT verification failed", error=str(exc))
        raise HTTPException(status_code=401, detail="Token verification failed")


async def require_admin(
    user: dict[str, Any] = Depends(get_current_user),
) -> dict[str, Any]:
    """Raise 403 if the authenticated user is not in the admins table.

    Admins are identified by their Supabase auth user ID in the `admins` table.
    The `clients` table is NOT checked — admins are never clients.

    Dev-bypass users are granted admin unconditionally.

    Returns the user dict on success so downstream handlers can read ``sub``.

    Raises:
        HTTPException 403: if the user's ID is not found in the admins table.
    """
    from backend.config import settings

    # Dev bypass always passes as admin.
    if settings.app_env != "production" and user.get("sub") == "dev-user":
        return user

    user_id = user["sub"]
    try:
        sb = get_supabase()
        resp = (
            sb.table("admins")
            .select("id")
            .eq("id", user_id)
            .limit(1)
            .execute()
        )
        rows: list[dict] = resp.data or []
    except Exception as exc:
        logger.error("Admin table lookup failed", user_id=user_id, error=str(exc))
        raise HTTPException(status_code=500, detail="Role lookup failed")

    if not rows:
        raise HTTPException(status_code=403, detail="Admin access required")

    return user


async def is_admin(user_id: str) -> bool:
    """Check whether a user ID exists in the admins table.

    Used by non-decorator contexts (e.g. the /api/auth/me endpoint).
    Returns False on any DB error (fail-safe: deny admin access).
    """
    from backend.config import settings

    if settings.app_env != "production" and user_id == "dev-user":
        return True

    try:
        sb = get_supabase()
        resp = (
            sb.table("admins")
            .select("id")
            .eq("id", user_id)
            .limit(1)
            .execute()
        )
        return bool(resp.data)
    except Exception as exc:
        logger.warning("is_admin check failed", user_id=user_id, error=str(exc))
        return False
