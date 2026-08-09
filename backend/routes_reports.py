"""Reporting and CSV export.

Leads are the only data on this site with real business signal, so the reports
are built around them: volume over time, where they come from, how far they get
through the funnel, and how fast they're being handled.
"""
import csv
import io
from datetime import datetime, timezone, timedelta
from fastapi import APIRouter, Query
from fastapi.responses import StreamingResponse
from typing import Optional

from db import db

router = APIRouter(tags=["reports"])

LEAD_STATUSES = ["new", "contacted", "qualified", "closed"]


def _cutoff(days: int) -> str:
    return (datetime.now(timezone.utc) - timedelta(days=days)).isoformat()


def _day(iso: str) -> str:
    return (iso or "")[:10]


@router.get("/reports/leads")
async def leads_report(days: int = Query(30, ge=1, le=365)):
    since = _cutoff(days)
    docs = await db.leads.find({}, {"_id": 0}).to_list(10000)
    recent = [d for d in docs if (d.get("created_at") or "") >= since]

    # Volume per day, zero-filled so the chart has no gaps.
    counts = {}
    for d in recent:
        counts[_day(d.get("created_at", ""))] = counts.get(_day(d.get("created_at", "")), 0) + 1
    today = datetime.now(timezone.utc).date()
    series = []
    for i in range(days - 1, -1, -1):
        key = (today - timedelta(days=i)).isoformat()
        series.append({"date": key, "count": counts.get(key, 0)})

    by_source, by_status, by_service = {}, {}, {}
    for d in recent:
        by_source[d.get("source") or "unknown"] = by_source.get(d.get("source") or "unknown", 0) + 1
        by_status[d.get("status") or "new"] = by_status.get(d.get("status") or "new", 0) + 1
        svc = d.get("service_interest") or "unspecified"
        by_service[svc] = by_service.get(svc, 0) + 1

    total = len(recent)
    qualified = by_status.get("qualified", 0) + by_status.get("closed", 0)
    closed = by_status.get("closed", 0)

    # Previous window, for a like-for-like trend figure.
    prev_since = _cutoff(days * 2)
    previous = [d for d in docs if prev_since <= (d.get("created_at") or "") < since]
    prev_total = len(previous)
    change = round(((total - prev_total) / prev_total) * 100, 1) if prev_total else None

    return {
        "range_days": days,
        "total": total,
        "previous_total": prev_total,
        "change_pct": change,
        "qualified": qualified,
        "closed": closed,
        "conversion_pct": round((closed / total) * 100, 1) if total else 0.0,
        "qualification_pct": round((qualified / total) * 100, 1) if total else 0.0,
        "series": series,
        "by_source": [{"key": k, "count": v} for k, v in sorted(by_source.items(), key=lambda x: -x[1])],
        "by_status": [{"key": s, "count": by_status.get(s, 0)} for s in LEAD_STATUSES],
        "by_service": [{"key": k, "count": v} for k, v in sorted(by_service.items(), key=lambda x: -x[1])[:8]],
        "recent": sorted(recent, key=lambda d: d.get("created_at", ""), reverse=True)[:10],
    }


@router.get("/reports/content")
async def content_report():
    async def n(coll, q=None):
        return await db[coll].count_documents(q or {})

    return {
        "services": await n("services"),
        "services_featured": await n("services", {"featured": True}),
        "categories": await n("categories"),
        "posts": await n("posts"),
        "pages": await n("pages"),
        "banners": await n("banners"),
        "clients": await n("clients"),
        "assets": await n("assets"),
        "users": await n("users"),
        "users_active": await n("users", {"active": {"$ne": False}}),
    }


def _csv_response(rows: list, fieldnames: list, filename: str) -> StreamingResponse:
    buf = io.StringIO()
    writer = csv.DictWriter(buf, fieldnames=fieldnames, extrasaction="ignore")
    writer.writeheader()
    for r in rows:
        writer.writerow(r)
    buf.seek(0)
    return StreamingResponse(
        iter([buf.getvalue()]),
        media_type="text/csv",
        headers={"Content-Disposition": f'attachment; filename="{filename}"'},
    )


@router.get("/reports/export/leads")
async def export_leads(
    status: Optional[str] = Query(None),
    source: Optional[str] = Query(None),
    days: Optional[int] = Query(None, ge=1, le=3650),
):
    query = {}
    if status and status != "all":
        query["status"] = status
    if source and source != "all":
        query["source"] = source
    if days:
        query["created_at"] = {"$gte": _cutoff(days)}

    docs = await db.leads.find(query, {"_id": 0}).sort("created_at", -1).to_list(10000)
    fields = ["created_at", "name", "email", "phone", "company",
              "service_interest", "source", "status", "message"]
    stamp = datetime.now(timezone.utc).strftime("%Y%m%d")
    return _csv_response(docs, fields, f"leads-{stamp}.csv")


@router.get("/reports/export/{resource}")
async def export_resource(resource: str):
    """Generic CSV export for any catalogue collection."""
    allowed = {
        "services": ["name", "slug", "category_id", "short_description", "price_label", "featured", "active"],
        "categories": ["name", "slug", "parent_id", "description", "order", "active"],
        "posts": ["title", "slug", "excerpt", "published", "created_at"],
        "clients": ["name", "website", "order", "active"],
        "users": ["name", "email", "role", "active", "last_login", "created_at"],
        "media": ["filename", "url", "folder", "mime", "bytes", "width", "height"],
    }
    if resource not in allowed:
        from fastapi import HTTPException
        raise HTTPException(status_code=400, detail=f"'{resource}' is not exportable")

    coll = "assets" if resource == "media" else resource
    docs = await db[coll].find({}, {"_id": 0, "password_hash": 0}).to_list(10000)
    stamp = datetime.now(timezone.utc).strftime("%Y%m%d")
    return _csv_response(docs, allowed[resource], f"{resource}-{stamp}.csv")


@router.post("/reports/import/{resource}")
async def import_resource(resource: str, payload: dict):
    """Commit rows parsed and column-mapped in the browser.

    `dry_run` returns what would happen without writing, so the UI can show a
    preview before anything touches the database.
    """
    from fastapi import HTTPException

    importable = {"services", "categories", "clients", "leads"}
    if resource not in importable:
        raise HTTPException(status_code=400, detail=f"'{resource}' cannot be imported")

    rows = payload.get("rows") or []
    dry_run = bool(payload.get("dry_run"))
    key_field = payload.get("key_field") or ("slug" if resource != "leads" else "email")

    if not rows:
        raise HTTPException(status_code=400, detail="No rows supplied")
    if len(rows) > 5000:
        raise HTTPException(status_code=400, detail="Import is capped at 5000 rows per file")

    created = updated = skipped = 0
    errors = []

    for i, row in enumerate(rows):
        key = (row or {}).get(key_field)
        if not key:
            skipped += 1
            errors.append({"row": i + 1, "error": f"missing '{key_field}'"})
            continue
        existing = await db[resource].find_one({key_field: key}, {"_id": 0, "id": 1})
        if existing:
            updated += 1
            if not dry_run:
                from models import now_iso
                await db[resource].update_one(
                    {"id": existing["id"]}, {"$set": {**row, "updated_at": now_iso()}}
                )
        else:
            created += 1
            if not dry_run:
                from models import gen_id, now_iso
                await db[resource].insert_one(
                    {**row, "id": gen_id(), "created_at": now_iso(), "updated_at": now_iso()}
                )

    return {
        "dry_run": dry_run,
        "created": created,
        "updated": updated,
        "skipped": skipped,
        "errors": errors[:50],
    }
