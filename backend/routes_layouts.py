"""Page builder — dynamic zones.

A layout is an ordered list of block instances for one page. Each block has a
`type` (resolved to a React component by the frontend block registry) and its
own `props`. Reorder, add, duplicate, hide and delete are all just edits to
that list, so the whole builder is a single save.
"""
from fastapi import APIRouter, HTTPException
from typing import List

from db import db
from models import PageLayout, PageLayoutIn, Block, now_iso

router = APIRouter(tags=["layouts"])

# Pages that can be composed. The frontend renders `blocks` in order and falls
# back to its hardcoded layout when a page has no saved layout.
BUILDABLE_PAGES = ["home", "about", "services", "insights", "contact"]

# Block catalogue. `fields` drives the inline prop editor in the admin UI —
# adding a block type here makes it available in the builder immediately.
BLOCK_TYPES = [
    {
        "type": "hero",
        "label": "Hero",
        "description": "Full-dark band, headline, sub, two CTAs, image on the right.",
        "singleton": True,
        "fields": [
            {"key": "eyebrow", "label": "Eyebrow", "type": "text"},
            {"key": "title", "label": "Headline", "type": "textarea", "rows": 2},
            {"key": "subtitle", "label": "Sub-headline", "type": "textarea", "rows": 2},
            {"key": "image_url", "label": "Background image", "type": "image"},
            {"key": "cta_label", "label": "Primary CTA label", "type": "text"},
            {"key": "cta_link", "label": "Primary CTA link", "type": "text"},
            {"key": "secondary_label", "label": "Secondary CTA label", "type": "text"},
            {"key": "secondary_link", "label": "Secondary CTA link", "type": "text"},
            {"key": "show_stats", "label": "Show the stats card", "type": "boolean"},
        ],
    },
    {
        "type": "trusted_by",
        "label": "Trusted by",
        "description": "Dark band of client logos. Hides itself when no clients exist.",
        "singleton": True,
        "fields": [{"key": "label", "label": "Label", "type": "text"}],
    },
    {
        "type": "capabilities",
        "label": "What we do",
        "description": "Centered header plus four columns split by hairline rules.",
        "singleton": False,
        "fields": [
            {"key": "eyebrow", "label": "Eyebrow", "type": "text"},
            {"key": "title", "label": "Headline", "type": "text"},
            {"key": "items", "label": "Columns", "type": "repeater",
             "item_fields": [
                 {"key": "icon", "label": "Icon", "type": "icon"},
                 {"key": "title", "label": "Title", "type": "text"},
                 {"key": "body", "label": "Description", "type": "textarea", "rows": 3},
             ]},
        ],
    },
    {
        "type": "banner",
        "label": "Call-out banner",
        "description": "Coloured strip with a headline and one CTA.",
        "singleton": False,
        "fields": [
            {"key": "eyebrow", "label": "Eyebrow", "type": "text"},
            {"key": "title", "label": "Headline", "type": "text"},
            {"key": "subtitle", "label": "Sub", "type": "textarea", "rows": 2},
            {"key": "cta_label", "label": "CTA label", "type": "text"},
            {"key": "cta_link", "label": "CTA link", "type": "text"},
        ],
    },
    {
        "type": "category_tree",
        "label": "Practice areas",
        "description": "Split header plus a hairline grid of categories from the CMS.",
        "singleton": False,
        "fields": [
            {"key": "eyebrow", "label": "Eyebrow", "type": "text"},
            {"key": "title", "label": "Headline", "type": "text"},
            {"key": "body", "label": "Intro", "type": "textarea", "rows": 3},
        ],
    },
    {
        "type": "services_carousel",
        "label": "Featured services",
        "description": "Horizontal row of featured services from the CMS.",
        "singleton": False,
        "fields": [
            {"key": "eyebrow", "label": "Eyebrow", "type": "text"},
            {"key": "title", "label": "Headline", "type": "text"},
        ],
    },
    {
        "type": "why_us",
        "label": "Why us (bento)",
        "description": "Bento grid of differentiators.",
        "singleton": False,
        "fields": [
            {"key": "eyebrow", "label": "Eyebrow", "type": "text"},
            {"key": "title", "label": "Headline", "type": "text"},
            {"key": "items", "label": "Cards", "type": "repeater",
             "item_fields": [
                 {"key": "title", "label": "Title", "type": "text"},
                 {"key": "body", "label": "Body", "type": "textarea", "rows": 3},
             ]},
        ],
    },
    {
        "type": "lead_form",
        "label": "Lead capture",
        "description": "Copy on the left, contact form on the right.",
        "singleton": True,
        "fields": [
            {"key": "eyebrow", "label": "Eyebrow", "type": "text"},
            {"key": "title", "label": "Headline", "type": "text"},
            {"key": "body", "label": "Body", "type": "textarea", "rows": 3},
            {"key": "bullets", "label": "Reassurance bullets", "type": "array"},
        ],
    },
    {
        "type": "rich_text",
        "label": "Rich text",
        "description": "A free-form markdown block.",
        "singleton": False,
        "fields": [
            {"key": "title", "label": "Headline", "type": "text"},
            {"key": "body", "label": "Markdown", "type": "textarea", "rows": 10},
            {"key": "centered", "label": "Centre the text", "type": "boolean"},
        ],
    },
    {
        "type": "spacer",
        "label": "Spacer / divider",
        "description": "Vertical breathing room, optionally with a hairline.",
        "singleton": False,
        "fields": [
            {"key": "size", "label": "Size", "type": "select",
             "options": ["small", "medium", "large"]},
            {"key": "rule", "label": "Show a hairline", "type": "boolean"},
        ],
    },
]


