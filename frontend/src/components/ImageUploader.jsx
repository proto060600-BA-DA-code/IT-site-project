// Cloudinary-backed image uploader. Used inside admin forms.
// Supports click-to-upload, drag-and-drop, and picking from the media library.
import { useState, useRef } from "react";
import { api } from "@/lib/api";
import { toast } from "sonner";
import { UploadSimple, Image as ImageIcon, X, Images } from "@phosphor-icons/react";
import { MediaPicker } from "@/components/admin/MediaLibrary";

export default function ImageUploader({ value, onChange, folder = "uploads", testid = "image-uploader" }) {
  const [busy, setBusy] = useState(false);
  const [dragOver, setDragOver] = useState(false);
  const [picking, setPicking] = useState(false);
  const inputRef = useRef(null);

  const upload = async (file) => {
    if (!file) return;
    if (!file.type.startsWith("image/")) {
      toast.error("Please pick an image file."); return;
    }
    if (file.size > 6 * 1024 * 1024) {
      toast.error("Image must be under 6 MB."); return;
    }
    setBusy(true);
    try {
      const sigRes = await api.get(`/cloudinary/signature?folder=${encodeURIComponent(folder + "/")}`);
      const { signature, timestamp, cloud_name, api_key, folder: cleanFolder } = sigRes.data;

      const form = new FormData();
      form.append("file", file);
      form.append("api_key", api_key);
      form.append("timestamp", timestamp);
      form.append("signature", signature);
      form.append("folder", cleanFolder);

      const upRes = await fetch(`https://api.cloudinary.com/v1_1/${cloud_name}/image/upload`, {
        method: "POST", body: form,
      });
      const json = await upRes.json();
      if (!upRes.ok || !json.secure_url) {
        throw new Error(json.error?.message || "Upload failed");
      }
      onChange(json.secure_url);
      // Register in the media library so the file is reusable elsewhere.
      // Non-fatal: the field still works if the catalogue write fails.
      try {
        await api.post("/admin/media", {
          filename: file.name,
          url: json.secure_url,
          thumb_url: json.secure_url,
          public_id: json.public_id || "",
          folder,
          mime: file.type,
          bytes: json.bytes || file.size,
          width: json.width || 0,
          height: json.height || 0,
        });
      } catch { /* catalogue is best-effort */ }
      toast.success("Image uploaded.");
    } catch (e) {
      toast.error(e?.response?.data?.detail || e?.message || "Upload failed");
    } finally {
      setBusy(false);
      if (inputRef.current) inputRef.current.value = "";
    }
  };

  return (
    <div
      data-testid={testid}
      className="space-y-2"
      onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
      onDragLeave={() => setDragOver(false)}
      onDrop={(e) => { e.preventDefault(); setDragOver(false); upload(e.dataTransfer.files?.[0]); }}
    >
      <div className="flex items-start gap-3">
        <div className={`w-28 h-20 border bg-[var(--paper-surface)] flex items-center justify-center overflow-hidden shrink-0 transition-colors ${
          dragOver ? "border-[var(--gold)] border-dashed border-2" : "border-[var(--line)]"
        }`}>
          {dragOver ? (
            <span className="text-[10px] uppercase tracking-wider text-[var(--gold)]">Drop</span>
          ) : value ? (
            <img src={value} alt="preview" className="w-full h-full object-cover" />
          ) : (
            <ImageIcon size={20} className="text-[var(--ink-soft)]" />
          )}
        </div>
        <div className="flex-1 flex flex-col gap-2">
          <input
            data-testid={`${testid}-url`}
            type="url"
            placeholder="Paste image URL or upload →"
            value={value || ""}
            onChange={(e) => onChange(e.target.value)}
            className="w-full bg-[var(--paper-surface)] border border-[var(--line)] px-3 py-2 text-xs font-mono focus:outline-none focus:border-[var(--brand-teal)]"
          />
          <div className="flex gap-2">
            <button
              type="button"
              data-testid={`${testid}-pick`}
              onClick={() => inputRef.current?.click()}
              disabled={busy}
              className="inline-flex items-center gap-1.5 text-xs font-mono uppercase tracking-wider text-[var(--brand-teal)] border border-[var(--brand-teal)] px-3 py-1.5 hover:bg-[var(--brand-teal)] hover:text-white transition-colors disabled:opacity-50"
            >
              <UploadSimple size={12} weight="bold" /> {busy ? "Uploading…" : "Upload"}
            </button>
            <button
              type="button"
              data-testid={`${testid}-library`}
              onClick={() => setPicking(true)}
              className="inline-flex items-center gap-1.5 text-xs font-mono uppercase tracking-wider text-[var(--ink-soft)] border border-[var(--line)] px-3 py-1.5 hover:border-[var(--brand-ink)] hover:text-[var(--ink)] transition-colors"
            >
              <Images size={12} weight="bold" /> Library
            </button>
            {value && (
              <button
                type="button"
                data-testid={`${testid}-clear`}
                onClick={() => onChange("")}
                className="inline-flex items-center gap-1.5 text-xs font-mono uppercase tracking-wider text-[var(--ink-soft)] hover:text-red-600 px-2 py-1.5"
              >
                <X size={12} /> Clear
              </button>
            )}
          </div>
          <input
            ref={inputRef}
            type="file"
            accept="image/*"
            className="hidden"
            data-testid={`${testid}-file`}
            onChange={(e) => upload(e.target.files?.[0])}
          />
        </div>
      </div>

      {picking && <MediaPicker onClose={() => setPicking(false)} onPick={onChange} />}
    </div>
  );
}
