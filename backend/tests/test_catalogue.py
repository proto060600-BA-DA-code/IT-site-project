"""Service catalogue: content rules, and the one-time migration off the
placeholder catalogue that production still has."""
import asyncio
import re

import db as dbm
from content.catalogue import (
    CATEGORIES, SERVICES, PRICING_NOTE, LEGACY_SERVICE_SLUGS, LEGACY_CATEGORY_SLUGS,
)
from models import Category, Service
from seed import migrate_catalogue_v2


def run(coro):
    return asyncio.run(coro)


def public_slugs(client):
    return {s["slug"] for s in client.get("/api/services").json()}


# ── Content rules ───────────────────────────────────────────────────────────
def test_every_service_has_a_price_a_category_and_the_pricing_note():
    cats = {c["slug"] for c in CATEGORIES}
    for s in SERVICES:
        assert "₹" in s["price_label"], s["slug"]
        assert s["category"] in cats, s["slug"]
        assert PRICING_NOTE in s["long_description"], s["slug"]


def test_copy_makes_no_unevidenced_claims():
    """Site copy must match what Rohan can evidence (see CLAUDE.md): no
    seniority, team or years-of-experience claims."""
    text = " ".join(
        f"{s['name']} {s['short_description']} {s['long_description']}" for s in SERVICES
    ).lower()
    # Whole-word matches: "your team" must not trip the "our team" check.
    for phrase in ["senior", "our team", "years of experience", "industry-leading", "guarantee"]:
        assert not re.search(rf"\b{re.escape(phrase)}\b", text), f"catalogue copy contains '{phrase}'"


def test_short_descriptions_fit_a_card_and_a_search_snippet():
    for s in SERVICES:
        assert len(s["short_description"]) <= 155, s["slug"]


# ── Fresh install ───────────────────────────────────────────────────────────
def test_fresh_install_serves_exactly_the_new_catalogue(client):
    assert public_slugs(client) == {s["slug"] for s in SERVICES}
    cats = {c["slug"] for c in client.get("/api/categories").json()}
    assert cats == {c["slug"] for c in CATEGORIES}


def test_homepage_has_featured_services(client):
    featured = client.get("/api/services?featured=true").json()
    assert len(featured) >= 3


# ── Migrating production's placeholder catalogue ────────────────────────────
def _simulate_production(client):
    """Recreate what the live database holds: the old placeholder catalogue,
    with the migration never having run."""
    run(dbm.db.migrations.delete_many({}))
    run(dbm.db.services.delete_many({}))
    run(dbm.db.categories.delete_many({}))
    old_cat = Category(name="Business Analysis & Advisory", slug=LEGACY_CATEGORY_SLUGS[0])
    run(dbm.db.categories.insert_one(old_cat.model_dump()))
    for slug in LEGACY_SERVICE_SLUGS:
        run(dbm.db.services.insert_one(Service(
            name=slug, slug=slug, category_id=old_cat.id, featured=True,
            price_label="From ₹6,00,000").model_dump()))
    run(dbm.db.services.insert_one(Service(
        name="Requirements & Process Discovery", slug="requirements-process-discovery",
        category_id=old_cat.id, price_label="From ₹1,50,000").model_dump()))


def test_migration_retires_the_placeholders_and_publishes_the_new_catalogue(client):
    _simulate_production(client)
    run(migrate_catalogue_v2())

    assert public_slugs(client) == {s["slug"] for s in SERVICES}
    # Retired, not deleted — still there for the admin to restore.
    for slug in LEGACY_SERVICE_SLUGS:
        doc = run(dbm.db.services.find_one({"slug": slug}))
        assert doc is not None and doc["active"] is False and doc["featured"] is False

    discovery = client.get("/api/services/requirements-process-discovery").json()
    assert discovery["price_label"] == "From ₹45,000"


def test_migration_runs_only_once_so_restoring_a_service_sticks(client):
    _simulate_production(client)
    run(migrate_catalogue_v2())
    run(dbm.db.services.update_one({"slug": LEGACY_SERVICE_SLUGS[0]}, {"$set": {"active": True}}))
    run(migrate_catalogue_v2())
    assert LEGACY_SERVICE_SLUGS[0] in public_slugs(client)


def test_migration_never_overwrites_a_service_edited_in_the_admin(client):
    _simulate_production(client)
    run(dbm.db.services.update_one({"slug": "requirements-process-discovery"},
                                   {"$set": {"price_label": "From ₹99,000"}}))
    run(migrate_catalogue_v2())
    doc = run(dbm.db.services.find_one({"slug": "requirements-process-discovery"}))
    assert doc["price_label"] == "From ₹99,000"


def test_retired_services_drop_out_of_the_sitemap(client):
    _simulate_production(client)
    run(migrate_catalogue_v2())
    xml = client.get("/api/sitemap.xml").text
    for slug in LEGACY_SERVICE_SLUGS:
        assert f"/services/{slug}<" not in xml
    for s in SERVICES:
        assert re.search(rf"/services/{re.escape(s['slug'])}<", xml), s["slug"]