@router.get("/layouts/block-types")
async def block_types():
    return {"pages": BUILDABLE_PAGES, "blocks": BLOCK_TYPES}


@router.get("/layouts", response_model=List[PageLayout])
async def list_layouts():
    docs = await db.layouts.find({}, {"_id": 0}).to_list(100)
    return [PageLayout(**d) for d in docs]


@router.get("/layouts/{page}", response_model=PageLayout)
async def get_layout(page: str):
    doc = await db.layouts.find_one({"page": page}, {"_id": 0})
    if not doc:
        # Not an error — an unbuilt page just has no blocks yet, and the
        # frontend falls back to its hardcoded layout.
        return PageLayout(page=page, blocks=[])
    return PageLayout(**doc)


@router.put("/layouts/{page}", response_model=PageLayout)
async def save_layout(page: str, payload: PageLayoutIn):
    if page not in BUILDABLE_PAGES:
        raise HTTPException(status_code=400, detail=f"'{page}' is not a buildable page")

    known = {b["type"] for b in BLOCK_TYPES}
    for b in payload.blocks:
        if b.type not in known:
            raise HTTPException(status_code=400, detail=f"Unknown block type '{b.type}'")

    doc = await db.layouts.find_one({"page": page}, {"_id": 0})
    blocks = [b.model_dump() for b in payload.blocks]

    if doc:
        res = await db.layouts.find_one_and_update(
            {"page": page},
            {"$set": {"blocks": blocks, "published": payload.published,
                      "updated_at": now_iso()}},
            return_document=True, projection={"_id": 0},
        )
        return PageLayout(**res)

    layout = PageLayout(page=page, blocks=payload.blocks, published=payload.published)
    await db.layouts.insert_one(layout.model_dump())
    return layout


@router.delete("/layouts/{page}")
async def reset_layout(page: str):
    """Drop the saved layout so the page reverts to its hardcoded default."""
    await db.layouts.delete_one({"page": page})
    return {"ok": True}


def default_home_blocks() -> List[Block]:
    """Mirrors the current hardcoded homepage, so the first time someone opens
    the builder they see the real page rather than an empty canvas."""
    return [
        Block(type="hero", props={
            "eyebrow": "IT Business Analysis · AI Product Building · Delhi NCR",
            "show_stats": True,
        }),
        Block(type="trusted_by", props={"label": "Trusted by ambitious organizations"}),
        Block(type="capabilities", props={
            "eyebrow": "What we do",
            "title": "Analysis that drives meaningful change.",
            "items": [
                {"icon": "Compass", "title": "Strategy",
                 "body": "Frame the real problem before anyone writes code."},
                {"icon": "ChartLineUp", "title": "Transformation",
                 "body": "Turn strategy into a shippable backlog."},
                {"icon": "Cpu", "title": "AI Products",
                 "body": "LLM features and automations that reach production."},
                {"icon": "ShieldCheck", "title": "Governance",
                 "body": "Evaluation harnesses, guardrails and documentation."},
            ],
        }),
        Block(type="category_tree", props={
            "eyebrow": "Practice areas", "title": "How we engage.",
        }),
        Block(type="services_carousel", props={
            "eyebrow": "Featured services", "title": "Where we start.",
        }),
        Block(type="why_us", props={"eyebrow": "Why RK AI Labs"}),
        Block(type="lead_form", props={
            "eyebrow": "Start a conversation",
            "title": "Bring us your hardest problem.",
        }),
    ]


async def seed_layouts():
    """Seed the home layout once, from the current hardcoded page."""
    if not await db.layouts.find_one({"page": "home"}):
        await db.layouts.insert_one(
            PageLayout(page="home", blocks=default_home_blocks()).model_dump()
        )
