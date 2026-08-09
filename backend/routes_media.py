"""Media library.

Cloudinary already handles the actual upload (signed, direct from the browser).
This module keeps the catalogue: every uploaded asset is registered here so it
can be browsed, searched, reused across fields, and deleted.
"""
import os
import logging
from fastapi import APIRouter, HTTPException, Query
from typing import List, Optional

import cloudinary
import cloudinary.uploader

from db import db
from models import Asset, AssetIn, AssetUpdateIn, now_iso

logger = logging.getLogger(__name__)
router = APIRouter(tags=["media"])

ALLOWED_FOLDERS = ["banners", "services", "blog", "clients", "uploads", "pages"]


@router.get("/media", response_model=List[Asset])
async def list_media(
    q: Optional[str] = Query(None, description="filename/alt substring match"),
    folder: Optional[str] = Query(None),
    limit: int = Query(200, le=500),
):
    query = {}
    if folder and folder != "all":
        query["folder"] = folder
    if q:
        # Escaped so a stray '(' in a filename can't blow up the regex.
        import re as _re
        rx = {"$regex": _re.escape(q), "$options": "i"}
        query["$or"] = [{"filename": rx}, {"alt": rx}]

    docs = await db.assets.find(query, {"_id": 0}).sort("created_at", -1).to_list(limit)
    return [Asset(**d) for d in docs]


@router.get("/media/folders")
async def list_folders():
    used = await db.assets.distinct("folder")
    counts = {}
    for f in set(ALLOWED_FOLDERS) | set(used):
        counts[f] = await db.assets.count_documents({"folder": f})
    total = await db.assets.count_documents({})
    return {"folders": sorted(counts.keys()), "counts": counts, "total": total}


@router.post("/media", response_model=Asset)
async def register_asset(payload: AssetIn):
    """Called by the browser after Cloudinary confirms an upload."""
    if payload.public_id:
        existing = await db.assets.find_one({"public_id": payload.public_id}, {"_id": 0})
        if existing:
            return Asset(**existing)
    asset = Asset(**payload.model_dump())
    await db.assets.insert_one(asset.model_dump())
    return asset


@router.put("/media/{asset_id}", response_model=Asset)
async def update_asset(asset_id: str, payload: AssetUpdateIn):
    update = {k: v for k, v in payload.model_dump().items() if v is not None}
    if not update:
        raise HTTPException(status_code=400, detail="Nothing to update")
    update["updated_at"] = now_iso()
    res = await db.assets.find_one_and_update(
        {"id": asset_id}, {"$set": update}, return_document=True, projection={"_id": 0}
    )
    if not res:
        raise HTTPException(status_code=404, detail="Asset not found")
    return Asset(**res)


@router.delete("/media/{asset_id}")
async def delete_asset(asset_id: str):
    asset = await db.assets.find_one({"id": asset_id}, {"_id": 0})
    if not asset:
        raise HTTPException(status_code=404, detail="Asset not found")

    # Best-effort remote delete. If Cloudinary rejects it we still drop the
    # catalogue row, otherwise a failed remote delete would strand the entry.
    if asset.get("public_id") and os.environ.get("CLOUDINARY_API_SECRET"):
        try:
            cloudinary.uploader.destroy(asset["public_id"])
        except Exception as e:  # noqa: BLE001
            logger.warning("Cloudinary delete failed for %s: %s", asset["public_id"], e)

    await db.assets.delete_one({"id": asset_id})
    return {"ok": True}


@router.post("/media/bulk-delete")
async def bulk_delete(payload: dict):
    ids = payload.get("ids") or []
    if not ids:
        raise HTTPException(status_code=400, detail="No ids supplied")
    docs = await db.assets.find({"id": {"$in": ids}}, {"_id": 0}).to_list(500)
    if os.environ.get("CLOUDINARY_API_SECRET"):
        for d in docs:
            if d.get("public_id"):
                try:
                    cloudinary.uploader.destroy(d["public_id"])
                except Exception as e:  # noqa: BLE001
                    logger.warning("Cloudinary delete failed: %s", e)
    r = await db.assets.delete_many({"id": {"$in": ids}})
    return {"ok": True, "deleted": r.deleted_count}
