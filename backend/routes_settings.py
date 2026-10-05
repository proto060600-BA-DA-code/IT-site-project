"""Site settings — a single-type store for every string that lives outside a
page block: the header strip, logo text, footer copy and contact details.

`SETTINGS_SCHEMA` drives both the seed and the admin editor, so adding a field
here is the only change needed to make a new string editable.
"""
from fastapi import APIRouter
from db import db
from models import now_iso

router = APIRouter(tags=["settings"])

SETTINGS_SCHEMA = [
    {
        "group": "Announcement bar",
        "fields": [
            {"key": "announcement_enabled", "label": "Show the bar", "type": "boolean", "default": True},
            {"key": "announcement_left", "label": "Left text", "type": "text",
             "default": "Business Analysis • AI Solutions • Digital Transformation"},
            {"key": "announcement_right", "label": "Right text", "type": "text",
             "default": "Free Discovery Call Available"},
        ],
    },
    {
        "group": "Logo",
        "fields": [
            {"key": "logo_title", "label": "Wordmark", "type": "text", "default": "RK AI Labs"},
            {"key": "logo_subtitle", "label": "Wordmark subtitle", "type": "text",
             "default": "Business & AI Solutions"},
        ],
    },
    {
        "group": "Header",
        "fields": [
            {"key": "header_cta_label", "label": "CTA button label", "type": "text",
             "default": "Book a consultation →"},
            {"key": "header_cta_link", "label": "CTA link", "type": "text", "default": "/contact"},
        ],
    },
    {
        "group": "Footer",
        "fields": [
            {"key": "footer_description", "label": "Description", "type": "textarea", "rows": 3,
             "default": "IT Business Analysis solutions and AI product building. From requirements and process discovery to shipped AI products and automations."},
            {"key": "footer_links_heading", "label": "Links column heading", "type": "text", "default": "Quick Links"},
            {"key": "footer_contact_heading", "label": "Contact column heading", "type": "text", "default": "Contact Info"},
            {"key": "footer_legal", "label": "Copyright line", "type": "text",
             "default": "© 2026 RK AI Labs · All rights reserved"},
            {"key": "footer_locale", "label": "Locale line", "type": "text", "default": "Delhi NCR · India"},
        ],
    },
    {
        "group": "Contact details",
        "fields": [
            {"key": "brand_name", "label": "Business name", "type": "text", "default": "RK AI Labs"},
            {"key": "tagline", "label": "Tagline", "type": "text",
             "default": "AI • Software • Digital Transformation"},
            {"key": "phone", "label": "Phone", "type": "text", "default": "+91 98735 56197"},
            {"key": "email", "label": "Email", "type": "text", "default": "hello@iamrohankapoor.com"},
            {"key": "address", "label": "Address", "type": "text", "default": "Delhi NCR, India"},
            {"key": "founded", "label": "Founded line", "type": "text", "default": "Founded 2026 · India"},
            {"key": "linkedin", "label": "LinkedIn URL", "type": "text", "default": ""},
            {"key": "x", "label": "X / Twitter URL", "type": "text", "default": ""},
        ],
    },
    {
        "group": "Privacy & data protection",
        "fields": [
            {"key": "grievance_officer_name", "label": "Grievance officer name", "type": "text", "default": "",
             "help": "Required under the DPDP Act. Shown on the Privacy page. Left blank on purpose — "
                     "this must be a real, named person."},
            {"key": "grievance_officer_email", "label": "Grievance officer email", "type": "text", "default": "",
             "help": "Where people send data access, correction and erasure requests."},
            {"key": "consent_text", "label": "Consent wording on the enquiry form", "type": "textarea", "rows": 2,
             "default": "I agree to RK AI Labs using these details to respond to my enquiry, as described in the Privacy Policy.",
             "help": "Stored verbatim with every enquiry, so you can later show exactly what each person agreed to."},
            {"key": "lead_retention_days", "label": "Delete enquiries after (days)", "type": "number", "default": 730,
             "help": "Enquiries and chat transcripts older than this are deleted automatically each day. 0 keeps them forever."},
            {"key": "spam_retention_days", "label": "Delete spam after (days)", "type": "number", "default": 30,
             "help": "Flagged spam is kept briefly so false positives can be released, then deleted."},
            {"key": "audit_retention_days", "label": "Keep audit log for (days)", "type": "number", "default": 730,
             "help": "Audit entries hold admin IP addresses, so they shouldn't be kept indefinitely either."},
        ],
    },
]

DOC_ID = "site"


def defaults() -> dict:
    out = {}
    for g in SETTINGS_SCHEMA:
        for f in g["fields"]:
            out[f["key"]] = f.get("default", "")
    return out


async def get_settings() -> dict:
    doc = await db.settings.find_one({"id": DOC_ID}, {"_id": 0})
    # Merge over defaults so a newly added field appears immediately rather
    # than rendering blank until someone re-saves.
    return {**defaults(), **(doc or {})}


@router.get("/settings/schema")
async def settings_schema():
    return {"groups": SETTINGS_SCHEMA}


@router.get("/settings")
async def admin_read_settings():
    return await get_settings()


def _field_types() -> dict:
    return {f["key"]: f["type"] for g in SETTINGS_SCHEMA for f in g["fields"]}


@router.put("/settings")
async def admin_save_settings(payload: dict):
    from fastapi import HTTPException

    types = _field_types()
    clean = {}
    for k, v in (payload or {}).items():
        if k not in types:
            continue
        if types[k] == "number":
            # Coerce here so the retention job never has to guess at "30" vs 30.
            try:
                v = int(v)
            except (TypeError, ValueError):
                raise HTTPException(status_code=400, detail=f"'{k}' must be a whole number")
            if v < 0:
                raise HTTPException(status_code=400, detail=f"'{k}' cannot be negative")
        elif types[k] == "boolean":
            v = bool(v)
        clean[k] = v
    clean["id"] = DOC_ID
    clean["updated_at"] = now_iso()
    await db.settings.update_one({"id": DOC_ID}, {"$set": clean}, upsert=True)
    return await get_settings()


async def seed_settings():
    if not await db.settings.find_one({"id": DOC_ID}):
        await db.settings.insert_one({**defaults(), "id": DOC_ID, "updated_at": now_iso()})
