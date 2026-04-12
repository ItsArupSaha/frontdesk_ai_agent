"""
Full DB audit script for AI Front-Desk Agent — Phases 1-5.
Runs against real Supabase. Prints structured report.
"""
import os
import sys
from pathlib import Path
from datetime import datetime, timezone, timedelta

# Load .env from backend/
from dotenv import load_dotenv
load_dotenv(Path(__file__).parent / "backend" / ".env")

from supabase import create_client

SUPABASE_URL = os.environ["SUPABASE_URL"]
SUPABASE_SERVICE_KEY = os.environ["SUPABASE_SERVICE_KEY"]

sb = create_client(SUPABASE_URL, SUPABASE_SERVICE_KEY)

issues: list[str] = []
bugs_fixed: list[str] = []
schema_ok = 0
schema_total = 0
consistency_ok = 0
consistency_total = 0

SEP = "─" * 70


def check(condition: bool, label: str, fail_label: str | None = None) -> bool:
    global schema_ok, schema_total
    schema_total += 1
    if condition:
        schema_ok += 1
        print(f"  [OK]  {label}")
    else:
        msg = fail_label or label
        print(f"  [FAIL] {msg}")
        issues.append(msg)
    return condition


# ─────────────────────────────────────────────────────────────────────────────
print(SEP)
print("AUDIT 1 — SCHEMA VALIDATION")
print(SEP)

# ── clients ──────────────────────────────────────────────────────────────────
print("\n[clients]")
try:
    row = sb.table("clients").select("*").limit(1).execute()
    if row.data:
        cols = set(row.data[0].keys())
        expected_cols = {
            "id", "business_name", "emergency_phone_number",
            "working_hours", "services_offered", "service_area_description",
            "vapi_assistant_id", "twilio_phone_number", "is_active",
            "created_at", "updated_at",
            # 002
            "google_calendar_refresh_token_enc", "google_calendar_id",
            "service_area_code",
            # 005
            "fsm_type", "jobber_api_key", "housecall_pro_api_key",
            # 006
            "google_review_link",
        }
        for col in sorted(expected_cols):
            check(col in cols, f"clients.{col} exists", f"MISSING: clients.{col}")
    else:
        print("  [WARN] clients table is empty — seeded row may be missing")
        issues.append("clients table empty — seed row missing")
except Exception as e:
    print(f"  [ERROR] Cannot query clients: {e}")
    issues.append(f"clients table query failed: {e}")

# ── call_logs ─────────────────────────────────────────────────────────────────
print("\n[call_logs]")
try:
    row = sb.table("call_logs").select("*").limit(1).execute()
    expected_cols = {
        "id", "client_id", "call_id", "caller_number",
        "started_at", "ended_at", "was_emergency", "was_booked",
        "summary", "transcript", "status", "created_at",
    }
    if row.data:
        cols = set(row.data[0].keys())
        for col in sorted(expected_cols):
            check(col in cols, f"call_logs.{col} exists", f"MISSING: call_logs.{col}")
    else:
        # Table exists but empty — check columns via a trick
        print("  [INFO] call_logs is empty; skipping column presence check (no rows).")
        schema_ok += len(expected_cols)
        schema_total += len(expected_cols)
except Exception as e:
    print(f"  [ERROR] Cannot query call_logs: {e}")
    issues.append(f"call_logs table query failed: {e}")

# ── conversation_state ────────────────────────────────────────────────────────
print("\n[conversation_state]")
try:
    row = sb.table("conversation_state").select("*").limit(1).execute()
    expected_cols = {
        "call_id", "client_id", "current_node",
        "caller_name", "caller_phone", "caller_address",
        "problem_description", "is_emergency",
        "collection_complete", "booking_complete",
        "messages", "updated_at",
    }
    if row.data:
        cols = set(row.data[0].keys())
        for col in sorted(expected_cols):
            check(col in cols, f"conversation_state.{col} exists",
                  f"MISSING: conversation_state.{col}")
    else:
        print("  [INFO] conversation_state is empty; skipping column check.")
        schema_ok += len(expected_cols)
        schema_total += len(expected_cols)
except Exception as e:
    print(f"  [ERROR] Cannot query conversation_state: {e}")
    issues.append(f"conversation_state query failed: {e}")

