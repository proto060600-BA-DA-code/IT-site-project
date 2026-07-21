"""Comprehensive backend tests for RK AI Labs API."""
import os
import json
import uuid
import time
import pytest
import requests

BASE_URL = os.environ.get("REACT_APP_BACKEND_URL", "https://commerce-advisor-ai.preview.emergentagent.com").rstrip("/")
API = f"{BASE_URL}/api"

ADMIN_EMAIL = "admin@iamrohankapoor.com"
ADMIN_PASSWORD = "Admin@12345"


# ---------- Fixtures ----------
@pytest.fixture(scope="session")
def session():
    s = requests.Session()
    s.headers.update({"Content-Type": "application/json"})
    return s


@pytest.fixture(scope="session")
def admin_token(session):
    r = session.post(f"{API}/auth/login", json={"email": ADMIN_EMAIL, "password": ADMIN_PASSWORD})
    assert r.status_code == 200, f"Admin login failed: {r.status_code} {r.text}"
    data = r.json()
    assert data["user"]["role"] == "admin"
    return data["token"]


@pytest.fixture(scope="session")
def admin_headers(admin_token):
    return {"Authorization": f"Bearer {admin_token}", "Content-Type": "application/json"}


@pytest.fixture(scope="session")
def user_credentials():
    return {
        "email": f"TEST_user_{uuid.uuid4().hex[:8]}@example.com",
        "name": "Test User",
        "password": "Test@12345",
    }


@pytest.fixture(scope="session")
def user_token(session, user_credentials):
    r = session.post(f"{API}/auth/register", json=user_credentials)
    assert r.status_code == 200, f"Register failed: {r.status_code} {r.text}"
    return r.json()["token"]


@pytest.fixture(scope="session")
def user_headers(user_token):
    return {"Authorization": f"Bearer {user_token}", "Content-Type": "application/json"}


# ---------- Health ----------
class TestHealth:
    def test_root(self, session):
        r = session.get(f"{API}/")
        assert r.status_code == 200
        assert r.json().get("status") == "ok"

    def test_health(self, session):
        r = session.get(f"{API}/health")
        assert r.status_code == 200
        assert r.json().get("ok") is True


# ---------- Auth ----------
class TestAuth:
    def test_admin_login(self, session):
        r = session.post(f"{API}/auth/login", json={"email": ADMIN_EMAIL, "password": ADMIN_PASSWORD})
        assert r.status_code == 200
        data = r.json()
        assert "token" in data
        assert data["user"]["role"] == "admin"
        assert data["user"]["email"] == ADMIN_EMAIL

    def test_login_invalid(self, session):
        r = session.post(f"{API}/auth/login", json={"email": ADMIN_EMAIL, "password": "wrong"})
        assert r.status_code == 401

    def test_register_and_me(self, session, user_token):
        # user_token fixture registers - now verify /me
        r = session.get(f"{API}/auth/me", headers={"Authorization": f"Bearer {user_token}"})
        assert r.status_code == 200
        data = r.json()
        assert data["role"] == "user"
        assert data["email"].startswith("test_user_")

    def test_register_duplicate(self, session, user_credentials):
        r = session.post(f"{API}/auth/register", json=user_credentials)
        assert r.status_code == 409

    def test_me_no_token(self, session):
        r = session.get(f"{API}/auth/me")
        assert r.status_code == 401


