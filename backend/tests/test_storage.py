"""S3 media storage — runs against moto's in-memory S3, no AWS account needed."""
import base64
import json

import boto3
import pytest
from moto import mock_aws

BUCKET = "rk-media-test"
CDN = "https://cdn.rk.test"
PNG = b"\x89PNG\r\n\x1a\n" + b"\x00" * 64
JPEG = b"\xff\xd8\xff\xe0" + b"\x00" * 64


@pytest.fixture()
def s3(client, monkeypatch):
    """Activate a fake S3 with the bucket, and point the app at it."""
    monkeypatch.setenv("S3_BUCKET", BUCKET)
    monkeypatch.setenv("MEDIA_BASE_URL", CDN)
    monkeypatch.setenv("AWS_REGION", "ap-south-1")
    monkeypatch.setenv("AWS_ACCESS_KEY_ID", "testing")
    monkeypatch.setenv("AWS_SECRET_ACCESS_KEY", "testing")
    with mock_aws():
        c = boto3.client("s3", region_name="ap-south-1")
        c.create_bucket(Bucket=BUCKET, CreateBucketConfiguration={"LocationConstraint": "ap-south-1"})
        yield c


def target(client, headers, **body):
    payload = {"folder": "uploads", "content_type": "image/png", "size": len(PNG)}
    payload.update(body)
    return client.post("/api/admin/media/upload-target", headers=headers, json=payload)


def browser_upload(s3, t, body, content_type=None):
    """Stand-in for the browser's direct POST to S3."""
    s3.put_object(Bucket=BUCKET, Key=t["key"], Body=body,
                  ContentType=content_type or t["fields"]["Content-Type"],
                  CacheControl=t["fields"]["Cache-Control"])


# ── Upload target ───────────────────────────────────────────────────────────
def test_server_chooses_the_key_and_pins_type_size_and_cache(client, admin, s3):
    r = target(client, admin)
    assert r.status_code == 200, r.text
    t = r.json()
    assert t["provider"] == "s3"
    assert t["key"].startswith("media/uploads/") and t["key"].endswith(".png")
    assert t["public_url"] == f"{CDN}/{t['key']}"

    policy = json.loads(base64.b64decode(t["fields"]["policy"]))
    conds = policy["conditions"]
    assert ["content-length-range", 1, 10 * 1024 * 1024] in conds
    assert {"Content-Type": "image/png"} in conds
    assert {"Cache-Control": "public, max-age=31536000, immutable"} in conds


@pytest.mark.parametrize("body,reason", [
    ({"content_type": "image/svg+xml"}, "svg can carry script"),
    ({"content_type": "text/html"}, "not an image"),
    ({"size": 50 * 1024 * 1024}, "over the size cap"),
    ({"size": 0}, "empty"),
    ({"folder": "../../etc"}, "path traversal"),
    ({"folder": "private"}, "unknown folder"),
])
def test_upload_target_refuses(client, admin, s3, body, reason):
    assert target(client, admin, **body).status_code == 400, reason


def test_viewer_cannot_get_an_upload_target(client, viewer, s3):
    assert target(client, viewer).status_code == 403


def test_uploads_explain_themselves_when_unconfigured(client, admin, monkeypatch):
    monkeypatch.delenv("S3_BUCKET", raising=False)
    monkeypatch.delenv("CLOUDINARY_API_SECRET", raising=False)
    r = target(client, admin)
    assert r.status_code == 503
    assert "aren't configured" in r.json()["detail"]
    assert client.get("/api/admin/media/config", headers=admin).json()["provider"] is None


# ── Registration ────────────────────────────────────────────────────────────
def test_full_upload_registers_with_a_server_derived_url(client, admin, s3):
    t = target(client, admin).json()
    browser_upload(s3, t, PNG)
    r = client.post("/api/admin/media", headers=admin, json={
        "filename": "logo.png", "storage_key": t["key"], "folder": "uploads",
        # A client trying to smuggle in its own URL and metadata:
        "url": "https://evil.example/x.png", "mime": "text/html", "bytes": 1,
    })
    assert r.status_code == 200, r.text
    a = r.json()
    assert a["url"] == f"{CDN}/{t['key']}"   # not the client's URL
    assert a["storage"] == "s3"
    assert a["mime"] == "image/png"          # sniffed, not trusted
    assert a["bytes"] == len(PNG)


def test_a_file_that_is_not_really_an_image_is_rejected_and_deleted(client, admin, s3):
    t = target(client, admin).json()
    browser_upload(s3, t, b"<script>alert(1)</script>" + b" " * 40, content_type="image/png")
    r = client.post("/api/admin/media", headers=admin,
                    json={"filename": "x.png", "storage_key": t["key"]})
    assert r.status_code == 400
    with pytest.raises(s3.exceptions.ClientError):
        s3.head_object(Bucket=BUCKET, Key=t["key"])


def test_declared_type_must_match_the_bytes(client, admin, s3):
    """A JPEG uploaded under a PNG key/type is refused."""
    t = target(client, admin).json()
    browser_upload(s3, t, JPEG)
    r = client.post("/api/admin/media", headers=admin, json={"filename": "x.png", "storage_key": t["key"]})
    assert r.status_code == 400


@pytest.mark.parametrize("key", [
    "media/../secrets.png",
    "other/uploads/2026/10/" + "a" * 32 + ".png",
    "media/uploads/2026/10/not-a-uuid.png",
    "media/uploads/2026/10/" + "a" * 32 + ".svg",
])
def test_registration_refuses_keys_we_did_not_issue(client, admin, s3, key):
    # Plant a perfectly valid image at the forged key first. Otherwise the
    # request would fail on "not found" and the test would pass even with the
    # key check removed — which an earlier version of this test did.
    s3.put_object(Bucket=BUCKET, Key=key, Body=PNG, ContentType="image/png")
    r = client.post("/api/admin/media", headers=admin, json={"filename": "x", "storage_key": key})
    assert r.status_code == 400
    assert r.json()["detail"] == "Invalid upload reference"


def test_registering_twice_returns_the_same_asset(client, admin, s3):
    t = target(client, admin).json()
    browser_upload(s3, t, PNG)
    body = {"filename": "a.png", "storage_key": t["key"]}
    a = client.post("/api/admin/media", headers=admin, json=body).json()
    b = client.post("/api/admin/media", headers=admin, json=body).json()
    assert a["id"] == b["id"]


# ── Deletion ────────────────────────────────────────────────────────────────
def test_deleting_an_asset_removes_the_object_from_s3(client, admin, s3):
    t = target(client, admin).json()
    browser_upload(s3, t, PNG)
    aid = client.post("/api/admin/media", headers=admin,
                      json={"filename": "a.png", "storage_key": t["key"]}).json()["id"]
    assert client.delete(f"/api/admin/media/{aid}", headers=admin).status_code == 200
    with pytest.raises(s3.exceptions.ClientError):
        s3.head_object(Bucket=BUCKET, Key=t["key"])


def test_issuing_an_upload_url_is_not_audited(client, admin, s3):
    target(client, admin)
    log = client.get("/api/admin/audit", headers=admin).json()["items"]
    assert not any("upload-target" in (e.get("path") or "") for e in log)
