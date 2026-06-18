"""Iteration 2 tests: Resend email, Insights/Blog (public + admin), Cloudinary signature, sitemap, stats."""
import os
import time
import uuid
import logging
import pytest
import requests

BASE_URL = os.environ.get("REACT_APP_BACKEND_URL").rstrip("/")
API = f"{BASE_URL}/api"

ADMIN_EMAIL = "admin@ascendai.in"
ADMIN_PASSWORD = "Admin@12345"

SEEDED_SLUGS = [
    "what-a-business-analyst-actually-does-on-an-ai-project",
    "from-prd-to-prototype-shipping-an-ai-mvp-in-six-weeks",
    "the-fractional-ba-playbook",
]


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
    return r.json()["token"]


@pytest.fixture(scope="session")
def admin_headers(admin_token):
    return {"Authorization": f"Bearer {admin_token}", "Content-Type": "application/json"}


@pytest.fixture(scope="session")
def user_headers(session):
    creds = {
        "email": f"TEST_blog_{uuid.uuid4().hex[:8]}@example.com",
        "name": "Blog Tester",
        "password": "Test@12345",
    }
    r = session.post(f"{API}/auth/register", json=creds)
    assert r.status_code == 200, r.text
    token = r.json()["token"]
    return {"Authorization": f"Bearer {token}", "Content-Type": "application/json"}


# ---------- Resend / Leads email notification ----------
class TestLeadEmail:
    def test_create_lead_triggers_email(self, session, caplog):
        """Posting a lead returns 200 and (via background task) Resend sends a notification."""
        payload = {
            "name": "TEST_EmailLead",
            "email": "TEST_emaillead@example.com",
            "phone": "555-0001",
            "company": "Resend Test Co",
            "message": "Please contact me",
            "source": "contact_form",
        }
        r = session.post(f"{API}/leads", json=payload)
        assert r.status_code == 200, r.text
        data = r.json()
        assert data["email"] == payload["email"]
        # Give background task time to flush
        time.sleep(4)
        # Confirm via supervisor/backend log file
        log_paths = [
            "/var/log/supervisor/backend.out.log",
            "/var/log/supervisor/backend.err.log",
        ]
        found = False
        for p in log_paths:
            if os.path.exists(p):
                with open(p, "r", errors="ignore") as f:
                    txt = f.read()
                if "Lead notification sent" in txt:
                    found = True
                    break
        assert found, "Expected 'Lead notification sent' in backend logs"


# ---------- Insights public API ----------
class TestInsightsPublic:
    def test_list_published(self, session):
        r = session.get(f"{API}/insights")
        assert r.status_code == 200
        posts = r.json()
        assert isinstance(posts, list)
        slugs = [p["slug"] for p in posts]
        for s in SEEDED_SLUGS:
            assert s in slugs, f"Missing seeded slug {s}; got {slugs}"
        # validate fields
        sample = next(p for p in posts if p["slug"] == SEEDED_SLUGS[0])
        assert sample["status"] == "published"
        assert sample["published_at"]
        assert sample["title"]
        assert isinstance(sample["tags"], list)

    def test_get_by_slug(self, session):
        r = session.get(f"{API}/insights/{SEEDED_SLUGS[0]}")
        assert r.status_code == 200
        post = r.json()
        assert post["slug"] == SEEDED_SLUGS[0]
        assert post["body"], "Post body markdown missing"
        assert post["status"] == "published"

    def test_bad_slug_404(self, session):
        r = session.get(f"{API}/insights/bad-slug-xyz")
        assert r.status_code == 404

    def test_tag_filter(self, session):
        r = session.get(f"{API}/insights", params={"tag": "AI"})
        # Even if no posts match, must be 200 list
        assert r.status_code == 200
        assert isinstance(r.json(), list)