# ---------- Public Catalog ----------
class TestCatalog:
    def test_banners(self, session):
        r = session.get(f"{API}/banners")
        assert r.status_code == 200
        data = r.json()
        assert isinstance(data, list)
        assert len(data) >= 2

    def test_categories(self, session):
        r = session.get(f"{API}/categories")
        assert r.status_code == 200
        data = r.json()
        assert len(data) >= 4
        slugs = [c["slug"] for c in data]
        assert "strategy-advisory" in slugs

    def test_services_list(self, session):
        r = session.get(f"{API}/services")
        assert r.status_code == 200
        assert len(r.json()) >= 6

    def test_services_featured(self, session):
        r = session.get(f"{API}/services", params={"featured": True})
        assert r.status_code == 200
        services = r.json()
        assert all(s["featured"] for s in services)
        assert len(services) >= 1

    def test_service_by_slug(self, session):
        r = session.get(f"{API}/services/commerce-audit-roadmap")
        assert r.status_code == 200
        s = r.json()
        assert s["slug"] == "commerce-audit-roadmap"
        assert s["features"]
        assert s["deliverables"]

    def test_service_bad_slug(self, session):
        r = session.get(f"{API}/services/nonexistent-slug-xyz")
        assert r.status_code == 404

    def test_category_by_slug(self, session):
        r = session.get(f"{API}/categories/strategy-advisory")
        assert r.status_code == 200
        assert r.json()["slug"] == "strategy-advisory"

    def test_page_about(self, session):
        r = session.get(f"{API}/pages/about")
        assert r.status_code == 200
        page = r.json()
        assert page["slug"] == "about"
        assert "RK AI Labs" in page["content"]

    def test_pages_privacy_terms(self, session):
        for slug in ["privacy", "terms"]:
            r = session.get(f"{API}/pages/{slug}")
            assert r.status_code == 200
            assert r.json()["slug"] == slug


# ---------- Leads ----------
class TestLeads:
    def test_create_lead_public(self, session):
        payload = {
            "name": "TEST_LeadUser",
            "email": "TEST_lead@example.com",
            "phone": "555-1234",
            "company": "Acme",
            "message": "Interested in audit",
            "source": "contact_form",
        }
        r = session.post(f"{API}/leads", json=payload)
        assert r.status_code == 200
        data = r.json()
        assert data["email"] == "TEST_lead@example.com"
        assert data["status"] == "new"
        assert "id" in data

    def test_admin_list_leads_requires_auth(self, session):
        r = session.get(f"{API}/admin/leads")
        assert r.status_code == 401

    def test_admin_list_leads_forbidden_for_user(self, session, user_headers):
        r = session.get(f"{API}/admin/leads", headers=user_headers)
        assert r.status_code == 403

    def test_admin_lead_update_delete(self, session, admin_headers):
        # Create
        lead = session.post(f"{API}/leads", json={
            "name": "TEST_CRUD", "email": "TEST_crud@example.com", "message": "x"
        }).json()
        lid = lead["id"]

        # List as admin
        r = session.get(f"{API}/admin/leads", headers=admin_headers)
        assert r.status_code == 200
        assert any(item["id"] == lid for item in r.json())

        # Update status
        r = session.put(f"{API}/admin/leads/{lid}", json={"status": "contacted"}, headers=admin_headers)
        assert r.status_code == 200
        assert r.json()["status"] == "contacted"

        # Delete
        r = session.delete(f"{API}/admin/leads/{lid}", headers=admin_headers)
        assert r.status_code == 200


