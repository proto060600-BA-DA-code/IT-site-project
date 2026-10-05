"""Object storage for media: Amazon S3 (served via CloudFront), with
Cloudinary kept as a fallback.

Provider selection is by environment, so rolling back is a config change:
  - S3 when S3_BUCKET and MEDIA_BASE_URL are set
  - otherwise Cloudinary when CLOUDINARY_API_SECRET is set
  - otherwise uploads are disabled, with a clear message

Upload flow (S3):
  1. Browser asks the API for an upload target (presign_upload). The SERVER
     picks the object key and signs a POST policy that pins the exact
     content type, a maximum size, and the cache header. The browser can't
     choose where the file lands or how big it is.
  2. Browser POSTs the file straight to S3 — large files never pass through
     the API server.
  3. Browser registers the upload. The server re-reads the object's first
     bytes and checks they really are the declared image type (verify_upload)
     before cataloguing it, deleting it otherwise. The public URL is derived
     server-side from the key, never taken from the client.

All env reads are lazy (inside functions) so tests can configure them.
"""
import os
import re
import uuid
from datetime import datetime, timezone

from fastapi import HTTPException

# Raster images only. SVG is excluded on purpose: it can carry script, and an
# uploaded SVG served from our media domain is a stored-XSS vector.
ALLOWED_TYPES = {
    "image/jpeg": "jpg",
    "image/png": "png",
    "image/webp": "webp",
    "image/gif": "gif",
    "image/avif": "avif",
}
ALLOWED_FOLDERS = {"banners", "services", "blog", "clients", "uploads", "pages"}
MAX_BYTES = 10 * 1024 * 1024
KEY_PREFIX = "media/"
PRESIGN_SECONDS = 300
# Keys are unique per upload (uuid), so the object at a URL never changes —
# safe to cache for a year, and the CDN never needs invalidating.
CACHE_CONTROL = "public, max-age=31536000, immutable"

_KEY_RE = re.compile(r"^media/[a-z]+/\d{4}/\d{2}/[0-9a-f]{32}\.(jpg|png|webp|gif|avif)$")


def provider() -> str | None:
    if os.environ.get("S3_BUCKET") and os.environ.get("MEDIA_BASE_URL"):
        return "s3"
    if os.environ.get("CLOUDINARY_API_SECRET"):
        return "cloudinary"
    return None


def _client():
    import boto3
    from botocore.config import Config
    # Credentials come from AWS_ACCESS_KEY_ID / AWS_SECRET_ACCESS_KEY in the
    # environment — boto3 reads them itself; they never pass through our code.
    return boto3.client(
        "s3",
        region_name=os.environ.get("AWS_REGION", "ap-south-1"),
        config=Config(signature_version="s3v4", retries={"max_attempts": 3, "mode": "standard"}),
    )


def _bucket() -> str:
    return os.environ["S3_BUCKET"]


def public_url(key: str) -> str:
    return f"{os.environ['MEDIA_BASE_URL'].rstrip('/')}/{key}"


def is_our_key(key: str) -> bool:
    """Exactly the shape presign_upload generates — rejects traversal, other
    prefixes, and anything a client might try to substitute."""
    return bool(key) and bool(_KEY_RE.match(key))


def presign_upload(folder: str, content_type: str, size: int) -> dict:
    if folder not in ALLOWED_FOLDERS:
        raise HTTPException(status_code=400, detail="Invalid folder")
    ext = ALLOWED_TYPES.get(content_type)
    if not ext:
        raise HTTPException(
            status_code=400,
            detail="Only JPEG, PNG, WebP, GIF and AVIF images can be uploaded",
        )
    if not isinstance(size, int) or size <= 0:
        raise HTTPException(status_code=400, detail="File size is required")
    if size > MAX_BYTES:
        raise HTTPException(status_code=400, detail=f"Images must be under {MAX_BYTES // (1024 * 1024)} MB")

    now = datetime.now(timezone.utc)
    key = f"{KEY_PREFIX}{folder}/{now:%Y}/{now:%m}/{uuid.uuid4().hex}.{ext}"

    post = _client().generate_presigned_post(
        Bucket=_bucket(),
        Key=key,
        Fields={"Content-Type": content_type, "Cache-Control": CACHE_CONTROL},
        Conditions=[
            {"Content-Type": content_type},
            {"Cache-Control": CACHE_CONTROL},
            # Enforced by S3 itself — a client lying about `size` is still
            # capped here.
            ["content-length-range", 1, MAX_BYTES],
        ],
        ExpiresIn=PRESIGN_SECONDS,
    )
    return {
        "provider": "s3",
        "url": post["url"],
        "fields": post["fields"],
        "key": key,
        "public_url": public_url(key),
        "max_bytes": MAX_BYTES,
    }


def _sniff(head: bytes) -> str | None:
    """Identify an image from its magic bytes."""
    if head.startswith(b"\xff\xd8\xff"):
        return "image/jpeg"
    if head.startswith(b"\x89PNG\r\n\x1a\n"):
        return "image/png"
    if head[:4] == b"RIFF" and head[8:12] == b"WEBP":
        return "image/webp"
    if head[:6] in (b"GIF87a", b"GIF89a"):
        return "image/gif"
    if head[4:8] == b"ftyp" and head[8:12] in (b"avif", b"avis"):
        return "image/avif"
    return None


def verify_upload(key: str) -> dict:
    """Confirm the object exists and its bytes match its declared type.
    Deletes it and raises if not. Returns size and type on success."""
    if not is_our_key(key):
        raise HTTPException(status_code=400, detail="Invalid upload reference")

    s3 = _client()
    try:
        head = s3.head_object(Bucket=_bucket(), Key=key)
    except Exception:  # noqa: BLE001 — missing or inaccessible
        raise HTTPException(status_code=400, detail="Upload not found — please try again")

    declared = head.get("ContentType", "")
    size = int(head.get("ContentLength", 0))
    first = s3.get_object(Bucket=_bucket(), Key=key, Range="bytes=0-31")["Body"].read()
    actual = _sniff(first)

    expected_ext = key.rsplit(".", 1)[-1]
    if actual is None or actual != declared or ALLOWED_TYPES.get(actual) != expected_ext or size > MAX_BYTES:
        delete_object(key)
        raise HTTPException(status_code=400, detail="That file isn't a valid image")

    return {"bytes": size, "mime": actual}


def delete_object(key: str) -> None:
    if not is_our_key(key):
        return
    try:
        _client().delete_object(Bucket=_bucket(), Key=key)
    except Exception:  # noqa: BLE001 — best effort; the catalogue row still goes
        pass
