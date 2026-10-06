"""Legal pages (DPDP privacy notice, terms, disclaimer) and the marketing strip."""
import asyncio
import re

import db as dbm
from seed import LEGAL_PAGES, LEGAL_PLACEHOLDER_MARKER, migrate_legal_pages, migrate_launch_strip


def run(coro):
    return asyncio.run(coro)


# ── Legal pages ─────────────────────────────────────────────────────────────
def test_fresh_install_serves_real_legal_pages(client):
    for slug in ("privacy", "terms", "disclaimer"):
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


def test_disclaimer_is_in_the_sitemap(client):
    assert "/disclaimer</loc>" in client.get("/api/sitemap.xml").text


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