# ---------- Admin CRUD ----------
class TestAdminCRUD:
    def test_banners_crud(self, session, admin_headers):
        payload = {"title": "TEST_Banner", "subtitle": "sub", "order": 99}
        r = session.post(f"{API}/admin/banners", json=payload, headers=admin_headers)
        assert r.status_code == 200
        bid = r.json()["id"]

        r = session.get(f"{API}/admin/banners", headers=admin_headers)
        assert r.status_code == 200
        assert any(b["id"] == bid for b in r.json())

        r = session.put(f"{API}/admin/banners/{bid}", json={**payload, "title": "TEST_Banner_Updated"}, headers=admin_headers)
        assert r.status_code == 200
        assert r.json()["title"] == "TEST_Banner_Updated"

        r = session.delete(f"{API}/admin/banners/{bid}", headers=admin_headers)
        assert r.status_code == 200

    def test_categories_crud(self, session, admin_headers):
        slug = f"test-cat-{uuid.uuid4().hex[:6]}"
        payload = {"name": "TEST_Cat", "slug": slug, "order": 99}
        r = session.post(f"{API}/admin/categories", json=payload, headers=admin_headers)
        assert r.status_code == 200
        cid = r.json()["id"]

        r = session.put(f"{API}/admin/categories/{cid}", json={**payload, "name": "TEST_Cat_U"}, headers=admin_headers)
        assert r.status_code == 200
        r = session.delete(f"{API}/admin/categories/{cid}", headers=admin_headers)
        assert r.status_code == 200

    def test_services_crud(self, session, admin_headers):
        slug = f"test-svc-{uuid.uuid4().hex[:6]}"
        payload = {"name": "TEST_Svc", "slug": slug, "short_description": "x"}
        r = session.post(f"{API}/admin/services", json=payload, headers=admin_headers)
        assert r.status_code == 200
        sid = r.json()["id"]

        r = session.put(f"{API}/admin/services/{sid}", json={**payload, "name": "TEST_Svc_U"}, headers=admin_headers)
        assert r.status_code == 200
        r = session.delete(f"{API}/admin/services/{sid}", headers=admin_headers)
        assert r.status_code == 200

    def test_pages_crud(self, session, admin_headers):
        slug = f"test-page-{uuid.uuid4().hex[:6]}"
        payload = {"slug": slug, "title": "TEST", "content": "hello"}
        r = session.post(f"{API}/admin/pages", json=payload, headers=admin_headers)
        assert r.status_code == 200
        pid = r.json()["id"]

        r = session.put(f"{API}/admin/pages/{pid}", json={**payload, "title": "TEST_U"}, headers=admin_headers)
        assert r.status_code == 200
        r = session.delete(f"{API}/admin/pages/{pid}", headers=admin_headers)
        assert r.status_code == 200

    def test_admin_unauthorized(self, session):
        r = session.get(f"{API}/admin/banners")
        assert r.status_code == 401

    def test_admin_forbidden_user(self, session, user_headers):
        r = session.get(f"{API}/admin/banners", headers=user_headers)
        assert r.status_code == 403


# ---------- Stats ----------
class TestStats:
    def test_admin_stats(self, session, admin_headers):
        r = session.get(f"{API}/admin/stats", headers=admin_headers)
        assert r.status_code == 200
        d = r.json()
        for k in ["banners", "categories", "services", "pages", "leads", "new_leads", "users"]:
            assert k in d
            assert isinstance(d[k], int)


# ---------- SEO ----------
class TestSEO:
    def test_sitemap(self, session):
        r = session.get(f"{API}/sitemap.xml")
        assert r.status_code == 200
        assert "<urlset" in r.text
        assert "/services/commerce-audit-roadmap" in r.text

    def test_robots_api(self, session):
        r = session.get(f"{API}/robots.txt")
        assert r.status_code == 200
        assert "User-agent" in r.text


# ---------- Chat SSE ----------
class TestChat:
    def test_chat_stream(self):
        url = f"{API}/chat/stream"
        with requests.post(url, json={"message": "What services do you offer?"}, stream=True, timeout=60) as r:
            assert r.status_code == 200
            events = []
            session_id = None
            deltas = []
            done = False
            start = time.time()
            for line in r.iter_lines(decode_unicode=True):
                if line is None:
                    continue
                if time.time() - start > 45:
                    break
                if line.startswith("event:"):
                    cur_event = line.split(":", 1)[1].strip()
                    events.append(cur_event)
                elif line.startswith("data:"):
                    data = line.split(":", 1)[1].strip()
                    if events and events[-1] == "session":
                        session_id = data
                    elif events and events[-1] == "delta":
                        deltas.append(data)
                    elif events and events[-1] == "done":
                        done = True
                        break
            assert session_id is not None, "No session event"
            assert len(deltas) > 0, "No delta events"
            assert done, "No done event"

        # history
        r = requests.get(f"{API}/chat/history/{session_id}", timeout=10)
        assert r.status_code == 200
        msgs = r.json()
        assert len(msgs) >= 2
        roles = [m["role"] for m in msgs]
        assert "user" in roles and "assistant" in roles
