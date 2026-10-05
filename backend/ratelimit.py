"""Sliding-window rate limiting, as FastAPI dependencies.

In-process memory, deliberately: the backend runs as a single Render instance,
so a shared store (Redis) would add a paid dependency for no benefit. If the
service is ever scaled to more than one instance, each instance enforces its
own limit — acceptable for spam/abuse throttling, but swap this for a shared
store before relying on it for anything stricter.

Counters reset on restart. That's fine: the goal is to blunt brute-force and
spam bursts, not to keep a durable ledger.
"""
import time
from collections import deque
from typing import Callable, Deque, Dict, Optional

from fastapi import HTTPException, Request

_hits: Dict[str, Deque[float]] = {}
_MAX_KEYS = 50_000  # cap memory if someone sprays random keys


def client_ip(request: Request) -> str:
    # Render (and Vercel) put the real client first in X-Forwarded-For.
    fwd = request.headers.get("x-forwarded-for", "")
    if fwd:
        return fwd.split(",")[0].strip()
    return request.client.host if request.client else "unknown"


def _check(key: str, limit: int, window: int) -> Optional[int]:
    """Record a hit; return seconds-until-retry if over the limit, else None."""
    now = time.monotonic()
    q = _hits.get(key)
    if q is None:
        if len(_hits) >= _MAX_KEYS:
            # Drop the stalest half rather than grow without bound.
            for k in sorted(_hits, key=lambda k: _hits[k][-1] if _hits[k] else 0)[: _MAX_KEYS // 2]:
                _hits.pop(k, None)
        q = _hits[key] = deque()
    while q and now - q[0] > window:
        q.popleft()
    if len(q) >= limit:
        return int(window - (now - q[0])) + 1
    q.append(now)
    return None


def hit(key: str, limit: int, window: int):
    """Imperative form, for limits keyed on request *body* fields (e.g. email)."""
    retry = _check(key, limit, window)
    if retry is not None:
        raise HTTPException(
            status_code=429,
            detail="Too many attempts. Please wait a few minutes and try again.",
            headers={"Retry-After": str(retry)},
        )


def limit_by_ip(bucket: str, limit: int, window: int) -> Callable:
    """Dependency: `Depends(limit_by_ip("leads", 5, 600))` = 5 per 10 min per IP."""

    async def _dep(request: Request):
        hit(f"{bucket}:ip:{client_ip(request)}", limit, window)

    return _dep


def reset():
    """Test helper."""
    _hits.clear()
