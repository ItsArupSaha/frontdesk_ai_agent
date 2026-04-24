"""Client configuration helpers — maps DB rows to the agent's client_config dict."""
from __future__ import annotations


def row_to_config(row: dict) -> dict:
    """Map a clients DB row to the client_config dict used by the agent."""
    return {
        "id": str(row["id"]),
        "business_name": row["business_name"],
        "bot_name": row.get("bot_name") or "Alex",
        "emergency_phone_number": row["emergency_phone_number"],
        "main_phone_number": row.get("main_phone_number") or "",
        "is_ai_enabled": row.get("is_ai_enabled", True),
        "timezone": row.get("timezone") or "America/New_York",
        "missed_call_threshold_seconds": int(row.get("missed_call_threshold_seconds") or 30),
        "appointment_duration_minutes": int(row.get("appointment_duration_minutes") or 60),
        "working_hours": row.get("working_hours") or {},
        "services_offered": row.get("services_offered") or [],
        "service_area_description": row.get("service_area_description") or "",
        "google_review_link": row.get("google_review_link") or "",
        "is_active": row.get("is_active", True),
        "fsm_type": row.get("fsm_type"),
        "jobber_api_key": row.get("jobber_api_key") or "",
        "housecall_pro_api_key": row.get("housecall_pro_api_key") or "",
    }
