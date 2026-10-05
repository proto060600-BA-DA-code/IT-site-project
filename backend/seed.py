"""Seed default admin user + sample CMS data (idempotent)."""
import os
from pathlib import Path
from db import db
from models import User, Banner, Category, Service, Page, now_iso
from auth import hash_password


# About page copy lives in content/about.md so it can be reviewed and edited
# as plain text rather than inside a Python string.
ABOUT_PAGE = {
    "title": "About Rohan Kapoor",
    "meta_description": (
        "Rohan Kapoor, techno-functional business analyst: Salesforce Commerce Cloud "
        "and order management for enterprise brands, and end-to-end e-commerce launches."
    ),
    "content": (Path(__file__).parent / "content" / "about.md").read_text(encoding="utf-8"),
}

# The original seeded About page carried visible "[PLACEHOLDER …]" notes.
PLACEHOLDER_MARKER = "[PLACEHOLDER — replace with your real story"


async def upgrade_placeholder_about():
    """Swap in the real About page — but only if the page is still the
    untouched placeholder. Anything edited in the admin is never overwritten."""
    doc = await db.pages.find_one({"slug": "about"}, {"_id": 0, "content": 1})
    if doc and PLACEHOLDER_MARKER in (doc.get("content") or ""):
        await db.pages.update_one(
            {"slug": "about"},
            {"$set": {**ABOUT_PAGE, "updated_at": now_iso()}},
        )


async def seed_catalogue():
    """Insert any catalogue category or service that doesn't exist yet.
    Never modifies existing records — admin edits are left alone."""
    from content.catalogue import CATEGORIES, SERVICES

    cat_ids = {}
    for c in CATEGORIES:
        existing = await db.categories.find_one({"slug": c["slug"]}, {"_id": 0, "id": 1})
        if existing:
            cat_ids[c["slug"]] = existing["id"]
            continue
        cat = Category(**c)
        await db.categories.insert_one(cat.model_dump())
        cat_ids[c["slug"]] = cat.id

    for s in SERVICES:
        if await db.services.find_one({"slug": s["slug"]}):
            continue
        data = {k: v for k, v in s.items() if k != "category"}
        data["category_id"] = cat_ids[s["category"]]
        await db.services.insert_one(Service(**data).model_dump())
    return cat_ids


# The original placeholder price for this slug — if it's still there, the
# service was never edited and is safe to replace with the researched version.
_LEGACY_DISCOVERY_PRICE = "From ₹1,50,000"


async def migrate_catalogue_v2():
    """One-time switch from the placeholder catalogue to the researched one.

    Retires (deactivates — never deletes) the old placeholder services and
    categories, and refreshes the one slug both catalogues share if it's still
    unedited. Recorded in db.migrations so it never runs twice: re-enabling an
    old service in the admin afterwards sticks.
    """
    from content.catalogue import (
        SERVICES, LEGACY_SERVICE_SLUGS, LEGACY_CATEGORY_SLUGS,
    )

    if await db.migrations.find_one({"id": "catalogue_v2"}):
        return

    cat_ids = await seed_catalogue()

    await db.services.update_many(
        {"slug": {"$in": LEGACY_SERVICE_SLUGS}},
        {"$set": {"active": False, "featured": False, "updated_at": now_iso()}},
    )
    await db.categories.update_many(
        {"slug": {"$in": LEGACY_CATEGORY_SLUGS}},
        {"$set": {"active": False, "updated_at": now_iso()}},
    )

    for s in SERVICES:
        doc = await db.services.find_one({"slug": s["slug"]}, {"_id": 0, "price_label": 1})
        if doc and doc.get("price_label") == _LEGACY_DISCOVERY_PRICE:
            data = {k: v for k, v in s.items() if k != "category"}
            data.update(category_id=cat_ids[s["category"]], active=True, updated_at=now_iso())
            await db.services.update_one({"slug": s["slug"]}, {"$set": data})

    await db.migrations.insert_one({"id": "catalogue_v2", "at": now_iso()})


# ── Rebrand to Synferrous (Oct 2026) ────────────────────────────────────────
# Ordered: the more specific phrases must be replaced before the bare name.
CONTACT_EMAIL = "info@synferrous.com"   # the one mailbox that exists for now

REBRAND_REPLACEMENTS = [
    ("RK AI Labs Team", "Rohan Kapoor"),   # no team — a named author is more credible
    ("RK AI Labs", "Synferrous"),
    # Every old address goes to the single real mailbox, not to look-alike
    # addresses on the new domain that nobody receives.
    ("hello@iamrohankapoor.com", CONTACT_EMAIL),
    ("privacy@iamrohankapoor.com", CONTACT_EMAIL),
    ("legal@iamrohankapoor.com", CONTACT_EMAIL),
    ("security@iamrohankapoor.com", CONTACT_EMAIL),
    ("iamrohankapoor.com", "synferrous.com"),
]

