"""Role-based access control.

These guard who can change or delete the site's content, so every rule here
is a security property, not a convenience.
"""
import asyncio

import pytest

from conftest import login, role_id, make_user, ADMIN_EMAIL, ADMIN_PASSWORD


def run(coro):
    return asyncio.run(coro)


# ── Seeding ─────────────────────────────────────────────────────────────────
def test_seed_creates_three_system_roles(client, admin):
    slugs = {r["slug"]: r for r in client.get("/api/admin/roles", headers=admin).json()}
    assert {"admin", "editor", "viewer"} <= set(slugs)
    assert all(slugs[s]["system"] for s in ("admin", "editor", "viewer"))


def test_seeded_admin_gets_the_administrator_role_on_first_boot(client, admin):
    """Regression: seed order used to leave a fresh admin with role_id=None."""
    users = client.get("/api/admin/users", headers=admin).json()
    me = next(u for u in users if u["email"] == ADMIN_EMAIL)
    assert me["role_id"] == role_id(client, admin, "admin")
    assert me["role_name"] == "Administrator"


# ── Permission resolution ───────────────────────────────────────────────────
def test_legacy_admin_without_role_id_keeps_full_access(client):
    from auth import permissions_for
    perms = run(permissions_for({"role": "admin", "role_id": None}))
    assert all(all(a.values()) for a in perms.values())


def test_admin_role_is_all_powerful_whatever_is_stored(client, admin):
    """Lockout guard: even if the stored matrix were emptied, admin stays full."""
    import db as dbm
    from auth import permissions_for
    rid = role_id(client, admin, "admin")
    run(dbm.db.roles.update_one({"id": rid}, {"$set": {"permissions": {}}}))
    perms = run(permissions_for({"role": "user", "role_id": rid}))
    assert all(all(a.values()) for a in perms.values())


def test_unknown_role_id_grants_nothing(client):
    from auth import permissions_for
    perms = run(permissions_for({"role": "user", "role_id": "does-not-exist"}))
    assert not any(any(a.values()) for a in perms.values())


def test_admin_role_permissions_cannot_be_reduced_via_api(client, admin):
    rid = role_id(client, admin, "admin")
    r = client.put(f"/api/admin/roles/{rid}", headers=admin,
                   json={"name": "Administrator", "permissions": {}})
    assert r.status_code == 200
    stored = r.json()["permissions"]
    assert all(all(a.values()) for a in stored.values())


def test_system_roles_cannot_be_deleted(client, admin):
    r = client.delete(f"/api/admin/roles/{role_id(client, admin, 'viewer')}", headers=admin)
    assert r.status_code == 400


# ── Enforcement over HTTP ───────────────────────────────────────────────────
def test_viewer_can_read_but_not_write(client, viewer):
    assert client.get("/api/admin/services", headers=viewer).status_code == 200
    r = client.post("/api/admin/services", headers=viewer,
                    json={"name": "X", "slug": "x"})
    assert r.status_code == 403


def test_viewer_cannot_write_blog_posts(client, admin, viewer):
    """Regression: the posts router used require_admin, which let a Viewer in."""
    created = client.post("/api/admin/posts", headers=admin, json={
        "slug": "p1", "title": "P1", "status": "draft",
    })
    assert created.status_code == 200, created.text
    pid = created.json()["id"]
    assert client.delete(f"/api/admin/posts/{pid}", headers=viewer).status_code == 403
    assert client.post("/api/admin/posts", headers=viewer,
                       json={"slug": "p2", "title": "P2"}).status_code == 403


def test_viewer_cannot_get_an_upload_signature(client, viewer):
    """Regression: a signature lets the holder upload to the Cloudinary account."""
    r = client.get("/api/cloudinary/signature?folder=uploads/", headers=viewer)
    assert r.status_code == 403


def test_editor_manages_content_but_not_users_roles_or_audit(client, editor):
    assert client.post("/api/admin/categories", headers=editor,
                       json={"name": "C", "slug": "c"}).status_code == 200
    assert client.get("/api/admin/users", headers=editor).status_code == 200  # read-only
    assert client.post("/api/admin/users", headers=editor, json={
        "name": "N", "email": "n@example.com", "password": "password-123",
    }).status_code == 403
    assert client.post("/api/admin/roles", headers=editor, json={"name": "R"}).status_code == 403
    assert client.get("/api/admin/audit", headers=editor).status_code == 403


