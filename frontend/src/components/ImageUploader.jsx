// Image field for admin forms. Upload (click or drag-and-drop), or pick from
// the media library. Uploads go through lib/upload.js — resized, re-encoded,
// sent straight to storage, verified and catalogued by the server.
import { useState, useRef } from "react";
import { toast } from "sonner";
import { UploadSimple, Image as ImageIcon, X, Images } from "@phosphor-icons/react";
import { MediaPicker } from "@/components/admin/MediaLibrary";
import { uploadImage } from "@/lib/upload";

export default function ImageUploader({ value, onChange, folder = "uploads", testid = "image-uploader" }) {
  const [busy, setBusy] = useState(false);
  const [dragOver, setDragOver] = useState(false);
  const [picking, setPicking] = useState(false);
  const inputRef = useRef(null);

  const upload = async (file) => {
    if (!file) return;
    setBusy(true);
    try {
      const asset = await uploadImage(file, folder);
      onChange(asset.url);
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
              className="inline-flex items-center gap-1.5 text-xs font-mono uppercase tracking-wider text-[var(--brand-ink)] border border-[var(--brand-ink)] px-3 py-1.5 hover:bg-[var(--selected-bg)] hover:text-[var(--selected-fg)] hover:border-[var(--selected-bg)] transition-colors disabled:opacity-50"
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
            accept="image/jpeg,image/png,image/webp,image/gif,image/avif"
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
