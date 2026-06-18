from fastapi import APIRouter, HTTPException, Depends
from typing import List
from db import db
from models import (
    Banner, BannerIn, Category, CategoryIn, Service, ServiceIn,
    Page, PageIn, Lead, LeadUpdate, now_iso,
)
from auth import require_admin

router = APIRouter(prefix="/admin", tags=["admin"], dependencies=[Depends(require_admin)])


# ---- BANNERS ----
@router.get("/banners", response_model=List[Banner])
async def admin_list_banners():
    docs = await db.banners.find({}, {"_id": 0}).sort("order", 1).to_list(500)
    return [Banner(**d) for d in docs]


@router.post("/banners", response_model=Banner)
async def admin_create_banner(payload: BannerIn):
    b = Banner(**payload.model_dump())
    await db.banners.insert_one(b.model_dump())
    return b


@router.put("/banners/{banner_id}", response_model=Banner)
async def admin_update_banner(banner_id: str, payload: BannerIn):
    update = payload.model_dump()
    update["updated_at"] = now_iso()
    res = await db.banners.find_one_and_update({"id": banner_id}, {"$set": update},
                                               return_document=True, projection={"_id": 0})
    if not res:
        raise HTTPException(status_code=404, detail="Banner not found")
    return Banner(**res)


@router.delete("/banners/{banner_id}")
async def admin_delete_banner(banner_id: str):
    r = await db.banners.delete_one({"id": banner_id})
    if r.deleted_count == 0:
        raise HTTPException(status_code=404, detail="Banner not found")
    return {"ok": True}


# ---- CATEGORIES ----
@router.get("/categories", response_model=List[Category])
async def admin_list_categories():
    docs = await db.categories.find({}, {"_id": 0}).sort("order", 1).to_list(500)
    return [Category(**d) for d in docs]


@router.post("/categories", response_model=Category)
async def admin_create_category(payload: CategoryIn):
    if await db.categories.find_one({"slug": payload.slug}):
        raise HTTPException(status_code=409, detail="Slug already exists")
    c = Category(**payload.model_dump())
    await db.categories.insert_one(c.model_dump())
    return c


@router.put("/categories/{cat_id}", response_model=Category)
async def admin_update_category(cat_id: str, payload: CategoryIn):
    update = payload.model_dump()
    update["updated_at"] = now_iso()
    res = await db.categories.find_one_and_update({"id": cat_id}, {"$set": update},
                                                  return_document=True, projection={"_id": 0})
    if not res:
        raise HTTPException(status_code=404, detail="Category not found")
    return Category(**res)


@router.delete("/categories/{cat_id}")
async def admin_delete_category(cat_id: str):
    r = await db.categories.delete_one({"id": cat_id})
    if r.deleted_count == 0:
        raise HTTPException(status_code=404, detail="Category not found")
    return {"ok": True}


# ---- SERVICES ----
@router.get("/services", response_model=List[Service])
async def admin_list_services():
    docs = await db.services.find({}, {"_id": 0}).to_list(1000)
    return [Service(**d) for d in docs]


@router.post("/services", response_model=Service)
async def admin_create_service(payload: ServiceIn):
    if await db.services.find_one({"slug": payload.slug}):
        raise HTTPException(status_code=409, detail="Slug already exists")
    s = Service(**payload.model_dump())
    await db.services.insert_one(s.model_dump())
    return s


@router.put("/services/{sid}", response_model=Service)
async def admin_update_service(sid: str, payload: ServiceIn):
    update = payload.model_dump()
    update["updated_at"] = now_iso()
    res = await db.services.find_one_and_update({"id": sid}, {"$set": update},
                                                return_document=True, projection={"_id": 0})
    if not res:
        raise HTTPException(status_code=404, detail="Service not found")
    return Service(**res)


@router.delete("/services/{sid}")
async def admin_delete_service(sid: str):
    r = await db.services.delete_one({"id": sid})
    if r.deleted_count == 0:
        raise HTTPException(status_code=404, detail="Service not found")
    return {"ok": True}


# ---- PAGES ----
@router.get("/pages", response_model=List[Page])
async def admin_list_pages():
    docs = await db.pages.find({}, {"_id": 0}).to_list(500)
    return [Page(**d) for d in docs]


@router.post("/pages", response_model=Page)
async def admin_create_page(payload: PageIn):
    if await db.pages.find_one({"slug": payload.slug}):
        raise HTTPException(status_code=409, detail="Slug already exists")
    p = Page(**payload.model_dump())
    await db.pages.insert_one(p.model_dump())
    return p


@router.put("/pages/{pid}", response_model=Page)
async def admin_update_page(pid: str, payload: PageIn):
    update = payload.model_dump()
    update["updated_at"] = now_iso()
    res = await db.pages.find_one_and_update({"id": pid}, {"$set": update},
                                             return_document=True, projection={"_id": 0})
    if not res:
        raise HTTPException(status_code=404, detail="Page not found")
    return Page(**res)


@router.delete("/pages/{pid}")
async def admin_delete_page(pid: str):
    r = await db.pages.delete_one({"id": pid})
    if r.deleted_count == 0:
        raise HTTPException(status_code=404, detail="Page not found")
    return {"ok": True}


# ---- LEADS ----
@router.get("/leads", response_model=List[Lead])
async def admin_list_leads():
    docs = await db.leads.find({}, {"_id": 0}).sort("created_at", -1).to_list(2000)
    return [Lead(**d) for d in docs]


@router.put("/leads/{lid}", response_model=Lead)
async def admin_update_lead(lid: str, payload: LeadUpdate):
    update = {k: v for k, v in payload.model_dump().items() if v is not None}
    update["updated_at"] = now_iso()
    res = await db.leads.find_one_and_update({"id": lid}, {"$set": update},
                                             return_document=True, projection={"_id": 0})
    if not res:
        raise HTTPException(status_code=404, detail="Lead not found")
    return Lead(**res)


@router.delete("/leads/{lid}")
async def admin_delete_lead(lid: str):
    r = await db.leads.delete_one({"id": lid})
    if r.deleted_count == 0:
        raise HTTPException(status_code=404, detail="Lead not found")
    return {"ok": True}


# ---- DASHBOARD STATS ----
@router.get("/stats")
async def admin_stats():
    return {
        "banners": await db.banners.count_documents({}),
        "categories": await db.categories.count_documents({}),
        "services": await db.services.count_documents({}),
        "pages": await db.pages.count_documents({}),
        "leads": await db.leads.count_documents({}),
        "new_leads": await db.leads.count_documents({"status": "new"}),
        "users": await db.users.count_documents({}),
        "posts": await db.posts.count_documents({}),
        "published_posts": await db.posts.count_documents({"status": "published"}),
    }
