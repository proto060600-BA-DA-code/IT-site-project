"""Blog / Insights module — public + admin routes."""
from fastapi import APIRouter, HTTPException, Depends, Query
from typing import List, Optional
from pydantic import BaseModel
from db import db
from models import BaseDoc, now_iso
from auth import require_admin


class Post(BaseDoc):
    slug: str
    title: str
    excerpt: str = ""
    body: str = ""  # markdown
    cover_image: Optional[str] = ""
    author: str = "AscendAI Team"
    tags: List[str] = []
    meta_description: Optional[str] = ""
    status: str = "draft"  # draft | published
    published_at: Optional[str] = None
    read_time_min: int = 5


class PostIn(BaseModel):
    slug: str
    title: str
    excerpt: str = ""
    body: str = ""
    cover_image: Optional[str] = ""
    author: str = "AscendAI Team"
    tags: List[str] = []
    meta_description: Optional[str] = ""
    status: str = "draft"
    read_time_min: int = 5


public = APIRouter(prefix="/insights", tags=["insights"])
admin = APIRouter(prefix="/admin/posts", tags=["admin-posts"], dependencies=[Depends(require_admin)])


# -------- PUBLIC --------
@public.get("", response_model=List[Post])
async def list_published(tag: Optional[str] = None, limit: int = Query(50, le=100)):
    q = {"status": "published"}
    if tag:
        q["tags"] = tag
    docs = await db.posts.find(q, {"_id": 0}).sort("published_at", -1).to_list(limit)
    return [Post(**d) for d in docs]


@public.get("/{slug}", response_model=Post)
async def get_published(slug: str):
    doc = await db.posts.find_one({"slug": slug, "status": "published"}, {"_id": 0})
    if not doc:
        raise HTTPException(status_code=404, detail="Post not found")
    return Post(**doc)


# -------- ADMIN --------
@admin.get("", response_model=List[Post])
async def admin_list():
    docs = await db.posts.find({}, {"_id": 0}).sort("created_at", -1).to_list(500)
    return [Post(**d) for d in docs]


@admin.post("", response_model=Post)
async def admin_create(payload: PostIn):
    if await db.posts.find_one({"slug": payload.slug}):
        raise HTTPException(status_code=409, detail="Slug already exists")
    data = payload.model_dump()
    if data["status"] == "published":
        data["published_at"] = now_iso()
    p = Post(**data)
    await db.posts.insert_one(p.model_dump())
    return p


@admin.put("/{pid}", response_model=Post)
async def admin_update(pid: str, payload: PostIn):
    existing = await db.posts.find_one({"id": pid}, {"_id": 0})
    if not existing:
        raise HTTPException(status_code=404, detail="Post not found")
    update = payload.model_dump()
    update["updated_at"] = now_iso()
    # Set published_at when transitioning to published; clear it when unpublishing.
    if update["status"] == "published" and existing.get("status") != "published":
        update["published_at"] = now_iso()
    elif update["status"] != "published":
        update["published_at"] = None
    res = await db.posts.find_one_and_update(
        {"id": pid}, {"$set": update}, return_document=True, projection={"_id": 0}
    )
    return Post(**res)


@admin.delete("/{pid}")
async def admin_delete(pid: str):
    r = await db.posts.delete_one({"id": pid})
    if r.deleted_count == 0:
        raise HTTPException(status_code=404, detail="Post not found")
    return {"ok": True}
