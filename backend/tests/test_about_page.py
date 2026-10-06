"""About page content and its one-time upgrade from the old placeholder."""
import asyncio
import re

import db as dbm
from seed import ABOUT_PAGE, PLACEHOLDER_MARKER, upgrade_placeholder_about


def run(coro):
    return asyncio.run(coro)


def test_fresh_install_serves_the_real_about_page(client):
    page = client.get("/api/pages/about").json()
    assert page["title"] == "About Rohan Kapoor"
    assert "PLACEHOLDER" not in page["content"]
    assert "Rohan Kapoor" in page["content"]


def test_untouched_placeholder_is_upgraded(client):
    run(dbm.db.pages.update_one({"slug": "about"},
        {"$set": {"content": f"> **{PLACEHOLDER_MARKER}, founder bio.]**\n\nold copy"}}))
    run(upgrade_placeholder_about())
    page = client.get("/api/pages/about").json()
    assert page["content"] == ABOUT_PAGE["content"]


def test_admin_edits_are_never_overwritten(client):
    run(dbm.db.pages.update_one({"slug": "about"}, {"$set": {"content": "My own words."}}))
    run(upgrade_placeholder_about())
    assert client.get("/api/pages/about").json()["content"] == "My own words."


def test_meta_description_fits_googles_snippet(client):
    assert len(ABOUT_PAGE["meta_description"]) <= 155


def test_content_uses_only_markdown_the_site_can_render():
    """The CMS renderer supports headings, lists, bold, italics, code and
    [links](/path) — not tables, blockquotes or images. Those would show up as
    raw symbols."""
    body = ABOUT_PAGE["content"]
    assert not re.search(r"^\s*>", body, re.M), "blockquotes aren't rendered"
    assert not re.search(r"^\s*\|", body, re.M), "tables aren't rendered"
    assert "![" not in body, "images aren't rendered"