# For databases where the rebrand already ran with hello@/privacy@/… addresses.
CONTACT_EMAIL_REPLACEMENTS = [
    (f"{box}@synferrous.com", CONTACT_EMAIL) for box in ("hello", "privacy", "legal", "security")
]
# Seeded values that made claims the business can't evidence. Replaced only
# when a field still holds exactly the seeded text — an edit is left alone.
REBRAND_EXACT = {
    "From requirements to shipped AI products — led by senior analysts who build, not just advise.":
        "Requirements, e-commerce builds and practical AI — scoped and delivered by the same person, from first conversation to launch.",
    "What we do": "Services",
}
# Content only. Users, leads, chat, audit log and media are never rewritten.
REBRAND_COLLECTIONS = ["settings", "pages", "layouts", "posts", "services", "categories", "banners"]
_REBRAND_SKIP_KEYS = {"_id", "id", "slug"}


def _rewrite(value, replacements, exact=None):
    if isinstance(value, str):
        if exact and value in exact:
            return exact[value]
        for old, new in replacements:
            value = value.replace(old, new)
        return value
    if isinstance(value, list):
        return [_rewrite(v, replacements, exact) for v in value]
    if isinstance(value, dict):
        return {k: (v if k in _REBRAND_SKIP_KEYS else _rewrite(v, replacements, exact)) for k, v in value.items()}
    return value


def rebrand_value(value):
    return _rewrite(value, REBRAND_REPLACEMENTS, REBRAND_EXACT)


async def _rewrite_content_once(migration_id, replacements, exact=None):
    """Apply text replacements across content collections, exactly once.
    Recorded in db.migrations, so anything an admin changes afterwards is
    left alone."""
    if await db.migrations.find_one({"id": migration_id}):
        return
    changed = 0
    for coll in REBRAND_COLLECTIONS:
        async for doc in db[coll].find({}, {"_id": 0}):
            if "id" not in doc:
                continue
            updates = {
                k: new for k, v in doc.items()
                if k not in _REBRAND_SKIP_KEYS and (new := _rewrite(v, replacements, exact)) != v
            }
            if updates:
                updates["updated_at"] = now_iso()
                await db[coll].update_one({"id": doc["id"]}, {"$set": updates})
                changed += 1
    await db.migrations.insert_one({"id": migration_id, "at": now_iso(), "documents": changed})


async def migrate_rebrand_synferrous():
    """One-time rewrite of the old brand, domain and emails in stored content."""
    await _rewrite_content_once("rebrand_synferrous", REBRAND_REPLACEMENTS, REBRAND_EXACT)


async def migrate_contact_email_info():
    """One-time switch of any hello@/privacy@/legal@/security@synferrous.com
    already stored to the single real mailbox, info@synferrous.com."""
    await _rewrite_content_once("contact_email_info", CONTACT_EMAIL_REPLACEMENTS)


async def seed_admin():
    email = os.environ["ADMIN_EMAIL"].lower()
    password = os.environ["ADMIN_PASSWORD"]
    existing = await db.users.find_one({"email": email})
    if existing:
        # make sure role is admin
        if existing.get("role") != "admin":
            await db.users.update_one({"email": email}, {"$set": {"role": "admin"}})
        return
    admin = User(
        email=email,
        name="Synferrous Admin",
        password_hash=hash_password(password),
        role="admin",
    )
    await db.users.insert_one(admin.model_dump())


