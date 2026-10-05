"""Audit log: every admin write is recorded, secrets never are."""
import json

from conftest import ADMIN_EMAIL


def entries(client, admin, **params):
    return client.get("/api/admin/audit", headers=admin, params=params).json()["items"]


def test_create_update_delete_are_recorded_with_actor(client, admin):
    r = client.post("/api/admin/categories", headers=admin, json={"name": "Audited", "slug": "audited"})
    cid = r.json()["id"]
    client.put(f"/api/admin/categories/{cid}", headers=admin, json={"name": "Renamed", "slug": "audited"})
    client.delete(f"/api/admin/categories/{cid}", headers=admin)

    log = entries(client, admin, resource="categories")
    actions = [e["action"] for e in log]
    assert actions[:3] == ["delete", "update", "create"]  # newest first
    assert all(e["actor_email"] == ADMIN_EMAIL for e in log[:3])
    assert all(e["record_id"] == cid for e in log[:3])


def test_update_stores_a_field_level_diff(client, admin):
    cid = client.post("/api/admin/categories", headers=admin,
                      json={"name": "Before", "slug": "diff"}).json()["id"]
    client.put(f"/api/admin/categories/{cid}", headers=admin, json={"name": "After", "slug": "diff"})
    upd = next(e for e in entries(client, admin, resource="categories") if e["action"] == "update")
    assert upd["changes"]["name"] == ["Before", "After"]
    assert "updated_at" not in upd["changes"]  # bookkeeping fields are noise


def test_delete_keeps_a_copy_of_what_was_removed(client, admin):
    cid = client.post("/api/admin/categories", headers=admin,
                      json={"name": "Gone", "slug": "gone"}).json()["id"]
    client.delete(f"/api/admin/categories/{cid}", headers=admin)
    d = next(e for e in entries(client, admin, resource="categories") if e["action"] == "delete")
    assert d["before"]["name"] == "Gone"
    assert d["record_label"] == "Gone"


def test_passwords_never_reach_the_log(client, admin):
    r = client.post("/api/admin/users", headers=admin, json={
        "name": "Pw", "email": "pw@example.com", "password": "super-secret-pass"})
    uid = r.json()["id"]
    client.post(f"/api/admin/users/{uid}/password", headers=admin, json={"password": "another-secret-1"})
    blob = json.dumps(entries(client, admin, resource="users"))
    assert "super-secret-pass" not in blob
    assert "another-secret-1" not in blob
    assert "password_hash" not in blob


def test_denied_writes_are_recorded_as_failures(client, admin, viewer):
    client.post("/api/admin/categories", headers=viewer, json={"name": "No", "slug": "no"})
    failed = entries(client, admin, only_failed="true")
    assert any(e["status"] == 403 and e["resource"] == "categories" for e in failed)


def test_erasure_is_logged_without_the_persons_email(client, admin):
    client.post("/api/leads", json={
        "name": "Erase Me", "email": "erase-me@example.com", "consent": True,
        "form_started_at": 0,
    })
    r = client.post("/api/admin/leads/erase", headers=admin, json={"email": "erase-me@example.com"})
    assert r.json()["deleted"] == 1
    blob = json.dumps(entries(client, admin))
    assert "erase-me@example.com" not in blob
    assert "[data erasure request]" in blob


def test_log_is_read_only(client, admin):
    assert client.post("/api/admin/audit", headers=admin, json={}).status_code == 405
    assert client.delete("/api/admin/audit", headers=admin).status_code == 405


def test_reads_are_not_logged(client, admin):
    before = len(entries(client, admin))
    client.get("/api/admin/services", headers=admin)
    client.get("/api/admin/categories", headers=admin)
    assert len(entries(client, admin)) == before
