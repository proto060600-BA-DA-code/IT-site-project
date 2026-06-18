// Cloudinary-backed image uploader. Used inside admin forms.
import { useState, useRef } from "react";
import { api, API_BASE } from "@/lib/api";
import { toast } from "sonner";
import { UploadSimple, Image as ImageIcon, X } from "@phosphor-icons/react";

export default function ImageUploader({ value, onChange, folder = "uploads", testid = "image-uploader" }) {
  const [busy, setBusy] = useState(false);
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
      toast.success("Image uploaded.");
    } catch (e) {
      toast.error(e?.response?.data?.detail || e?.message || "Upload failed");
    } finally {
      setBusy(false);
      if (inputRef.current) inputRef.current.value = "";
    }
  };

  return (
    <div data-testid={testid} className="space-y-2">
      <div className="flex items-start gap-3">
        <div className="w-28 h-20 border border-[var(--line)] bg-[var(--paper-surface)] flex items-center justify-center overflow-hidden shrink-0">
          {value ? (
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
    </div>
  );
}
