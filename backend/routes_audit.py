"""Audit log of every admin write.

Implemented as pure ASGI middleware rather than per-route code, so every
current and future /api/admin write is captured with no opt-in — including
routers that live outside routes_admin (blog posts, settings, media).

Pure ASGI (not BaseHTTPMiddleware) because we need to read the request body
without consuming it before the route handler sees it; wrapping `receive`
passes every chunk through untouched.

Auditing must never break or slow a write: all failures are logged and
swallowed, and the record is written after the response has been sent.
"""
import json
import logging
import re
from typing import Optional

from fastapi import APIRouter, Query

from db import db
from models import gen_id, now_iso

logger = logging.getLogger(__name__)
router = APIRouter(tags=["audit"])

WRITE_METHODS = {"POST", "PUT", "PATCH", "DELETE"}
MAX_CAPTURE = 64 * 1024  # never buffer more than this of a request/response
MAX_VALUE = 200          # per-field truncation in the stored diff

SECRET_KEY = re.compile(r"pass(word)?|secret|token|api[_-]?key|signature|hash", re.I)

# Path resource → Mongo collection, for before/after snapshots.
COLLECTIONS = {
    "banners": "banners", "clients": "clients", "categories": "categories",
    "services": "services", "pages": "pages", "posts": "posts", "leads": "leads",
    "users": "users", "roles": "roles", "media": "assets",
}


def _redact(value):
    if isinstance(value, dict):
        return {k: ("[redacted]" if SECRET_KEY.search(k) else _redact(v)) for k, v in value.items()}
    if isinstance(value, list):
        return [_redact(v) for v in value[:50]]
    if isinstance(value, str) and len(value) > MAX_VALUE:
        return value[:MAX_VALUE] + "…"
    return value


def _diff(before: Optional[dict], after: Optional[dict]) -> dict:
    """Changed fields only, as {field: [old, new]}. Bookkeeping fields skipped."""
    skip = {"updated_at", "created_at", "_id"}
    before, after = before or {}, after or {}
    out = {}
    for k in sorted(set(before) | set(after)):
        if k in skip:
            continue
        old, new = before.get(k), after.get(k)
        if old != new:
            out[k] = _redact([old, new]) if not SECRET_KEY.search(k) else ["[redacted]", "[redacted]"]
    return out


def _parse_path(path: str):
    """'/api/admin/services/abc' → ('services', 'abc'). Sub-actions kept."""
    parts = [p for p in path.split("/") if p]
    try:
        i = parts.index("admin")
    except ValueError:
        return "", None, ""
    rest = parts[i + 1:]
    resource = rest[0] if rest else ""
    record_id = rest[1] if len(rest) > 1 else None
    sub = "/".join(rest[2:]) if len(rest) > 2 else ""
    return resource, record_id, sub


async def _snapshot(resource: str, record_id: Optional[str]):
    coll = COLLECTIONS.get(resource)
    if not coll or not record_id:
        if resource == "layouts" and record_id:
            return await db.layouts.find_one({"page": record_id}, {"_id": 0})
        if resource == "settings":
            return await db.settings.find_one({"id": "site"}, {"_id": 0})
        return None
    return await db[coll].find_one({"id": record_id}, {"_id": 0, "password_hash": 0})


async def _actor(headers: dict):
    auth = headers.get("authorization", "")
    if not auth.lower().startswith("bearer "):
        return None
    try:
        from auth import decode_token
        payload = decode_token(auth.split(" ", 1)[1].strip())
        user = await db.users.find_one({"id": payload.get("sub")},
                                       {"_id": 0, "id": 1, "email": 1, "name": 1})
        return user
    except Exception:  # noqa: BLE001 — an invalid token is still worth recording
        return None


