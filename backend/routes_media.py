"""Media library.

Uploads go straight from the browser to object storage (S3 via CloudFront,
or Cloudinary as a fallback — see storage.py). This module keeps the
catalogue: every uploaded asset is registered here so it can be browsed,
searched, reused across fields, and deleted.
"""
import os
import logging
import time
from fastapi import APIRouter, HTTPException, Query
from typing import List, Optional

import cloudinary
import cloudinary.uploader
import cloudinary.utils

import storage
from db import db
from models import Asset, AssetIn, AssetUpdateIn, now_iso

logger = logging.getLogger(__name__)
router = APIRouter(tags=["media"])

ALLOWED_FOLDERS = sorted(storage.ALLOWED_FOLDERS)


def _remote_delete(asset: dict) -> None:
    """Best-effort removal from whichever store holds the file."""
    pid = asset.get("public_id")
    if not pid:
        return
    if asset.get("storage") == "s3":
        storage.delete_object(pid)
    elif asset.get("storage", "cloudinary") == "cloudinary" and os.environ.get("CLOUDINARY_API_SECRET"):
        try:
            cloudinary.uploader.destroy(pid)
        except Exception as e:  # noqa: BLE001
            logger.warning("Cloudinary delete failed for %s: %s", pid, e)


@router.get("/media/config")
async def media_config():
    """Tells the admin UI which store is active, so it can explain rather than
    fail when uploads aren't configured."""
    return {
        "provider": storage.provider(),
        "max_bytes": storage.MAX_BYTES,
        "allowed_types": sorted(storage.ALLOWED_TYPES),
        "folders": ALLOWED_FOLDERS,
    }


@router.post("/media/upload-target")
async def upload_target(payload: dict):
    """Where the browser should send the file. Requires media:create (POST)."""
    folder = (payload.get("folder") or "uploads").strip("/")
    content_type = payload.get("content_type") or ""
    size = payload.get("size")

    p = storage.provider()
    if p == "s3":
        return storage.presign_upload(folder, content_type, size)

    if p == "cloudinary":
        if folder not in storage.ALLOWED_FOLDERS:
            raise HTTPException(status_code=400, detail="Invalid folder")
        if content_type not in storage.ALLOWED_TYPES:
            raise HTTPException(status_code=400, detail="Only JPEG, PNG, WebP, GIF and AVIF images can be uploaded")
        timestamp = int(time.time())
        params = {"timestamp": timestamp, "folder": folder}
        return {
            "provider": "cloudinary",
            "signature": cloudinary.utils.api_sign_request(params, os.environ["CLOUDINARY_API_SECRET"]),
            "timestamp": timestamp,
            "cloud_name": os.environ.get("CLOUDINARY_CLOUD_NAME"),
            "api_key": os.environ.get("CLOUDINARY_API_KEY"),
            "folder": folder,
            "max_bytes": storage.MAX_BYTES,
        }

    raise HTTPException(
        status_code=503,
        detail="Image uploads aren't configured yet. Add the S3 settings on the server (see DEPLOY.md).",
    )


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
    """Called by the browser once its direct upload has finished."""
    data = payload.model_dump(exclude={"storage_key"})
    if data.get("folder") not in storage.ALLOWED_FOLDERS:
        data["folder"] = "uploads"

    if payload.storage_key:
        # S3: trust nothing the client says about the file. Verify the bytes,
        # and derive the URL and size from the object itself.
        if storage.provider() != "s3":
            raise HTTPException(status_code=400, detail="S3 storage isn't configured")
        key = payload.storage_key
        existing = await db.assets.find_one({"public_id": key}, {"_id": 0})
        if existing:
            return Asset(**existing)
        facts = storage.verify_upload(key)
        url = storage.public_url(key)
        data.update(
            url=url, thumb_url=url, public_id=key, storage="s3",
            mime=facts["mime"], bytes=facts["bytes"],
        )
    else:
        if not payload.url:
            raise HTTPException(status_code=400, detail="url is required")
        if payload.public_id:
            existing = await db.assets.find_one({"public_id": payload.public_id}, {"_id": 0})
            if existing:
                return Asset(**existing)
        data["storage"] = "cloudinary" if "res.cloudinary.com" in payload.url else "external"

    asset = Asset(**data)
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

    # Best-effort remote delete. If the store rejects it we still drop the
    # catalogue row, otherwise a failed remote delete would strand the entry.
    _remote_delete(asset)
    await db.assets.delete_one({"id": asset_id})
    return {"ok": True}


@router.post("/media/bulk-delete")
async def bulk_delete(payload: dict):
    ids = payload.get("ids") or []
    if not ids:
        raise HTTPException(status_code=400, detail="No ids supplied")
    docs = await db.assets.find({"id": {"$in": ids}}, {"_id": 0}).to_list(500)
    for d in docs:
        _remote_delete(d)
    r = await db.assets.delete_many({"id": {"$in": ids}})
    return {"ok": True, "deleted": r.deleted_count}