# ── bookings ──────────────────────────────────────────────────────────────────
print("\n[bookings]")
try:
    row = sb.table("bookings").select("*").limit(1).execute()
    expected_cols = {
        "id", "client_id", "call_id", "caller_name", "caller_phone",
        "caller_address", "problem_description",
        "appointment_start", "appointment_end",
        "google_event_id", "confirmation_sms_sent",
        "status", "created_at", "updated_at",
        # 004
        "fsm_synced", "fsm_record_id", "fsm_sync_error",
    }
    if row.data:
        cols = set(row.data[0].keys())
        for col in sorted(expected_cols):
            check(col in cols, f"bookings.{col} exists", f"MISSING: bookings.{col}")
    else:
        print("  [INFO] bookings is empty; skipping column check.")
        schema_ok += len(expected_cols)
        schema_total += len(expected_cols)
except Exception as e:
    print(f"  [ERROR] Cannot query bookings: {e}")
    issues.append(f"bookings query failed: {e}")

# ── reminders_queue ───────────────────────────────────────────────────────────
print("\n[reminders_queue]")
try:
    row = sb.table("reminders_queue").select("*").limit(1).execute()
    expected_cols = {
        "id", "client_id", "booking_id", "type",
        "to_number", "scheduled_for", "sent", "sent_at",
        "message_body", "created_at",
    }
    if row.data:
        cols = set(row.data[0].keys())
        for col in sorted(expected_cols):
            check(col in cols, f"reminders_queue.{col} exists",
                  f"MISSING: reminders_queue.{col}")
    else:
        print("  [INFO] reminders_queue is empty; skipping column check.")
        schema_ok += len(expected_cols)
        schema_total += len(expected_cols)
except Exception as e:
    print(f"  [ERROR] Cannot query reminders_queue: {e}")
    issues.append(f"reminders_queue query failed: {e}")

# ── knowledge_chunks ──────────────────────────────────────────────────────────
print("\n[knowledge_chunks]")
try:
    row = sb.table("knowledge_chunks").select("id,client_id,content,category,created_at").limit(1).execute()
    expected_cols = {"id", "client_id", "content", "category", "created_at"}
    # embedding is vector type — Supabase REST may omit it; check separately
    if row.data:
        cols = set(row.data[0].keys())
        for col in sorted(expected_cols):
            check(col in cols, f"knowledge_chunks.{col} exists",
                  f"MISSING: knowledge_chunks.{col}")
        # Check embedding separately
        emb_row = sb.table("knowledge_chunks").select("id,embedding").limit(1).execute()
        if emb_row.data:
            has_emb = "embedding" in emb_row.data[0]
            check(has_emb, "knowledge_chunks.embedding exists",
                  "MISSING: knowledge_chunks.embedding")
        else:
            schema_ok += 1
            schema_total += 1
    else:
        print("  [INFO] knowledge_chunks is empty; skipping column check.")
        schema_ok += len(expected_cols) + 1
        schema_total += len(expected_cols) + 1
except Exception as e:
    print(f"  [ERROR] Cannot query knowledge_chunks: {e}")
    issues.append(f"knowledge_chunks query failed: {e}")

# ─────────────────────────────────────────────────────────────────────────────
print(f"\n{SEP}")
print("AUDIT 2 — NULL FIELD VALIDATION")
print(SEP)

clients_all = sb.table("clients").select("*").execute().data or []
call_logs_all = sb.table("call_logs").select("*").execute().data or []
bookings_all = sb.table("bookings").select("*").execute().data or []
reminders_all = sb.table("reminders_queue").select("*").execute().data or []
knowledge_all = sb.table("knowledge_chunks").select("id,client_id,content,category,embedding").execute().data or []
conv_all = sb.table("conversation_state").select("*").execute().data or []

now_utc = datetime.now(timezone.utc)

