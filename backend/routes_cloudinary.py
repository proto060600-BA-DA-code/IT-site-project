"""Cloudinary integration — signed uploads from admin dashboard."""
import os
import time
import logging
import cloudinary
import cloudinary.utils
import cloudinary.uploader
from fastapi import APIRouter, HTTPException, Depends, Query

from auth import require_permission

logger = logging.getLogger(__name__)

cloudinary.config(
    cloud_name=os.environ.get("CLOUDINARY_CLOUD_NAME"),
    api_key=os.environ.get("CLOUDINARY_API_KEY"),
    api_secret=os.environ.get("CLOUDINARY_API_SECRET"),
    secure=True,
)

# Must match routes_media.ALLOWED_FOLDERS — the media library and page builder
# upload into clients/ and pages/, which this list previously rejected.
ALLOWED_FOLDERS = ("banners/", "services/", "blog/", "clients/", "pages/", "uploads/")

# A signature lets the holder upload to our Cloudinary account, so it requires
# media:create — not merely "has some admin permission".
router = APIRouter(prefix="/cloudinary", tags=["cloudinary"],
                   dependencies=[Depends(require_permission("media", "create"))])


@router.get("/signature")
def generate_signature(folder: str = Query("uploads/")):
    if not folder.endswith("/"):
        folder += "/"
    if not folder.startswith(ALLOWED_FOLDERS):
        raise HTTPException(status_code=400, detail="Invalid folder path")
    if not os.environ.get("CLOUDINARY_API_SECRET"):
        raise HTTPException(status_code=500, detail="Cloudinary is not configured")

    timestamp = int(time.time())
    params = {"timestamp": timestamp, "folder": folder.rstrip("/")}
    signature = cloudinary.utils.api_sign_request(params, os.environ["CLOUDINARY_API_SECRET"])
    return {
        "signature": signature,
        "timestamp": timestamp,
        "cloud_name": os.environ["CLOUDINARY_CLOUD_NAME"],
        "api_key": os.environ["CLOUDINARY_API_KEY"],
        "folder": folder.rstrip("/"),
    }
