from fastapi import APIRouter, HTTPException, Depends
from typing import List
from db import db
from models import (
    Banner, BannerIn, Category, CategoryIn, Client, ClientIn, Service, ServiceIn,
    Page, PageIn, Lead, LeadUpdate, now_iso,
)
from auth import enforce_admin_rbac, require_permission

# One blanket dependency covers every route below: it resolves the caller's
# permission matrix and checks it against the path's resource + the method's
# action. New admin routes are protected automatically.
router = APIRouter(prefix="/admin", tags=["admin"], dependencies=[Depends(enforce_admin_rbac)])


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


# Roles, users, media, layouts and reports live in their own modules but hang
# off this router so they inherit the RBAC guard above.
from routes_rbac import router as rbac_router          # noqa: E402
from routes_media import router as media_router        # noqa: E402
from routes_layouts import router as layouts_router    # noqa: E402
from routes_reports import router as reports_router    # noqa: E402
from routes_settings import router as settings_router  # noqa: E402
from routes_audit import router as audit_router        # noqa: E402

router.include_router(audit_router)
router.include_router(rbac_router)
router.include_router(media_router)
router.include_router(layouts_router)
router.include_router(reports_router)
router.include_router(settings_router)


# ---- CLIENTS ("trusted by" band) ----
@router.get("/clients", response_model=List[Client])
async def admin_list_clients():
    docs = await db.clients.find({}, {"_id": 0}).sort("order", 1).to_list(500)
    return [Client(**d) for d in docs]


@router.post("/clients", response_model=Client)
async def admin_create_client(payload: ClientIn):
    c = Client(**payload.model_dump())
    await db.clients.insert_one(c.model_dump())
    return c


@router.put("/clients/{client_id}", response_model=Client)
async def admin_update_client(client_id: str, payload: ClientIn):
    update = payload.model_dump()
    update["updated_at"] = now_iso()
    res = await db.clients.find_one_and_update({"id": client_id}, {"$set": update},
                                               return_document=True, projection={"_id": 0})
    if not res:
        raise HTTPException(status_code=404, detail="Client not found")
    return Client(**res)


@router.delete("/clients/{client_id}")
async def admin_delete_client(client_id: str):
    r = await db.clients.delete_one({"id": client_id})
    if r.deleted_count == 0:
        raise HTTPException(status_code=404, detail="Client not found")
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


# Declared as a static path, so it must come before any "/leads/{lid}" POST
# route if one is ever added.
@router.post("/leads/erase", dependencies=[Depends(require_permission("leads", "delete"))])
async def admin_erase_person(payload: dict):
    """DPDP data-principal erasure: remove every lead for one email address.

    POST with the email in the body — never in the URL — so it doesn't end up
    in access logs. The blanket guard checks leads:create (POST); erasure is
    destructive, so leads:delete is required as well.
    """
    email = (payload.get("email") or "").strip().lower()
    if not email or "@" not in email:
        raise HTTPException(status_code=400, detail="A valid email address is required")
    r = await db.leads.delete_many({"email": email})
    return {"ok": True, "deleted": r.deleted_count}


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
