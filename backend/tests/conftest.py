"""Test harness.

Runs the real FastAPI app against an in-memory MongoDB (mongomock-motor), so
tests need no database, no network and no secrets.

The patch has to happen before any app module imports `db`, because every
module does `from db import db` and binds the object at import time.
"""
import os
import sys
import pytest

os.environ.setdefault("MONGO_URL", "mongodb://unused")
os.environ.setdefault("DB_NAME", "rk_test")
os.environ.setdefault("JWT_SECRET", "test-secret-not-for-production")
os.environ.setdefault("ADMIN_EMAIL", "owner@example.com")
os.environ.setdefault("ADMIN_PASSWORD", "owner-password-123")
os.environ["DISABLE_BACKGROUND_JOBS"] = "1"
os.environ["RESEND_API_KEY"] = ""
os.environ["SITE_URL"] = "https://rk.test"

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from mongomock_motor import AsyncMongoMockClient  # noqa: E402
import db as db_module  # noqa: E402

_mock_client = AsyncMongoMockClient()
db_module.client = _mock_client
db_module.db = _mock_client[os.environ["DB_NAME"]]

from fastapi.testclient import TestClient  # noqa: E402
import server  # noqa: E402
import ratelimit  # noqa: E402

ADMIN_EMAIL = os.environ["ADMIN_EMAIL"]
ADMIN_PASSWORD = os.environ["ADMIN_PASSWORD"]


@pytest.fixture()
def client(monkeypatch):
    """Fresh database and fresh rate-limit counters for every test."""
    # Drop every collection so tests can't leak state into each other.
    # drop_database is async on the motor mock — it must be awaited, or it
    # silently does nothing and tests pass alone but fail together.
    import asyncio
    asyncio.run(db_module.client.drop_database(os.environ["DB_NAME"]))
    ratelimit.reset()

    sent = []

    async def fake_send(lead):
        sent.append(lead)
        return True

    import routes_catalog
    monkeypatch.setattr(routes_catalog, "send_lead_notification", fake_send)

    with TestClient(server.app) as c:  # runs startup → seeds roles, admin, content
        c.sent_emails = sent
        yield c


def login(client, email, password):
    r = client.post("/api/auth/login", json={"email": email, "password": password})
    assert r.status_code == 200, r.text
    return {"Authorization": f"Bearer {r.json()['token']}"}


@pytest.fixture()
def admin(client):
    return login(client, ADMIN_EMAIL, ADMIN_PASSWORD)


def role_id(client, headers, slug):
    roles = client.get("/api/admin/roles", headers=headers).json()
    return next(r["id"] for r in roles if r["slug"] == slug)


def make_user(client, admin_headers, slug, email=None, password="password-123"):
    """Create a user holding the given role slug and return auth headers."""
    email = email or f"{slug}@example.com"
    r = client.post("/api/admin/users", headers=admin_headers, json={
        "name": slug.title(), "email": email, "password": password,
        "role_id": role_id(client, admin_headers, slug),
    })
    assert r.status_code == 200, r.text
    return login(client, email, password)


@pytest.fixture()
def editor(client, admin):
    return make_user(client, admin, "editor")


@pytest.fixture()
def viewer(client, admin):
    return make_user(client, admin, "viewer")
