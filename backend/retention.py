"""Automatic deletion of personal data past its retention period (DPDP Act).

Runs once at startup and then every 24 hours in-process. On Render's free tier
the service sleeps when idle, so "every 24 hours" really means "at least once
per wake-up, and daily while awake" — enough to keep data inside its window.

A DB lease stops two overlapping instances (e.g. during a deploy) from
running the same purge twice.

Every run that deletes anything writes a system entry to the audit log, so an
admin can see that data was removed and how much — never whose.
"""
import asyncio
import logging
from datetime import datetime, timedelta, timezone

from db import db
from models import gen_id, now_iso

logger = logging.getLogger(__name__)

INTERVAL_SECONDS = 24 * 3600
LEASE_SECONDS = 15 * 60
_task = None


def _cutoff(days: int) -> str:
    return (datetime.now(timezone.utc) - timedelta(days=days)).isoformat()


async def _take_lease() -> bool:
    now = datetime.now(timezone.utc)
    until = (now + timedelta(seconds=LEASE_SECONDS)).isoformat()
    try:
        res = await db.jobs.find_one_and_update(
            {"id": "retention", "$or": [{"locked_until": {"$lt": now.isoformat()}},
                                        {"locked_until": None}]},
            {"$set": {"locked_until": until}},
        )
        if res:
            return True
        # First ever run: no lease document yet.
        if not await db.jobs.find_one({"id": "retention"}):
            await db.jobs.insert_one({"id": "retention", "locked_until": until})
            return True
        return False
    except Exception as e:  # noqa: BLE001
        logger.warning("retention: lease failed: %s", e)
        return False


async def purge_once() -> dict:
    """Delete expired data. Returns counts. Safe to call directly (tests)."""
    from routes_settings import get_settings

    s = await get_settings()

    def days(key, default):
        try:
            return max(0, int(s.get(key, default)))
        except (TypeError, ValueError):
            return default

    lead_days = days("lead_retention_days", 730)
    spam_days = days("spam_retention_days", 30)
    audit_days = days("audit_retention_days", 730)

    counts = {"leads": 0, "spam": 0, "chat_messages": 0, "audit_log": 0}

    if spam_days:
        r = await db.leads.delete_many({"status": "spam", "created_at": {"$lt": _cutoff(spam_days)}})
        counts["spam"] = r.deleted_count
    if lead_days:
        r = await db.leads.delete_many({"created_at": {"$lt": _cutoff(lead_days)}})
        counts["leads"] = r.deleted_count
        r = await db.chat_messages.delete_many({"created_at": {"$lt": _cutoff(lead_days)}})
        counts["chat_messages"] = r.deleted_count
    if audit_days:
        r = await db.audit_log.delete_many({"at": {"$lt": _cutoff(audit_days)}})
        counts["audit_log"] = r.deleted_count

    if any(counts.values()):
        summary = ", ".join(f"{n} {k.replace('_', ' ')}" for k, n in counts.items() if n)
        await db.audit_log.insert_one({
            "id": gen_id(),
            "at": now_iso(),
            "actor_id": None,
            "actor_email": None,
            "actor_name": "System — retention policy",
            "method": "SYSTEM",
            "path": None,
            "resource": "leads",
            "record_id": None,
            "record_label": f"Deleted {summary}",
            "action": "delete:retention",
            "status": 200,
            "ok": True,
            "changes": {},
            "before": None,
            "payload": None,
            "ip": None,
        })
        logger.info("retention: deleted %s", summary)

    return counts


async def _loop():
    while True:
        try:
            if await _take_lease():
                await purge_once()
        except Exception as e:  # noqa: BLE001 — never let the loop die
            logger.exception("retention: run failed: %s", e)
        await asyncio.sleep(INTERVAL_SECONDS)


def start():
    global _task
    if _task is None or _task.done():
        _task = asyncio.create_task(_loop())


async def stop():
    global _task
    if _task and not _task.done():
        _task.cancel()
        try:
            await _task
        except (asyncio.CancelledError, Exception):  # noqa: BLE001
            pass
    _task = None
