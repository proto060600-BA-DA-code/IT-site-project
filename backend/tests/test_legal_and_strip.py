"""Legal pages (DPDP privacy notice, terms, disclaimer) and the marketing strip."""
import asyncio
import re
from pathlib import Path

import db as dbm
from seed import LEGAL_PAGES, LEGAL_PLACEHOLDER_MARKER, migrate_legal_pages, migrate_launch_strip


def run(coro):
    return asyncio.run(coro)


# ── Legal pages ─────────────────────────────────────────────────────────────
def test_fresh_install_serves_real_legal_pages(client):
    for slug in ("privacy", "terms", "cookies", "disclaimer"):
        page = client.get(f"/api/pages/{slug}").json()
        assert "PLACEHOLDER" not in page["content"], slug
        assert page["content"] == LEGAL_PAGES[slug]["content"]


def test_untouched_placeholder_is_replaced_once(client):
    old = f"> **{LEGAL_PLACEHOLDER_MARKER} by a qualified legal advisor.]**\n\nold"
    run(dbm.db.pages.update_one({"slug": "terms"}, {"$set": {"content": old}}))
    run(dbm.db.migrations.delete_one({"id": "legal_pages_v2"}))
    run(migrate_legal_pages())
    assert client.get("/api/pages/terms").json()["content"] == LEGAL_PAGES["terms"]["content"]


def test_edited_legal_pages_are_never_overwritten(client):
    run(dbm.db.pages.update_one({"slug": "privacy"}, {"$set": {"content": "Lawyer-reviewed text."}}))
    run(dbm.db.migrations.delete_one({"id": "legal_pages_v2"}))
    run(migrate_legal_pages())
    assert client.get("/api/pages/privacy").json()["content"] == "Lawyer-reviewed text."


def test_privacy_notice_covers_what_the_dpdp_rules_ask_for():
    """Rule 3: itemised data, purpose, and how to withdraw consent, exercise
    rights and complain to the Board."""
    body = LEGAL_PAGES["privacy"]["content"].lower()
    for must in ("purpose", "withdraw consent", "erase", "correct", "nominate",
                 "data protection board", "eighth schedule", "{{email}}"):
        assert must in body, must


def test_retention_periods_come_from_settings_not_the_text():
    """Rule 1: one source of truth — the policy must not restate numbers the
    retention job reads from Site settings."""
    body = LEGAL_PAGES["privacy"]["content"]
    assert "{{lead_retention}}" in body and "{{spam_retention}}" in body
    retention_section = body.split("## 5.")[1].split("## 6.")[0]
    assert not re.search(r"\b\d+\s*(days|months|years)\b", retention_section)


def test_legal_pages_have_no_unrenderable_markdown_and_safe_links():
    for slug, page in LEGAL_PAGES.items():
        body = page["content"]
        assert not re.search(r"^\s*>", body, re.M), slug
        assert not re.search(r"^\s*\|", body, re.M), slug
        for url in re.findall(r"\]\(([^)]+)\)", body):
            assert re.match(r"(/|https://|mailto:)", url), (slug, url)
        assert len(page["meta_description"]) <= 155, slug


def test_legal_pages_are_in_the_sitemap(client):
    xml = client.get("/api/sitemap.xml").text
    for path in ("/privacy", "/terms", "/cookies", "/disclaimer"):
        assert f"{path}</loc>" in xml, path


# ── Cookie policy stays true to the code ───────────────────────────────────
FRONTEND_SRC = Path(__file__).resolve().parents[2] / "frontend" / "src"


def _frontend_code():
    for f in FRONTEND_SRC.rglob("*"):
        if f.suffix in (".js", ".jsx") and "testIds" not in f.parts:
            yield f, f.read_text(encoding="utf-8")


def test_frontend_sets_no_cookies():
    for f, code in _frontend_code():
        assert "document.cookie" not in code, f"{f} sets a cookie — update the Cookie Policy (and add consent)"


def test_every_browser_storage_key_is_disclosed():
    """A new localStorage key that isn't listed in the Cookie Policy fails here."""
    policy = LEGAL_PAGES["cookies"]["content"]
    keys = set()
    for _, code in _frontend_code():
        keys |= set(re.findall(r"(?:local|session)Storage\.(?:get|set|remove)Item\(\s*[\"']([\w:-]+)", code))
        keys |= set(re.findall(r"const \w*_KEY\s*=\s*[\"']([\w:-]+)[\"']", code))
    assert keys, "found no storage keys — has the scan broken?"
    missing = sorted(k for k in keys if f"`{k}`" not in policy)
    assert not missing, f"not in the Cookie Policy: {missing}"


def test_no_third_party_trackers_in_the_page_shell():
    shell = (FRONTEND_SRC.parent / "public" / "index.html").read_text(encoding="utf-8")
    for tracker in ("googletagmanager", "google-analytics", "gtag(", "fbq(", "hotjar", "clarity.ms"):
        assert tracker not in shell, f"{tracker} added — the Cookie Policy says there's no tracking"


# ── Marketing strip ─────────────────────────────────────────────────────────
def home_blocks(client):
    return client.get("/api/layouts/home").json()["blocks"]


def test_strip_is_a_builder_block(client, admin):
    types = client.get("/api/admin/layouts/block-types", headers=admin).json()["blocks"]
    strip = next(b for b in types if b["type"] == "marketing_strip")
    assert {"messages", "carousel"} <= {f["key"] for f in strip["fields"]}


def test_launch_strip_tops_the_home_page_with_carousel_on(client):
    first = home_blocks(client)[0]
    assert first["type"] == "marketing_strip"
    assert first["props"]["carousel"] is True
    assert "official launch" in first["props"]["messages"][0]


def test_removing_the_strip_sticks(client, admin):
    blocks = [b for b in home_blocks(client) if b["type"] != "marketing_strip"]
    r = client.put("/api/admin/layouts/home", headers=admin, json={"blocks": blocks})
    assert r.status_code == 200, r.text
    run(migrate_launch_strip())  # e.g. the next server restart
    assert all(b["type"] != "marketing_strip" for b in home_blocks(client))


def test_carousel_can_be_switched_off(client, admin):
    blocks = home_blocks(client)
    blocks[0]["props"]["carousel"] = False
    client.put("/api/admin/layouts/home", headers=admin, json={"blocks": blocks})
    assert home_blocks(client)[0]["props"]["carousel"] is False
