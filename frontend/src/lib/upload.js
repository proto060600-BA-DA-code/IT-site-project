/**
 * Single image-upload path for the whole admin.
 *
 *   uploadImage(file, folder) → catalogued asset { id, url, … }
 *
 * 1. Validates type and size locally for instant feedback (the server
 *    enforces the same rules — this is only for UX).
 * 2. Re-encodes raster images in the browser: scales anything over
 *    MAX_EDGE px down, and re-encodes to WebP. That strips EXIF metadata
 *    (including GPS location from phone photos), neutralises files that are
 *    something else wearing an image extension, and turns 6 MB camera images
 *    into ~300 KB ones that don't hurt page speed.
 * 3. Asks the API for an upload target and sends the file straight to S3
 *    (or Cloudinary, if that's the configured fallback).
 * 4. Registers the upload; the server verifies the bytes before cataloguing.
 */
import { api } from "@/lib/api";

const MAX_EDGE = 2400;
const WEBP_QUALITY = 0.85;
const ACCEPTED = ["image/jpeg", "image/png", "image/webp", "image/gif", "image/avif"];
const DEFAULT_MAX_BYTES = 10 * 1024 * 1024;

export class UploadError extends Error {}

function loadImage(file) {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file);
    const img = new Image();
    img.onload = () => { URL.revokeObjectURL(url); resolve(img); };
    img.onerror = () => { URL.revokeObjectURL(url); reject(new UploadError(`${file.name} couldn't be read as an image`)); };
    img.src = url;
  });
}

/**
 * Returns { blob, type, width, height }. GIFs pass through untouched —
 * drawing to a canvas would flatten an animation to its first frame.
 */
async function prepare(file) {
  if (file.type === "image/gif") return { blob: file, type: file.type, width: 0, height: 0 };

  const img = await loadImage(file);
  const scale = Math.min(1, MAX_EDGE / Math.max(img.naturalWidth, img.naturalHeight));
  const width = Math.round(img.naturalWidth * scale);
  const height = Math.round(img.naturalHeight * scale);

  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  canvas.getContext("2d").drawImage(img, 0, 0, width, height);

  const blob = await new Promise((r) => canvas.toBlob(r, "image/webp", WEBP_QUALITY));
  // Very old Safari can't encode WebP and silently returns PNG — accept
  // whatever type it actually produced, as long as it's one we allow.
  if (!blob || !ACCEPTED.includes(blob.type)) {
    return { blob: file, type: file.type, width: img.naturalWidth, height: img.naturalHeight };
  }
  return { blob, type: blob.type, width, height };
}

function renameFor(name, type) {
  const ext = { "image/webp": "webp", "image/jpeg": "jpg", "image/png": "png", "image/gif": "gif", "image/avif": "avif" }[type];
  return ext ? name.replace(/\.[^.]+$/, "") + "." + ext : name;
}

export async function uploadImage(file, folder = "uploads") {
  if (!file) throw new UploadError("No file selected");
  if (!ACCEPTED.includes(file.type)) {
    throw new UploadError(`${file.name}: only JPEG, PNG, WebP, GIF and AVIF images can be uploaded`);
  }
  if (file.size > 40 * 1024 * 1024) {
    // Even before compression — anything this big is almost certainly a mistake.
    throw new UploadError(`${file.name} is too large`);
  }

  const { blob, type, width, height } = await prepare(file);
  const filename = renameFor(file.name, type);

  let target;
  try {
    target = (await api.post("/admin/media/upload-target", { folder, content_type: type, size: blob.size })).data;
  } catch (e) {
    throw new UploadError(e?.response?.data?.detail || "Could not start the upload");
  }

  if (blob.size > (target.max_bytes || DEFAULT_MAX_BYTES)) {
    throw new UploadError(`${file.name} is still over ${Math.round((target.max_bytes || DEFAULT_MAX_BYTES) / 1048576)} MB after compression`);
  }

  if (target.provider === "s3") {
    const form = new FormData();
    Object.entries(target.fields).forEach(([k, v]) => form.append(k, v));
    form.append("file", blob, filename); // must be the last field for S3
    const res = await fetch(target.url, { method: "POST", body: form });
    if (!res.ok) throw new UploadError(`Upload to storage failed (${res.status})`);

    const asset = await api.post("/admin/media", {
      filename, folder, storage_key: target.key, width, height,
    });
    return asset.data;
  }

  // Cloudinary fallback
  const form = new FormData();
  form.append("file", blob, filename);
  form.append("api_key", target.api_key);
  form.append("timestamp", target.timestamp);
  form.append("signature", target.signature);
  form.append("folder", target.folder);
  const res = await fetch(`https://api.cloudinary.com/v1_1/${target.cloud_name}/image/upload`, { method: "POST", body: form });
  const json = await res.json();
  if (!res.ok || !json.secure_url) throw new UploadError(json.error?.message || "Upload failed");

  const asset = await api.post("/admin/media", {
    filename, folder, url: json.secure_url, thumb_url: json.secure_url, public_id: json.public_id || "",
    mime: type, bytes: json.bytes || blob.size, width: json.width || width, height: json.height || height,
  });
  return asset.data;
}