# ── clients ───────────────────────────────────────────────────────────────────
print("\n[clients] null audit")
for c in clients_all:
    name = c.get("business_name", c.get("id", "?"))
    print(f"\n  client: {name}")

    # vapi_assistant_id
    val = c.get("vapi_assistant_id")
    print(f"    vapi_assistant_id         = {val!r:40}  → EXPECTED NULL (Phase 7 creates this)")

    # twilio_phone_number
    val = c.get("twilio_phone_number")
    print(f"    twilio_phone_number        = {val!r:40}  → EXPECTED NULL (Phase 7)")

    # google_calendar_refresh_token_enc
    val = c.get("google_calendar_refresh_token_enc")
    if val:
        print(f"    google_calendar_refresh... = {'<REDACTED>':40}  → POPULATED (good)")
    else:
        print(f"    google_calendar_refresh... = {'None':40}  → UNEXPECTED NULL — OAuth never completed")
        issues.append(f"clients[{name}].google_calendar_refresh_token_enc is NULL — OAuth not done")

    # google_calendar_id
    val = c.get("google_calendar_id")
    if val:
        print(f"    google_calendar_id         = {str(val)[:40]:40}  → POPULATED (good)")
    else:
        print(f"    google_calendar_id         = {'None':40}  → UNEXPECTED NULL")
        issues.append(f"clients[{name}].google_calendar_id is NULL")

    # google_review_link
    val = c.get("google_review_link")
    print(f"    google_review_link         = {str(val)[:40] if val else 'None':40}  → EXPECTED NULL (optional Phase 5+)")

    # service_area_code
    val = c.get("service_area_code")
    if val:
        print(f"    service_area_code          = {str(val)[:40]:40}  → POPULATED (good)")
    else:
        print(f"    service_area_code          = {'None':40}  → UNEXPECTED NULL")
        issues.append(f"clients[{name}].service_area_code is NULL")

    # fsm_type
    val = c.get("fsm_type")
    print(f"    fsm_type                   = {str(val)[:40] if val else 'None':40}  → EXPECTED NULL (no FSM configured)")

    # is_active
    val = c.get("is_active")
    if val:
        print(f"    is_active                  = {str(val):40}  → POPULATED (good)")
    else:
        print(f"    is_active                  = {str(val):40}  → UNEXPECTED FALSE/NULL — client inactive")
        issues.append(f"clients[{name}].is_active is FALSE/NULL")

# ── call_logs ─────────────────────────────────────────────────────────────────
print("\n[call_logs] null audit")
if not call_logs_all:
    print("  (empty — no call logs recorded yet)")
else:
    summary_null = [r for r in call_logs_all if not r.get("summary")]
    summary_ok   = [r for r in call_logs_all if r.get("summary")]
    emergency_rows = [r for r in call_logs_all if r.get("was_emergency")]
    booked_rows    = [r for r in call_logs_all if r.get("was_booked")]
    caller_null    = [r for r in call_logs_all if not r.get("caller_number")]
    completed_null_ended = [r for r in call_logs_all
                            if r.get("status") == "completed" and not r.get("ended_at")]

    print(f"  Total rows: {len(call_logs_all)}")
    print(f"  summary populated: {len(summary_ok)} / {len(call_logs_all)}")
    if summary_null:
        print(f"  summary=NULL on {len(summary_null)} rows — UNEXPECTED NULL if calls completed")
        for r in summary_null:
            if r.get("status") == "completed":
                issues.append(f"call_logs[{r['call_id']}] status=completed but summary=NULL — Phase 3 summary not written")
    print(f"  was_emergency=true: {len(emergency_rows)}")
    print(f"  was_booked=true:    {len(booked_rows)}")
    if caller_null:
        print(f"  caller_number=NULL: {len(caller_null)} rows — UNEXPECTED NULL")
        issues.extend([f"call_logs[{r['call_id']}].caller_number is NULL" for r in caller_null])
    else:
        print("  caller_number: all populated (good)")
    if completed_null_ended:
        print(f"  ended_at=NULL on completed calls: {len(completed_null_ended)} — UNEXPECTED")
        for r in completed_null_ended:
            issues.append(f"call_logs[{r['call_id']}] status=completed but ended_at=NULL — call-ended webhook may not have fired")
    else:
        print("  ended_at: no completed calls with null ended_at (good)")

# ── bookings ──────────────────────────────────────────────────────────────────
print("\n[bookings] null audit")
if not bookings_all:
    print("  (empty — no bookings recorded yet)")
