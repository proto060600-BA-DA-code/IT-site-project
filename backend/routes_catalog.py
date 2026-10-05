from fastapi import APIRouter, HTTPException, BackgroundTasks, Depends
from typing import List, Optional
from db import db
from models import Banner, Category, Client, Service, Page, Lead, LeadIn, now_iso
from email_service import send_lead_notification
from ratelimit import limit_by_ip
from spam import score_lead, SPAM_THRESHOLD

router = APIRouter(tags=["catalog"])


@router.get("/banners", response_model=List[Banner])
async def list_banners():
    docs = await db.banners.find({"active": True}, {"_id": 0}).sort("order", 1).to_list(100)
    return [Banner(**d) for d in docs]


@router.get("/settings")
async def public_settings():
    """Public read of site-wide copy — header strip, logo, footer, contact."""
    import os
    from routes_settings import get_settings
    s = await get_settings()
    # Lets the chat widget hide itself instead of showing a dead assistant.
    s["chat_enabled"] = bool(os.environ.get("ANTHROPIC_API_KEY"))
    return s


@router.get("/layouts/{page}")
async def public_layout(page: str):
    """Public read of a composed page layout.

    Returns only visible blocks. An empty list is the signal for the frontend
    to fall back to its hardcoded layout, so an unbuilt page still renders.
    """
    doc = await db.layouts.find_one({"page": page, "published": True}, {"_id": 0})
    if not doc:
        return {"page": page, "blocks": []}
    return {
        "page": page,
        "blocks": [b for b in (doc.get("blocks") or []) if b.get("visible", True)],
    }


@router.get("/clients", response_model=List[Client])
async def list_clients():
    """Public list for the 'Trusted by' band. Empty until real clients are added."""
    docs = await db.clients.find({"active": True}, {"_id": 0}).sort("order", 1).to_list(50)
    return [Client(**d) for d in docs]


@router.get("/categories", response_model=List[Category])
async def list_categories():
    docs = await db.categories.find({"active": True}, {"_id": 0}).sort("order", 1).to_list(500)
    return [Category(**d) for d in docs]


@router.get("/services", response_model=List[Service])
async def list_services(category_id: Optional[str] = None, featured: Optional[bool] = None):
    query = {"active": True}
    if category_id:
        query["category_id"] = category_id
    if featured is not None:
        query["featured"] = featured
    docs = await db.services.find(query, {"_id": 0}).to_list(500)
    return [Service(**d) for d in docs]


@router.get("/services/{slug}", response_model=Service)
async def get_service(slug: str):
    doc = await db.services.find_one({"slug": slug, "active": True}, {"_id": 0})
    if not doc:
        raise HTTPException(status_code=404, detail="Service not found")
    return Service(**doc)


@router.get("/categories/{slug}", response_model=Category)
async def get_category(slug: str):
    doc = await db.categories.find_one({"slug": slug, "active": True}, {"_id": 0})
    if not doc:
        raise HTTPException(status_code=404, detail="Category not found")
    return Category(**doc)


@router.get("/pages/{slug}", response_model=Page)
async def get_page(slug: str):
    doc = await db.pages.find_one({"slug": slug}, {"_id": 0})
    if not doc:
        raise HTTPException(status_code=404, detail="Page not found")
    return Page(**doc)


@router.post("/leads", dependencies=[Depends(limit_by_ip("leads", 5, 600))])
async def create_lead(payload: LeadIn, background: BackgroundTasks):
    # DPDP: processing needs the person's consent for a stated purpose. The
    # form makes this a required checkbox; enforce it here too, since the API
    # is public and can be called without the form.
    if not payload.consent:
        raise HTTPException(
            status_code=400,
            detail="Please confirm you agree to us using your details to respond to this enquiry.",
        )

    score, reasons = score_lead(payload)
    data = payload.model_dump(exclude={"website", "form_started_at"})
    lead = Lead(
        **data,
        consent_at=now_iso(),
        spam_score=score,
        spam_reasons=reasons,
        status="spam" if score >= SPAM_THRESHOLD else "new",
    )
    await db.leads.insert_one(lead.model_dump())

    if lead.status != "spam":
        background.add_task(send_lead_notification, lead.model_dump())

    # Same response either way: telling a bot it was flagged only teaches it
    # what to change. Nothing personal is echoed back.
    return {"ok": True, "id": lead.id}
