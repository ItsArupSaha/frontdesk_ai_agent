"""Shared field validators for Pydantic models throughout the application."""
from __future__ import annotations

import re

_EMAIL_RE = re.compile(r"^[^@\s]+@[^@\s]+\.[^@\s]+$")
_E164_RE = re.compile(r"^\+1[2-9]\d{9}$")  # US E.164


def validate_email(v: str) -> str:
    """Validate email format."""
    if not _EMAIL_RE.match(v):
        raise ValueError("Invalid email format")
    return v.lower().strip()


def validate_phone(v: str) -> str:
    """Validate US E.164 phone format (+1XXXXXXXXXX)."""
    if not _E164_RE.match(v):
        raise ValueError("emergency_phone must be US E.164 format: +1XXXXXXXXXX")
    return v


def validate_business_name(v: str) -> str:
    """Validate business name is non-empty."""
    if not v.strip():
        raise ValueError("business_name is required")
    return v.strip()


def validate_area_code(v: str) -> str:
    """Validate area code is exactly 3 digits."""
    if not re.fullmatch(r"\d{3}", v):
        raise ValueError("area_code must be exactly 3 digits")
    return v