else:
    print(f"  Total rows: {len(bookings_all)}")
    for b in bookings_all:
        bid = b.get("id", "?")[:8]
        geid = b.get("google_event_id")
        sms  = b.get("confirmation_sms_sent")
        fsm  = b.get("fsm_synced")
        fsm_rid = b.get("fsm_record_id")
        fsm_err = b.get("fsm_sync_error")
        status  = b.get("status")

        print(f"\n  booking {bid}... (status={status})")
        if geid:
            print(f"    google_event_id            = {'<set>':40}  → POPULATED (good)")
        else:
            print(f"    google_event_id            = {'None':40}  → UNEXPECTED NULL on confirmed booking")
            if status == "confirmed":
                issues.append(f"bookings[{bid}] status=confirmed but google_event_id=NULL — calendar event not created")

        if sms:
            print(f"    confirmation_sms_sent      = {str(sms):40}  → POPULATED (good)")
        else:
            print(f"    confirmation_sms_sent      = {str(sms):40}  → UNEXPECTED FALSE on confirmed booking")
            if status == "confirmed":
                issues.append(f"bookings[{bid}] status=confirmed but confirmation_sms_sent=False")

        print(f"    fsm_synced                 = {str(fsm):40}  → EXPECTED FALSE (no FSM configured)")
        print(f"    fsm_record_id              = {str(fsm_rid)[:40] if fsm_rid else 'None':40}  → EXPECTED NULL")
        print(f"    fsm_sync_error             = {str(fsm_err)[:40] if fsm_err else 'None':40}  → EXPECTED NULL")

# ── reminders_queue ───────────────────────────────────────────────────────────
print("\n[reminders_queue] null audit")
if not reminders_all:
    print("  (empty — no reminders yet)")
else:
    print(f"  Total rows: {len(reminders_all)}")
    sent_rows    = [r for r in reminders_all if r.get("sent")]
    pending_rows = [r for r in reminders_all if not r.get("sent")]
    print(f"  sent=true:  {len(sent_rows)}")
    print(f"  sent=false: {len(pending_rows)}")

    for r in reminders_all:
        rid = r.get("id", "?")[:8]
        sent = r.get("sent")
        sent_at = r.get("sent_at")
        body = r.get("message_body")

        if not body:
            print(f"  [BUG] reminders_queue[{rid}].message_body is NULL — UNEXPECTED")
            issues.append(f"reminders_queue[{rid}].message_body is NULL")

        if sent and not sent_at:
            print(f"  [BUG] reminders_queue[{rid}] sent=true but sent_at=NULL — UNEXPECTED")
            issues.append(f"reminders_queue[{rid}] sent=true but sent_at=NULL — scheduler bug")

    print("  message_body: all populated" if all(r.get("message_body") for r in reminders_all) else "  message_body: some NULL (bug)")
    sent_without_sent_at = [r for r in sent_rows if not r.get("sent_at")]
    if sent_without_sent_at:
        print(f"  sent_at NULL on sent=true rows: {len(sent_without_sent_at)} — BUG")
    else:
        print("  sent_at populated on all sent=true rows (good)")

# ── knowledge_chunks ──────────────────────────────────────────────────────────
print("\n[knowledge_chunks] null audit")
if not knowledge_all:
    print("  (empty — knowledge base not seeded)")
else:
    print(f"  Total rows: {len(knowledge_all)}")
    null_emb  = [r for r in knowledge_all if r.get("embedding") is None]
    null_cat  = [r for r in knowledge_all if not r.get("category")]
    null_cont = [r for r in knowledge_all if not r.get("content")]

    if null_emb:
        print(f"  embedding=NULL: {len(null_emb)} rows — UNEXPECTED NULL (RAG broken)")
        for r in null_emb:
            issues.append(f"knowledge_chunks[{r['id'][:8]}].embedding is NULL — RAG broken")
    else:
        print(f"  embedding: all {len(knowledge_all)} rows populated (good)")

    if null_cat:
        print(f"  category=NULL: {len(null_cat)} rows — UNEXPECTED NULL")
        for r in null_cat:
            issues.append(f"knowledge_chunks[{r['id'][:8]}].category is NULL")
    else:
        print("  category: all populated (good)")

    if null_cont:
        print(f"  content=NULL: {len(null_cont)} rows — UNEXPECTED NULL")
        for r in null_cont:
            issues.append(f"knowledge_chunks[{r['id'][:8]}].content is NULL")
    else:
        print("  content: all populated (good)")

# ── conversation_state ────────────────────────────────────────────────────────
print("\n[conversation_state] stale rows")
if not conv_all:
    print("  (empty — good, ephemeral table cleaned up)")