class AuditMiddleware:
    def __init__(self, app):
        self.app = app

    async def __call__(self, scope, receive, send):
        if (
            scope.get("type") != "http"
            or scope.get("method") not in WRITE_METHODS
            or not scope.get("path", "").startswith("/api/admin/")
            # Issuing an upload URL changes nothing — the actual write is the
            # registration that follows, which is audited.
            or scope.get("path", "").endswith("/upload-target")
        ):
            return await self.app(scope, receive, send)

        req_chunks, res_chunks = [], []
        req_size = res_size = 0
        status = {"code": 500}

        async def recv():
            nonlocal req_size
            msg = await receive()
            if msg.get("type") == "http.request" and req_size < MAX_CAPTURE:
                body = msg.get("body", b"")
                req_chunks.append(body)
                req_size += len(body)
            return msg

        async def snd(msg):
            nonlocal res_size
            if msg.get("type") == "http.response.start":
                status["code"] = msg.get("status", 500)
            elif msg.get("type") == "http.response.body" and res_size < MAX_CAPTURE:
                body = msg.get("body", b"")
                res_chunks.append(body)
                res_size += len(body)
            await send(msg)

        resource, record_id, sub = _parse_path(scope["path"])
        before = None
        try:
            before = await _snapshot(resource, record_id)
        except Exception as e:  # noqa: BLE001
            logger.warning("audit: before-snapshot failed: %s", e)

        try:
            await self.app(scope, recv, snd)
        finally:
            try:
                await self._record(scope, resource, record_id, sub, before,
                                   b"".join(req_chunks), b"".join(res_chunks), status["code"])
            except Exception as e:  # noqa: BLE001
                logger.warning("audit: record failed: %s", e)

    async def _record(self, scope, resource, record_id, sub, before, req_body, res_body, code):
        headers = {k.decode().lower(): v.decode() for k, v in scope.get("headers", [])}
        actor = await _actor(headers)

        try:
            payload = json.loads(req_body or b"{}")
        except Exception:  # noqa: BLE001
            payload = {}
        try:
            response = json.loads(res_body or b"{}")
        except Exception:  # noqa: BLE001
            response = {}

        method = scope["method"]
        if not record_id and isinstance(response, dict):
            record_id = response.get("id")

        after = None
        if 200 <= code < 300 and method in {"PUT", "PATCH"}:
            after = await _snapshot(resource, record_id)
        elif 200 <= code < 300 and method == "POST" and isinstance(response, dict):
            after = {k: v for k, v in response.items() if k != "password_hash"}

        # Sub-actions like users/{id}/password: never store the body at all.
        if sub == "password":
            payload = {"password": "[redacted]"}

        action = {"POST": "create", "PUT": "update", "PATCH": "update", "DELETE": "delete"}[method]
        if sub:
            action = f"{action}:{sub}"

        label = None
        if record_id == "erase":
            # Don't write the erased person's email into a permanent log —
            # that would defeat the erasure. Record that it happened, not who.
            payload, record_id = {}, None
            label = "[data erasure request]"
            action = "delete:erase"
        for src in (() if label else (after, before, payload if isinstance(payload, dict) else None)):
            if isinstance(src, dict):
                label = src.get("name") or src.get("title") or src.get("email") or src.get("filename") or src.get("page")
                if label:
                    break

        await db.audit_log.insert_one({
            "id": gen_id(),
            "at": now_iso(),
            "actor_id": (actor or {}).get("id"),
            "actor_email": (actor or {}).get("email"),
            "actor_name": (actor or {}).get("name"),
            "method": method,
            "path": scope["path"],
            "resource": resource,
            "record_id": record_id,
            "record_label": str(label)[:120] if label else None,
            "action": action,
            "status": code,
            "ok": 200 <= code < 300,
            "changes": _diff(before, after) if method in {"PUT", "PATCH"} else {},
            "before": _redact(before) if method == "DELETE" else None,
            "payload": _redact(payload) if method == "POST" and not (200 <= code < 300) else None,
            "ip": headers.get("x-forwarded-for", "").split(",")[0].strip() or None,
        })


# ─── Read API (GET only — the log cannot be edited or deleted via the API) ──
@router.get("/audit")
async def list_audit(
    resource: Optional[str] = Query(None),
    actor: Optional[str] = Query(None, description="actor email"),
    only_failed: bool = Query(False),
    limit: int = Query(100, le=500),
    before: Optional[str] = Query(None, description="ISO timestamp cursor"),
):
    q = {}
    if resource and resource != "all":
        q["resource"] = resource
    if actor:
        q["actor_email"] = actor
    if only_failed:
        q["ok"] = False
    if before:
        q["at"] = {"$lt": before}
    docs = await db.audit_log.find(q, {"_id": 0}).sort("at", -1).to_list(limit)
    return {"items": docs, "next": docs[-1]["at"] if len(docs) == limit else None}