async def seed_content():
    # POSTS (Insights)
    posts_seed = [
        {
            "slug": "what-a-business-analyst-actually-does-on-an-ai-project",
            "title": "What a Business Analyst actually does on an AI project",
            "excerpt": "AI projects fail for the same reason most IT projects fail: fuzzy problems, unclear success criteria and no owner for the trade-offs. Here is where a senior BA earns their keep.",
            "cover_image": "https://images.unsplash.com/photo-1552664730-d307ca884978",
            "author": "Rohan Kapoor",
            "tags": ["Business Analysis", "AI", "Delivery"],
            "meta_description": "How a senior Business Analyst de-risks an AI product build, from problem framing to acceptance criteria.",
            "status": "published",
            "read_time_min": 6,
            "body": """## The TL;DR

The hardest part of an AI project is rarely the model. It is deciding **which problem is worth solving**, **what 'good' looks like**, and **who owns the trade-offs** when the model is 85% accurate instead of 100%.

That is Business Analysis work — and on AI projects it matters more, not less.

## Where a BA earns their keep

- **Problem framing.** Translating "we want to use AI" into a specific, measurable job-to-be-done with a baseline to beat.
- **Data reality check.** Mapping what data actually exists, where it lives, and whether it is clean enough to build on — before a single prompt is written.
- **Acceptance criteria for probabilistic systems.** Classic pass/fail criteria break when outputs are non-deterministic. We define thresholds, human-in-the-loop checkpoints and fallback behaviour.
- **Scope discipline.** Cutting a six-month wishlist down to a six-week MVP that proves the value.

## What good looks like

One crisp problem statement. A baseline metric. A short list of acceptance criteria a non-technical stakeholder can read. A decision log that captures every trade-off and who signed off.

Get those four artifacts right and the build is the easy part.
""",
        },
        {
            "slug": "from-prd-to-prototype-shipping-an-ai-mvp-in-six-weeks",
            "title": "From PRD to prototype: shipping an AI MVP in six weeks",
            "excerpt": "A repeatable six-week cadence for taking an AI product idea from problem statement to a working prototype real users can try.",
            "cover_image": "https://images.unsplash.com/photo-1556761175-5973dc0f32e7",
            "author": "Rohan Kapoor",
            "tags": ["AI Product", "MVP", "Delivery"],
            "meta_description": "A defensible six-week cadence for building an AI MVP, from discovery to a usable prototype.",
            "status": "published",
            "read_time_min": 8,
            "body": """## Why six weeks

Long enough to build something real, short enough that nobody loses interest or over-engineers. The constraint forces honest scoping.

## The cadence we run

1. **Week 1 — Discovery & framing.** Problem statement, success metric, data audit, and a one-page solution sketch signed off by the sponsor.
2. **Week 2 — Spec & spike.** Functional requirements, a thin technical spike to de-risk the riskiest assumption (usually data or model behaviour).
3. **Weeks 3–4 — Build the happy path.** A working end-to-end flow over real data. Ugly UI is fine; the loop must be real.
4. **Week 5 — Harden & evaluate.** Add evaluation, guardrails, and human-in-the-loop where the model is weak. Measure against the Week 1 baseline.
5. **Week 6 — Pilot & decide.** Put it in front of 5–10 real users. Gather evidence. Make a go / iterate / stop call with data, not opinions.

## What kills it

- No baseline, so you can never prove the AI is better than what existed.
- Building the polished product before proving the loop works.
- Treating "the demo worked once" as evidence. It is not.

Keep the scope brutal, instrument everything, and let the pilot decide.
""",
        },
        {
            "slug": "the-fractional-ba-playbook",
            "title": "The fractional BA playbook: what good looks like at 20 hours a week",
            "excerpt": "A senior Business Analyst, fractional, is one of the highest-leverage additions a digital or AI team can make. Here is how to set the engagement up to actually ship.",
            "cover_image": "https://images.unsplash.com/photo-1542744173-8e7e53415bb0",
            "author": "Rohan Kapoor",
            "tags": ["Business Analysis", "Operations"],
            "meta_description": "How to structure a fractional Business Analyst engagement that ships.",
            "status": "published",
            "read_time_min": 5,
            "body": """## Why fractional

You almost never need a full-time senior BA for a single initiative. You need their judgment during discovery, vendor and tooling selection, the first few sprints, and around critical milestones.

## What good looks like

- **Two rituals per week:** backlog grooming + a steering review with the sponsor.
- **One artifact per sprint:** a decision memo capturing every architectural and product call and the trade-offs behind it.
- **One stakeholder map:** refreshed monthly — who blocks what, and who needs to be in the room.

## What kills it

Treating the fractional BA as a part-time project manager. They are not. They are a senior outside brain whose job is to challenge your assumptions, write them down, and make sure the team ships against them.
""",
        },
    ]
    for p in posts_seed:
        if not await db.posts.find_one({"slug": p["slug"]}):
            from routes_insights import Post  # local import to avoid cycle
            doc = Post(**p).model_dump()
            doc["published_at"] = now_iso()
            await db.posts.insert_one(doc)

    # CATEGORIES + SERVICES — from content/catalogue.py (see seed_catalogue).
    await seed_catalogue()

    # BANNERS
    banners_seed = [
        {"title": "Business analysis meets AI product building.",
         "subtitle": "From requirements to shipped AI products — led by senior analysts who build, not just advise.",
         "image_url": "https://images.pexels.com/photos/37320179/pexels-photo-37320179.jpeg",
         "cta_label": "Book a Consultation", "cta_link": "/contact", "order": 1},
        {"title": "From idea to AI MVP in weeks, not quarters.",
         "subtitle": "We scope it, spec it and build it — with measurable outcomes and a clear go/iterate decision.",
         "image_url": "https://images.unsplash.com/photo-1542744173-8e7e53415bb0",
         "cta_label": "See Services", "cta_link": "/services", "order": 2},
    ]
    for b in banners_seed:
        if not await db.banners.find_one({"title": b["title"]}):
            await db.banners.insert_one(Banner(**b).model_dump())

    # PAGES (about / privacy / terms)
    pages_seed = [
        {"slug": "about", **ABOUT_PAGE},
        {"slug": "privacy",
         "title": "Privacy Policy",
         "meta_description": "How Synferrous handles your data.",
         "content": """**Effective date:** January 1, 2026

> **[PLACEHOLDER — have this reviewed by a qualified legal advisor before publishing.]**

Synferrous ("we", "us") respects your privacy. This policy explains what data we collect via synferrous.com (the "Site") and how we use it.

## 1. Information we collect
- **Contact data** you provide via forms: name, email, phone, company, message.
- **Usage data**: anonymous analytics (pages viewed, referrer, device class) collected via privacy-friendly analytics.
- **Chat data**: when you use our AI assistant Aria, the conversation is stored against an anonymous session ID for quality and continuity.

## 2. How we use it
- Respond to your inquiry and qualify it as a sales lead.
- Improve the Site, the assistant and our service offerings.
- Send occasional updates (only if you opt in).

## 3. Sharing
We do **not** sell your data. We share it only with:
- Our LLM provider, strictly to power the AI assistant.
- Email delivery providers, strictly to reply to you.
- Authorities if required by law.

## 4. Retention
Leads are kept for 36 months; chat transcripts for 12 months; you may request deletion at any time at info@synferrous.com.

## 5. Your rights
Subject to applicable law, you may request access, correction, deletion and portability of your data. Email info@synferrous.com.

## 6. Cookies
We use a minimal session cookie for authentication. No third-party advertising cookies.

## 7. Contact
Synferrous, Delhi NCR, India — info@synferrous.com
"""},
        {"slug": "terms",
         "title": "Terms & Conditions",
         "meta_description": "Terms of use for the Synferrous website.",
         "content": """**Last updated:** January 1, 2026

> **[PLACEHOLDER — have this reviewed by a qualified legal advisor before publishing.]**

By accessing synferrous.com (the "Site") you agree to these Terms.

## 1. Use of the Site
You may use the Site for lawful informational purposes only. You may not scrape, reverse-engineer or attempt to disrupt the Site or our AI assistant.

## 2. No professional advice
Content on this Site, including responses from our AI assistant Aria, is provided for general informational purposes and does not constitute professional consulting advice. Engagement letters and signed statements of work govern any actual consulting work.

## 3. Intellectual property
All trademarks, logos, copy, designs and code on the Site are owned by Synferrous or our licensors. You may not reproduce them without written permission.

## 4. AI assistant disclaimer
The AI assistant ("Aria") may generate inaccurate or out-of-date information. Do not rely on it for binding decisions. Pricing displayed by Aria is indicative; final pricing is confirmed in writing.

## 5. Accounts
You are responsible for safeguarding your account credentials. Notify us immediately at info@synferrous.com of any unauthorized use.

## 6. Limitation of liability
To the maximum extent permitted by law, Synferrous is not liable for indirect, incidental or consequential damages arising from your use of the Site.

## 7. Governing law
These Terms are governed by the laws of India. Disputes will be subject to the exclusive jurisdiction of the courts of Delhi, India.

## 8. Changes
We may update these Terms. The "Last updated" date at the top reflects the latest revision.

## 9. Contact
info@synferrous.com
"""},
    ]
    for p in pages_seed:
        if not await db.pages.find_one({"slug": p["slug"]}):
            await db.pages.insert_one(Page(**p).model_dump())


async def run_all():
    from routes_rbac import seed_roles, attach_legacy_admins
    from routes_layouts import seed_layouts
    from routes_settings import seed_settings

    # Order matters: roles must exist before they can be attached, and the
    # admin user must exist before it can receive one.
    await seed_roles()
    await seed_admin()
    await attach_legacy_admins()
    await seed_content()
    await migrate_catalogue_v2()
    await upgrade_placeholder_about()
    await seed_layouts()
    await seed_settings()
    # Last, so they see every seeded or pre-existing document.
    await migrate_rebrand_synferrous()
    await migrate_contact_email_info()