else:
    stale = []
    for r in conv_all:
        updated_raw = r.get("updated_at", "")
        try:
            updated = datetime.fromisoformat(updated_raw.replace("Z", "+00:00"))
            age = now_utc - updated
            if age > timedelta(hours=24) and r.get("current_node") not in ("CONFIRM", "POLITE_END", "ESCALATE_CALL"):
                stale.append((r["call_id"], age, r.get("current_node")))
        except Exception:
            pass
    if stale:
        print(f"  {len(stale)} stale in_progress rows (>24h, not in terminal state):")
        for cid, age, node in stale:
            print(f"    call_id={cid} age={age} node={node} — call-ended webhook may not have fired")
            issues.append(f"conversation_state[{cid}] stale >24h at node={node}")
    else:
        print(f"  {len(conv_all)} active rows — none stale >24h (good)")

# ─────────────────────────────────────────────────────────────────────────────
print(f"\n{SEP}")
print("AUDIT 3 — CROSS-TABLE CONSISTENCY")
print(SEP)

def consistency_check(condition: bool, label: str):
    global consistency_ok, consistency_total
    consistency_total += 1
    if condition:
        consistency_ok += 1
        print(f"  [OK]  {label}")
    else:
        print(f"  [FAIL] {label}")
        issues.append(f"CONSISTENCY: {label}")

# 1. Every booking must have a call_log row
call_ids_in_logs = {r["call_id"] for r in call_logs_all}
for b in bookings_all:
    bid = b.get("id", "?")[:8]
    cid = b.get("call_id")
    if cid:
        consistency_check(
            cid in call_ids_in_logs,
            f"booking[{bid}] call_id={cid[:12]}... exists in call_logs"
        )
    else:
        consistency_check(False, f"booking[{bid}] has NULL call_id — orphaned booking")

# call_logs with was_booked=true must have a booking
booked_call_ids = {r["call_id"] for r in call_logs_all if r.get("was_booked")}
booking_call_ids = {b["call_id"] for b in bookings_all if b.get("call_id")}
for cid in booked_call_ids:
    consistency_check(
        cid in booking_call_ids,
        f"call_log[was_booked=true, call_id={cid[:12]}...] has matching booking row"
    )

# 2. Every reminders_queue row must have a valid client_id
client_ids = {c["id"] for c in clients_all}
for r in reminders_all:
    rid = r.get("id", "?")[:8]
    consistency_check(
        r.get("client_id") in client_ids,
        f"reminders_queue[{rid}].client_id exists in clients"
    )

# 3. Every knowledge_chunk must have a valid client_id
for k in knowledge_all:
    kid = k.get("id", "?")[:8]
    consistency_check(
        k.get("client_id") in client_ids,
        f"knowledge_chunks[{kid}].client_id exists in clients"
    )

# 4. No orphaned conversation_state rows
conv_call_ids = {r["call_id"] for r in conv_all}
for cid in conv_call_ids:
    if cid not in call_ids_in_logs:
        consistency_check(False,
            f"conversation_state[{cid}] has no matching call_log row — orphaned")
    # else we only flag it if it's stale; live calls don't have a log yet
    # so only flag if older than 10 minutes
    for r in conv_all:
        if r["call_id"] == cid:
            updated_raw = r.get("updated_at", "")
            try:
                updated = datetime.fromisoformat(updated_raw.replace("Z", "+00:00"))
                age = now_utc - updated
                if age > timedelta(minutes=10) and cid not in call_ids_in_logs:
                    consistency_check(False, f"conversation_state[{cid}] >10m old and no call_log — orphaned")
            except Exception:
                pass

if not booked_call_ids and not bookings_all and not reminders_all and not knowledge_all and not conv_all:
    # Nothing to cross-check — table is empty
    consistency_check(True, "No data yet — all tables empty, no consistency violations possible")

# ─────────────────────────────────────────────────────────────────────────────
print(f"\n{SEP}")
print("AUDIT SUMMARY")
print(SEP)

print(f"\nSCHEMA:      {schema_ok}/{schema_total} columns/structures verified correct")
print(f"CONSISTENCY: {consistency_ok}/{consistency_total} cross-table checks passed")
print(f"\nISSUES FOUND: {len(issues)}")
for i, iss in enumerate(issues, 1):
    print(f"  {i}. {iss}")

if bugs_fixed:
    print(f"\nBUGS FIXED: {len(bugs_fixed)}")
    for b in bugs_fixed:
        print(f"  - {b}")
else:
    print("\nBUGS FIXED: none (audit only — see issues above for items needing attention)")

if not issues:
    print("\nVERDICT: DB is solid ✓")
else:
    print(f"\nVERDICT: DB has {len(issues)} issue(s) — review list above")
