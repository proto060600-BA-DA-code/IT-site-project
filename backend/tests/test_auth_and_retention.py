"""Login throttling, retention purge, and the SEO route manifest."""
import asyncio
from datetime import datetime, timedelta, timezone

import db as dbm


def run(coro):
    return asyncio.run(coro)


def days_ago(n):
    return (datetime.now(timezone.utc) - timedelta(days=n)).isoformat()


# ── Login throttling ────────────────────────────────────────────────────────
def test_repeated_failed_logins_for_one_account_are_throttled(client):
    codes = [client.post("/api/auth/login", json={
        "email": "owner@example.com", "password": "wrong"}).status_code for _ in range(9)]
    assert codes[:8] == [401] * 8
    assert codes[8] == 429


def test_unknown_and_wrong_password_give_the_same_error(client):
    a = client.post("/api/auth/login", json={"email": "nobody@example.com", "password": "x"})
    b = client.post("/api/auth/login", json={"email": "owner@example.com", "password": "x"})
    assert a.status_code == b.status_code == 401
    assert a.json() == b.json()


def test_short_passwords_are_rejected_at_registration(client):
    r = client.post("/api/auth/register", json={"email": "s@example.com", "name": "S", "password": "short"})
    assert r.status_code == 400


# ── Retention purge ─────────────────────────────────────────────────────────
def test_retention_deletes_only_expired_data_and_leaves_a_record(client, admin):
    from retention import purge_once
    run(dbm.db.leads.insert_many([
        {"id": "old", "email": "o@x", "status": "new", "created_at": days_ago(800)},
        {"id": "fresh", "email": "f@x", "status": "new", "created_at": days_ago(5)},
        {"id": "oldspam", "email": "s@x", "status": "spam", "created_at": days_ago(40)},
        {"id": "newspam", "email": "n@x", "status": "spam", "created_at": days_ago(2)},
    ]))
    counts = run(purge_once())
    remaining = {d["id"] for d in run(dbm.db.leads.find({}, {"_id": 0, "id": 1}).to_list(10))}
    assert remaining == {"fresh", "newspam"}
    assert counts["leads"] == 1 and counts["spam"] == 1

    log = client.get("/api/admin/audit", headers=admin).json()["items"]
    sys = [e for e in log if e["action"] == "delete:retention"]
    assert sys and "o@x" not in str(sys)


def test_zero_retention_means_keep_forever(client, admin):
    from retention import purge_once
    client.put("/api/admin/settings", headers=admin, json={"lead_retention_days": 0})
    run(dbm.db.leads.insert_one({"id": "ancient", "status": "new", "created_at": days_ago(5000)}))
    run(purge_once())
    assert run(dbm.db.leads.find_one({"id": "ancient"}))


def test_retention_settings_must_be_whole_numbers(client, admin):
    assert client.put("/api/admin/settings", headers=admin,
                      json={"lead_retention_days": "lots"}).status_code == 400
    assert client.put("/api/admin/settings", headers=admin,
                      json={"spam_retention_days": -5}).status_code == 400


# ── SEO manifest ────────────────────────────────────────────────────────────
def test_seo_manifest_covers_every_live_service_with_jsonld(client):
    m = client.get("/api/seo/routes").json()
    paths = {r["path"]: r for r in m["routes"]}
    services = run(dbm.db.services.find({"active": True}, {"_id": 0, "slug": 1}).to_list(100))
    assert services, "seed should provide services"
    for s in services:
        r = paths[f"/services/{s['slug']}"]
        types = {n["@type"] for n in r["jsonld"]["@graph"]}
        assert {"ProfessionalService", "Service", "BreadcrumbList"} <= types
        assert r["canonical"] == f"https://rk.test/services/{s['slug']}"


def test_seo_descriptions_fit_googles_snippet_length(client):
    for r in client.get("/api/seo/routes").json()["routes"]:
        assert len(r["description"]) <= 156, r["path"]
        assert r["description"], f"{r['path']} has no description"
