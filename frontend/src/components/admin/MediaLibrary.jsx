/**
 * Media library — shared by the Media page and the field picker.
 *
 * Upload path is unchanged (signed Cloudinary direct upload); this adds the
 * catalogue layer on top so assets can be browsed, searched and reused instead
 * of re-uploaded every time.
 */
import { useCallback, useEffect, useRef, useState } from "react";
import { api } from "@/lib/api";
import { toast } from "sonner";
import {
  UploadSimple, MagnifyingGlass, Trash, X, CheckCircle, FolderSimple, Image as ImageIcon,
} from "@phosphor-icons/react";

const MAX_BYTES = 6 * 1024 * 1024;

export function useMediaUpload(folder = "uploads") {
  const [queue, setQueue] = useState([]); // [{name, pct, status}]

  const uploadMany = useCallback(async (files, onDone) => {
    const list = Array.from(files || []).filter(Boolean);
    if (!list.length) return;

    const valid = list.filter((f) => {
      if (!f.type.startsWith("image/")) { toast.error(`${f.name}: not an image`); return false; }
      if (f.size > MAX_BYTES) { toast.error(`${f.name}: over 6 MB`); return false; }
      return true;
    });
    if (!valid.length) return;

    setQueue(valid.map((f) => ({ name: f.name, pct: 0, status: "pending" })));

    let sig;
    try {
      const res = await api.get(`/cloudinary/signature?folder=${encodeURIComponent(folder + "/")}`);
      sig = res.data;
    } catch (e) {
      toast.error(e?.response?.data?.detail || "Cloudinary is not configured");
      setQueue([]);
      return;
    }

    const uploaded = [];
    for (let i = 0; i < valid.length; i++) {
      const file = valid[i];
      setQueue((q) => q.map((it, idx) => (idx === i ? { ...it, status: "uploading" } : it)));
      try {
        const form = new FormData();
        form.append("file", file);
        form.append("api_key", sig.api_key);
        form.append("timestamp", sig.timestamp);
        form.append("signature", sig.signature);
        form.append("folder", sig.folder);

        const up = await fetch(`https://api.cloudinary.com/v1_1/${sig.cloud_name}/image/upload`, {
          method: "POST", body: form,
        });
        const json = await up.json();
        if (!up.ok || !json.secure_url) throw new Error(json.error?.message || "Upload failed");

        // Register in the catalogue so it shows up in the library.
        const asset = await api.post("/admin/media", {
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
        uploaded.push(asset.data);
        setQueue((q) => q.map((it, idx) => (idx === i ? { ...it, pct: 100, status: "done" } : it)));
      } catch (e) {
        setQueue((q) => q.map((it, idx) => (idx === i ? { ...it, status: "error" } : it)));
        toast.error(`${file.name}: ${e.message || "upload failed"}`);
      }
    }

    if (uploaded.length) toast.success(`${uploaded.length} file${uploaded.length === 1 ? "" : "s"} uploaded`);
    setTimeout(() => setQueue([]), 1200);
    onDone?.(uploaded);
  }, [folder]);

  return { queue, uploadMany };
}

export default function MediaLibrary({ onPick, selectable = false, compact = false }) {
  const [assets, setAssets] = useState([]);
  const [folders, setFolders] = useState({ folders: [], counts: {}, total: 0 });
  const [folder, setFolder] = useState("all");
  const [q, setQ] = useState("");
  const [selected, setSelected] = useState([]);
  const [dragOver, setDragOver] = useState(false);
  const [loading, setLoading] = useState(true);
  const fileRef = useRef(null);

  const uploadFolder = folder === "all" ? "uploads" : folder;
  const { queue, uploadMany } = useMediaUpload(uploadFolder);

  const load = useCallback(async () => {
    try {
      const params = new URLSearchParams();
      if (q) params.set("q", q);
      if (folder !== "all") params.set("folder", folder);
      const [a, f] = await Promise.all([
        api.get(`/admin/media?${params}`),
        api.get("/admin/media/folders"),
      ]);
      setAssets(a.data);
      setFolders(f.data);
    } catch (e) {
      toast.error(e?.response?.data?.detail || "Could not load media");
    } finally {
      setLoading(false);
    }
  }, [q, folder]);

  useEffect(() => {
    const t = setTimeout(load, q ? 250 : 0); // debounce search
    return () => clearTimeout(t);
  }, [load, q]);

  const onDrop = (e) => {
    e.preventDefault();
    setDragOver(false);
    uploadMany(e.dataTransfer.files, load);
  };

  const removeSelected = async () => {
    if (!selected.length) return;
    if (!window.confirm(`Delete ${selected.length} file(s)? This also removes them from Cloudinary.`)) return;
    try {
      await api.post("/admin/media/bulk-delete", { ids: selected });
      toast.success("Deleted");
      setSelected([]);
      await load();
    } catch (e) {
      toast.error(e?.response?.data?.detail || "Delete failed");
    }
  };

  const toggleSel = (id) =>
    setSelected((s) => (s.includes(id) ? s.filter((x) => x !== id) : [...s, id]));

  return (
    <div
      onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
      onDragLeave={() => setDragOver(false)}
      onDrop={onDrop}
      className={`relative ${dragOver ? "outline outline-2 outline-dashed outline-[var(--gold)]" : ""}`}
      data-testid="media-library"
    >
      {dragOver && (
        <div className="absolute inset-0 bg-[var(--navy-950)]/80 z-20 flex items-center justify-center pointer-events-none">
          <div className="text-[var(--off-white)] text-sm tracking-wide uppercase">Drop to upload</div>
        </div>
      )}

      {/* Toolbar */}
      <div className="flex flex-wrap items-center gap-3 mb-4">
        <div className="relative flex-1 min-w-[200px]">
          <MagnifyingGlass size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-[var(--ink-soft)]" />
          <input
            data-testid="media-search"
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Search filenames and alt text…"
            className="w-full bg-white border border-[var(--line)] pl-9 pr-3 py-2 text-sm focus:outline-none focus:border-[var(--brand-ink)]"
          />
        </div>
        <select
          data-testid="media-folder"
          value={folder}
          onChange={(e) => setFolder(e.target.value)}
          className="bg-white border border-[var(--line)] px-3 py-2 text-sm focus:outline-none focus:border-[var(--brand-ink)]"
        >
          <option value="all">All folders ({folders.total})</option>
          {(folders.folders || []).map((f) => (
            <option key={f} value={f}>{f} ({folders.counts?.[f] ?? 0})</option>
          ))}
        </select>
        <button onClick={() => fileRef.current?.click()} data-testid="media-upload" className="btn-accent !py-2 !px-4 text-sm">
          <UploadSimple size={14} weight="bold" /> Upload
        </button>
        {selected.length > 0 && (
          <button onClick={removeSelected} className="btn-ghost !py-2 !px-4 text-sm text-red-600">
            <Trash size={14} /> Delete {selected.length}
          </button>
        )}
        <input ref={fileRef} type="file" accept="image/*" multiple className="hidden"
          onChange={(e) => uploadMany(e.target.files, load)} />
      </div>

      {/* Upload progress */}
      {queue.length > 0 && (
        <div className="mb-4 border border-[var(--line)] bg-white divide-y divide-[var(--line)]">
          {queue.map((it) => (
            <div key={it.name} className="px-4 py-2 flex items-center justify-between text-xs">
              <span className="truncate">{it.name}</span>
              <span className={
                it.status === "done" ? "text-emerald-600" :
                it.status === "error" ? "text-red-600" : "text-[var(--ink-soft)]"
              }>
                {it.status === "done" ? "✓ uploaded" : it.status === "error" ? "failed" : "uploading…"}
              </span>
            </div>
          ))}
        </div>
      )}

      {/* Grid */}
      {loading ? (
        <div className="p-12 text-center text-[var(--ink-soft)] text-sm">Loading…</div>
      ) : assets.length === 0 ? (
        <div className="border border-dashed border-[var(--line)] p-16 text-center">
          <ImageIcon size={28} className="mx-auto text-[var(--ink-soft)]" />
          <p className="text-sm text-[var(--ink-soft)] mt-3">
            {q || folder !== "all" ? "Nothing matches that filter." : "No media yet — drop files anywhere on this panel."}
          </p>
        </div>
      ) : (
        <div className={`grid gap-3 ${compact ? "grid-cols-3 sm:grid-cols-4" : "grid-cols-2 sm:grid-cols-4 lg:grid-cols-6"}`}>
          {assets.map((a) => (
            <div key={a.id} data-testid={`media-item-${a.id}`}
              className="group relative border border-[var(--line)] bg-white overflow-hidden">
              <button
                type="button"
                onClick={() => (onPick ? onPick(a) : selectable ? toggleSel(a.id) : null)}
                className="block w-full aspect-[4/3] bg-[var(--paper-surface)]"
              >
                <img src={a.thumb_url || a.url} alt={a.alt || a.filename} loading="lazy"
                  className="w-full h-full object-cover" />
              </button>

              {selectable && (
                <button
                  type="button"
                  onClick={() => toggleSel(a.id)}
                  className="absolute top-2 left-2 bg-white/90 rounded-full"
                  aria-label="Select"
                >
                  <CheckCircle size={20} weight={selected.includes(a.id) ? "fill" : "regular"}
                    className={selected.includes(a.id) ? "text-[var(--gold)]" : "text-[var(--ink-soft)]"} />
                </button>
              )}

              <div className="px-2 py-1.5 border-t border-[var(--line)]">
                <div className="text-[11px] truncate" title={a.filename}>{a.filename}</div>
                <div className="text-[10px] text-[var(--ink-soft)] flex items-center gap-1">
                  <FolderSimple size={10} /> {a.folder}
                  {a.width ? ` · ${a.width}×${a.height}` : ""}
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

/** Modal wrapper used by image fields to pick from the library. */
export function MediaPicker({ onClose, onPick }) {
  return (
    <div className="fixed inset-0 bg-black/50 z-[60] flex items-start justify-center p-6 overflow-y-auto" data-testid="media-picker">
      <div className="bg-white border border-[var(--line)] w-full max-w-5xl my-10">
        <div className="px-6 py-4 border-b border-[var(--line)] flex items-center justify-between">
          <h2 className="text-lg tracking-tight">Choose an image</h2>
          <button onClick={onClose}><X size={18} /></button>
        </div>
        <div className="p-6">
          <MediaLibrary compact onPick={(a) => { onPick(a.url); onClose(); }} />
        </div>
      </div>
    </div>
  );
}