# ---------- Insights admin API ----------
class TestInsightsAdmin:
    def test_admin_requires_auth(self, session):
        r = session.get(f"{API}/admin/posts")
        assert r.status_code == 401

    def test_admin_forbidden_for_user(self, session, user_headers):
        r = session.get(f"{API}/admin/posts", headers=user_headers)
        assert r.status_code == 403

    def test_admin_list_posts(self, session, admin_headers):
        r = session.get(f"{API}/admin/posts", headers=admin_headers)
        assert r.status_code == 200
        posts = r.json()
        assert len(posts) >= 3

    def test_admin_post_crud_lifecycle(self, session, admin_headers):
        slug = f"test-post-{uuid.uuid4().hex[:8]}"
        payload = {
            "slug": slug,
            "title": "TEST Post",
            "excerpt": "Test excerpt",
            "body": "# Heading\n\nContent here",
            "author": "Tester",
            "tags": ["test", "ci"],
            "meta_description": "test meta",
            "status": "draft",
            "read_time_min": 3,
        }
        # CREATE draft
        r = session.post(f"{API}/admin/posts", json=payload, headers=admin_headers)
        assert r.status_code == 200, r.text
        post = r.json()
        pid = post["id"]
        assert post["status"] == "draft"
        assert post["published_at"] in (None, "")

        # Should not appear in public listing (draft)
        pub = session.get(f"{API}/insights/{slug}")
        assert pub.status_code == 404

        # UPDATE → publish
        payload["status"] = "published"
        payload["title"] = "TEST Post Published"
        r = session.put(f"{API}/admin/posts/{pid}", json=payload, headers=admin_headers)
        assert r.status_code == 200, r.text
        updated = r.json()
        assert updated["status"] == "published"
        assert updated["published_at"], "published_at should be set on publish"
        assert updated["title"] == "TEST Post Published"

        # Now public
        pub = session.get(f"{API}/insights/{slug}")
        assert pub.status_code == 200
        assert pub.json()["title"] == "TEST Post Published"

        # DELETE
        r = session.delete(f"{API}/admin/posts/{pid}", headers=admin_headers)
        assert r.status_code == 200
        # Verify gone
        pub = session.get(f"{API}/insights/{slug}")
        assert pub.status_code == 404

    def test_admin_create_duplicate_slug(self, session, admin_headers):
        # use seeded slug
        payload = {
            "slug": SEEDED_SLUGS[0],
            "title": "duplicate",
            "body": "x",
            "status": "draft",
        }
        r = session.post(f"{API}/admin/posts", json=payload, headers=admin_headers)
        assert r.status_code == 409


# ---------- Sitemap ----------
class TestSitemapInsights:
    def test_sitemap_contains_post_slugs(self, session):
        r = session.get(f"{API}/sitemap.xml")
        assert r.status_code == 200
        text = r.text
        for s in SEEDED_SLUGS:
            assert f"/insights/{s}" in text, f"sitemap missing /insights/{s}"
        assert "/insights<" in text or "<loc>" in text  # ensure insights index exists
        # Stronger assertion: the literal /insights index
        assert "/insights</loc>" in text or "/insights\n" in text or "/insights<" in text


# ---------- Stats includes posts ----------
class TestStatsPosts:
    def test_stats_has_post_counts(self, session, admin_headers):
        r = session.get(f"{API}/admin/stats", headers=admin_headers)
        assert r.status_code == 200
        d = r.json()
        assert "posts" in d and isinstance(d["posts"], int)
        assert "published_posts" in d and isinstance(d["published_posts"], int)
        assert d["posts"] >= 3
        assert d["published_posts"] >= 3


# ---------- Cloudinary signature ----------
class TestCloudinary:
    def test_signature_admin_valid_folder(self, session, admin_headers):
        r = session.get(f"{API}/cloudinary/signature", params={"folder": "banners/"}, headers=admin_headers)
        assert r.status_code == 200, r.text
        d = r.json()
        for k in ("signature", "timestamp", "cloud_name", "api_key", "folder"):
            assert k in d
        assert d["folder"] == "banners"
        assert isinstance(d["timestamp"], int)
        assert len(d["signature"]) > 10

    def test_signature_all_allowed_folders(self, session, admin_headers):
        for f in ("banners/", "services/", "blog/", "uploads/"):
            r = session.get(f"{API}/cloudinary/signature", params={"folder": f}, headers=admin_headers)
            assert r.status_code == 200, f"{f} -> {r.status_code} {r.text}"

    def test_signature_invalid_folder(self, session, admin_headers):
        r = session.get(f"{API}/cloudinary/signature", params={"folder": "evil/"}, headers=admin_headers)
        assert r.status_code == 400

    def test_signature_requires_auth(self, session):
        r = session.get(f"{API}/cloudinary/signature", params={"folder": "banners/"})
        assert r.status_code == 401

    def test_signature_forbidden_user(self, session, user_headers):
        r = session.get(f"{API}/cloudinary/signature", params={"folder": "banners/"}, headers=user_headers)
        assert r.status_code == 403
