"""Rebrand to Synferrous: the one-time content migration, and a guard against
the old name creeping back into the codebase."""
import asyncio
import json
import os
import re
from pathlib import Path

import db as dbm
from seed import migrate_rebrand_synferrous

OLD = re.compile(r"RK AI Labs|iamrohankapoor\.com", re.I)


def run(coro):
    return asyncio.run(coro)


def _simulate_live_database():
    """What production holds before the migration: old brand everywhere."""
    run(dbm.db.migrations.delete_many({"id": "rebrand_synferrous"}))
    run(dbm.db.settings.update_one({"id": "site"}, {"$set": {
        "brand_name": "RK AI Labs", "logo_title": "RK AI Labs",
        "footer_legal": "© 2026 RK AI Labs · All rights reserved",
        "email": "hello@iamrohankapoor.com",
        "consent_text": "I agree to RK AI Labs using these details to respond to my enquiry.",
    }}))
    run(dbm.db.pages.update_one({"slug": "about"}, {"$set": {
        "content": "## Hello\n\nRK AI Labs is my practice. Email privacy@iamrohankapoor.com."}}))
    run(dbm.db.posts.update_many({}, {"$set": {"author": "RK AI Labs Team"}}))
    layout = run(dbm.db.layouts.find_one({"page": "home"}, {"_id": 0}))
    for b in layout["blocks"]:
        if b["type"] == "why_us":
            b["props"]["eyebrow"] = "Why RK AI Labs"
        if b["type"] == "capabilities":
            b["props"]["eyebrow"] = "What we do"
    run(dbm.db.layouts.update_one({"page": "home"}, {"$set": {"blocks": layout["blocks"]}}))


def test_live_content_is_fully_rebranded(client):
    _simulate_live_database()
    run(migrate_rebrand_synferrous())

    s = client.get("/api/settings").json()
    assert s["brand_name"] == s["logo_title"] == "Synferrous"
    assert s["email"] == "hello@synferrous.com"
    assert "Synferrous" in s["consent_text"]

    about = client.get("/api/pages/about").json()["content"]
    assert "Synferrous is my practice" in about
    assert "privacy@synferrous.com" in about

    blocks = client.get("/api/layouts/home").json()["blocks"]
    props = {b["type"]: b["props"] for b in blocks}
    assert props["why_us"]["eyebrow"] == "Why Synferrous"
    assert props["capabilities"]["eyebrow"] == "Services"

    posts = run(dbm.db.posts.find({}, {"_id": 0, "author": 1}).to_list(50))
    assert posts and all(p["author"] == "Rohan Kapoor" for p in posts)

    # Nothing public still carries the old name or domain.
    public = json.dumps([
        s, about, blocks,
        client.get("/api/services").json(), client.get("/api/categories").json(),
        client.get("/api/seo/routes").json(),
    ])
    assert not OLD.search(public), OLD.search(public)


def test_migration_runs_once_so_later_edits_stick(client):
    _simulate_live_database()
    run(migrate_rebrand_synferrous())
    run(dbm.db.settings.update_one({"id": "site"}, {"$set": {"footer_legal": "© RK AI Labs (my choice)"}}))
    run(migrate_rebrand_synferrous())
    assert client.get("/api/settings").json()["footer_legal"] == "© RK AI Labs (my choice)"


def test_people_and_records_are_never_rewritten(client, admin):
    """Users, leads and the audit log are records, not marketing copy."""
    client.post("/api/leads", json={
        "name": "Lead", "email": "lead@example.com", "consent": True,
        "message": "Saw RK AI Labs on LinkedIn", "form_started_at": 0,
    })
    _simulate_live_database()
    run(migrate_rebrand_synferrous())
    lead = run(dbm.db.leads.find_one({"email": "lead@example.com"}))
    assert lead["message"] == "Saw RK AI Labs on LinkedIn"


def test_old_brand_does_not_creep_back_into_the_codebase():
    """Guard: fails if 'RK AI Labs' or the old domain reappears in shipped code.
    Skips cleanly when run from a backend-only checkout."""
    repo = Path(__file__).resolve().parents[2]
    targets = [repo / "frontend" / "src", repo / "frontend" / "public", repo / "backend"]
    if not (repo / "frontend" / "src").exists():
        import pytest
        pytest.skip("frontend not present in this checkout")
    offenders = []
    for root in targets:
        for path in root.rglob("*"):
            if not path.is_file() or path.suffix not in {".py", ".js", ".jsx", ".html", ".txt", ".md", ".json", ".svg"}:
                continue
            parts = set(path.parts)
            if parts & {"node_modules", "venv", "build", "__pycache__", "tests"}:
                continue
            text = path.read_text(encoding="utf-8", errors="ignore")
            # The migration itself must name the old brand to replace it.
            if path.name == "seed.py":
                text = re.sub(r"REBRAND_REPLACEMENTS = \[.*?\]", "", text, flags=re.S)
            if OLD.search(text):
                offenders.append(str(path.relative_to(repo)))
    assert not offenders, f"old brand found in: {offenders}"
