from fastapi import APIRouter, HTTPException, BackgroundTasks
from typing import List, Optional
from db import db
from models import Banner, Category, Client, Service, Page, Lead, LeadIn, now_iso
from email_service import send_lead_notification

router = APIRouter(tags=["catalog"])


@router.get("/banners", response_model=List[Banner])
async def list_banners():
    docs = await db.banners.find({"active": True}, {"_id": 0}).sort("order", 1).to_list(100)
    return [Banner(**d) for d in docs]


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


@router.post("/leads", response_model=Lead)
async def create_lead(payload: LeadIn, background: BackgroundTasks):
    lead = Lead(**payload.model_dump())
    await db.leads.insert_one(lead.model_dump())
    background.add_task(send_lead_notification, lead.model_dump())
    return lead