def test_user_with_no_role_is_kept_out_of_admin(client):
    # e.g. an account left over from when the site had public sign-up
    import asyncio
    import db as dbm
    from auth import create_token
    from models import User
    u = User(email="public@example.com", name="Public", password_hash="x", role="user")
    asyncio.run(dbm.db.users.insert_one(u.model_dump()))
    headers = {"Authorization": f"Bearer {create_token(u.id, u.role)}"}
    assert client.get("/api/admin/services", headers=headers).status_code == 403
    # Unknown admin paths are denied too, not waved through.
    assert client.get("/api/admin/does-not-exist", headers=headers).status_code in (403, 404)


def test_unauthenticated_requests_are_rejected(client):
    assert client.get("/api/admin/services").status_code == 401


# ── Account safety guards ───────────────────────────────────────────────────
def _me_id(client, admin):
    return next(u["id"] for u in client.get("/api/admin/users", headers=admin).json()
                if u["email"] == ADMIN_EMAIL)


def test_cannot_demote_the_last_admin(client, admin):
    r = client.put(f"/api/admin/users/{_me_id(client, admin)}", headers=admin,
                   json={"role_id": role_id(client, admin, "viewer")})
    assert r.status_code == 400
    assert "last active administrator" in r.json()["detail"]


def test_cannot_deactivate_or_delete_yourself(client, admin):
    me = _me_id(client, admin)
    assert client.put(f"/api/admin/users/{me}", headers=admin, json={"active": False}).status_code == 400
    assert client.delete(f"/api/admin/users/{me}", headers=admin).status_code == 400


def test_second_admin_allows_demoting_the_first(client, admin):
    make_user(client, admin, "admin", email="second@example.com")
    r = client.put(f"/api/admin/users/{_me_id(client, admin)}", headers=admin,
                   json={"role_id": role_id(client, admin, "editor")})
    assert r.status_code == 200


def test_suspended_user_cannot_sign_in(client, admin):
    make_user(client, admin, "editor", email="suspend@example.com")
    uid = next(u["id"] for u in client.get("/api/admin/users", headers=admin).json()
               if u["email"] == "suspend@example.com")
    client.put(f"/api/admin/users/{uid}", headers=admin, json={"active": False})
    r = client.post("/api/auth/login", json={"email": "suspend@example.com", "password": "password-123"})
    assert r.status_code == 403


def test_suspended_users_existing_token_stops_working(client, admin):
    token = make_user(client, admin, "editor", email="token@example.com")
    uid = next(u["id"] for u in client.get("/api/admin/users", headers=admin).json()
               if u["email"] == "token@example.com")
    client.put(f"/api/admin/users/{uid}", headers=admin, json={"active": False})
    assert client.get("/api/admin/services", headers=token).status_code == 403


def test_login_records_last_login(client, admin):
    users = client.get("/api/admin/users", headers=admin).json()
    me = next(u for u in users if u["email"] == ADMIN_EMAIL)
    assert me["last_login"]


def test_role_in_use_cannot_be_deleted(client, admin):
    r = client.post("/api/admin/roles", headers=admin, json={"name": "Sales"})
    rid = r.json()["id"]
    client.post("/api/admin/users", headers=admin, json={
        "name": "S", "email": "s@example.com", "password": "password-123", "role_id": rid,
    })
    assert client.delete(f"/api/admin/roles/{rid}", headers=admin).status_code == 400


@pytest.mark.parametrize("path,resource,action", [
    ("/api/admin/services/abc", "services", "update"),
    ("/api/admin/stats", "reports", "read"),
    ("/api/admin/media/bulk-delete", "media", "create"),
])
def test_path_and_method_map_to_the_right_permission(client, admin, path, resource, action):
    """A custom role with exactly one permission can do exactly that thing."""
    perms = {resource: {action: True}}
    rid = client.post("/api/admin/roles", headers=admin,
                      json={"name": f"only-{resource}-{action}", "permissions": perms}).json()["id"]
    email = f"{resource}-{action}@example.com"
    client.post("/api/admin/users", headers=admin, json={
        "name": "U", "email": email, "password": "password-123", "role_id": rid})
    h = login(client, email, "password-123")
    method = {"read": "GET", "update": "PUT", "create": "POST"}[action]
    r = client.request(method, path, headers=h, json={"ids": []} if "bulk" in path else {})
    assert r.status_code != 403, f"{method} {path} was denied with {perms}"
    # …and the same user is denied a different resource.
    assert client.get("/api/admin/users", headers=h).status_code == 403
