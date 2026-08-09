// Generic table-based admin CRUD for banners/categories/services/pages/posts
import { useCallback, useEffect, useState } from "react";
import { api } from "@/lib/api";
import { toast } from "sonner";
import { PencilSimple, Trash, Plus, X, DownloadSimple } from "@phosphor-icons/react";
import ImageUploader from "@/components/ImageUploader";
import { SortableList, SortableItem, DragHandle } from "@/components/admin/Sortable";
import { downloadCsv } from "@/lib/download";

export default function AdminCRUD({
  resource,
  title,
  columns,
  fields,
  defaults,
  testidPrefix,
  imageFolder = "uploads",
  // Set false for collections with no `order` field (e.g. leads).
  sortable = true,
  exportable = true,
}) {
  const [items, setItems] = useState([]);
  const [editing, setEditing] = useState(null); // null | item | "new"
  const [form, setForm] = useState(defaults);
  const [savingOrder, setSavingOrder] = useState(false);

  const load = useCallback(
    () => api.get(`/admin/${resource}`).then((r) => setItems(r.data)),
    [resource]
  );

  useEffect(() => { load(); }, [load]);

  const startNew = () => { setForm(defaults); setEditing("new"); };
  const startEdit = (it) => {
    const copy = { ...defaults, ...it };
    Object.keys(copy).forEach((k) => { if (Array.isArray(copy[k])) copy[k] = copy[k].join("\n"); });
    setForm(copy);
    setEditing(it);
  };

  const save = async () => {
    try {
      const payload = { ...form };
      fields.forEach((f) => {
        if (f.type === "array" && typeof payload[f.key] === "string") {
          payload[f.key] = payload[f.key].split("\n").map((s) => s.trim()).filter(Boolean);
        }
        if (f.type === "number") payload[f.key] = Number(payload[f.key]) || 0;
        if (f.type === "boolean") payload[f.key] = !!payload[f.key];
      });
      if (editing === "new") {
        await api.post(`/admin/${resource}`, payload);
        toast.success(`${title.slice(0, -1)} created.`);
      } else {
        await api.put(`/admin/${resource}/${editing.id}`, payload);
        toast.success(`${title.slice(0, -1)} updated.`);
      }
      setEditing(null);
      await load();
    } catch (e) {
      toast.error(e?.response?.data?.detail || "Save failed");
    }
  };

  const remove = async (id) => {
    if (!window.confirm("Delete this item?")) return;
    try { await api.delete(`/admin/${resource}/${id}`); toast.success("Deleted"); await load(); }
    catch (e) { toast.error("Delete failed"); }
  };

  // Reordering writes the new index to each row's `order` field. Optimistic:
  // the list moves immediately, and reloads from the server once persisted.
  const reorder = async (next) => {
    setItems(next);
    setSavingOrder(true);
    try {
      await Promise.all(
        next.map((it, i) =>
          it.order === i ? null : api.put(`/admin/${resource}/${it.id}`, { ...it, order: i })
        ).filter(Boolean)
      );
      toast.success("Order saved");
      await load();
    } catch (e) {
      toast.error("Could not save the new order");
      await load();
    } finally {
      setSavingOrder(false);
    }
  };

  const canSort = sortable && "order" in (defaults || {});

  return (
    <div data-testid={`admin-${resource}-page`}>
      <div className="flex items-end justify-between mb-6 gap-4 flex-wrap">
        <div>
          <div className="eyebrow mb-2">Manage</div>
          <h1 className="text-3xl tracking-tight">{title}</h1>
          {canSort && (
            <p className="text-sm text-[var(--ink-soft)] mt-1">
              {savingOrder ? "Saving order…" : "Drag the handle to reorder — the new order saves automatically."}
            </p>
          )}
        </div>
        <div className="flex gap-2">
          {exportable && (
            <button
              onClick={() => downloadCsv(`/admin/reports/export/${resource}`, `${resource}.csv`)}
              data-testid={`${testidPrefix}-export`}
              className="btn-ghost !py-2 !px-4 text-sm"
            >
              <DownloadSimple size={14} weight="bold" /> Export CSV
            </button>
          )}
          <button onClick={startNew} data-testid={`${testidPrefix}-new`} className="btn-accent">
            <Plus size={14} weight="bold" /> New
          </button>
        </div>
      </div>

      <div className="bg-white border border-[var(--line)] overflow-x-auto">
        <table className="w-full text-sm" data-testid={`${testidPrefix}-table`}>
          <thead className="bg-[var(--paper-surface)] border-b border-[var(--line)]">
            <tr>
              {canSort && <th className="w-10" />}
              {columns.map((c) => (
                <th key={c.key} className="text-left text-[10px] font-mono uppercase tracking-wider text-[var(--ink-soft)] px-4 py-3">{c.label}</th>
              ))}
              <th className="text-right text-[10px] font-mono uppercase tracking-wider text-[var(--ink-soft)] px-4 py-3 w-32">Actions</th>
            </tr>
          </thead>
          <SortableList items={items} onReorder={reorder}>
            <tbody>
              {items.map((it) => (
                <SortableItem key={it.id} id={it.id} as="tr"
                  className="border-b border-[var(--line)] last:border-0 hover:bg-[var(--paper-surface)] bg-white">
                  {({ handleProps }) => (
                    <>
                      {canSort && (
                        <td className="pl-3 align-middle">
                          <DragHandle handleProps={handleProps} />
                        </td>
                      )}
                      {columns.map((c) => (
                        <td key={c.key} className="px-4 py-3 text-[var(--ink)] align-top">
                          {renderCell(it[c.key])}
                        </td>
                      ))}
                      <td className="px-4 py-3 text-right whitespace-nowrap">
                        <button onClick={() => startEdit(it)} data-testid={`${testidPrefix}-edit-${it.id}`} className="inline-flex items-center gap-1 text-xs text-[var(--brand-ink)] mr-3 hover:underline"><PencilSimple size={12} /> Edit</button>
                        <button onClick={() => remove(it.id)} data-testid={`${testidPrefix}-delete-${it.id}`} className="inline-flex items-center gap-1 text-xs text-red-600 hover:underline"><Trash size={12} /> Delete</button>
                      </td>
                    </>
                  )}
                </SortableItem>
              ))}
              {items.length === 0 && (
                <tr><td colSpan={columns.length + (canSort ? 2 : 1)} className="px-4 py-12 text-center text-[var(--ink-soft)]">No items yet — click New.</td></tr>
              )}
            </tbody>
          </SortableList>
        </table>
      </div>

      {editing && (
        <div className="fixed inset-0 bg-black/40 z-50 flex items-start justify-center p-6 overflow-y-auto" data-testid={`${testidPrefix}-modal`}>
          <div className="bg-white border border-[var(--line)] w-full max-w-2xl my-10">
            <div className="px-6 py-4 border-b border-[var(--line)] flex items-center justify-between">
              <h2 className="text-lg tracking-tight">{editing === "new" ? "New" : "Edit"} {title.slice(0, -1)}</h2>
              <button onClick={() => setEditing(null)} data-testid={`${testidPrefix}-modal-close`}><X size={18} /></button>
            </div>
            <div className="p-6 space-y-4">
              {fields.map((f) => (
                <div key={f.key}>
                  <label className="block text-xs font-mono uppercase tracking-wider text-[var(--ink-soft)] mb-1.5">{f.label}{f.helper && <span className="ml-2 normal-case font-sans text-[10px] text-[var(--ink-soft)]">{f.helper}</span>}</label>
                  {f.type === "textarea" || f.type === "array" ? (
                    <textarea
                      data-testid={`${testidPrefix}-field-${f.key}`}
                      rows={f.rows || 4}
                      value={form[f.key] || ""}
                      onChange={(e) => setForm({ ...form, [f.key]: e.target.value })}
                      className="w-full bg-[var(--paper-surface)] border border-[var(--line)] px-3 py-2.5 text-sm font-mono focus:outline-none focus:border-[var(--brand-teal)]"
                    />
                  ) : f.type === "boolean" ? (
                    <label className="flex items-center gap-2 text-sm"><input type="checkbox" data-testid={`${testidPrefix}-field-${f.key}`} checked={!!form[f.key]} onChange={(e) => setForm({ ...form, [f.key]: e.target.checked })} /> {f.label.toLowerCase()}</label>
                  ) : f.type === "image" ? (
                    <ImageUploader
                      testid={`${testidPrefix}-field-${f.key}`}
                      value={form[f.key] || ""}
                      onChange={(v) => setForm({ ...form, [f.key]: v })}
                      folder={imageFolder}
                    />
                  ) : f.type === "select" ? (
                    <select
                      data-testid={`${testidPrefix}-field-${f.key}`}
                      value={form[f.key] ?? ""}
                      onChange={(e) => setForm({ ...form, [f.key]: e.target.value })}
                      className="w-full bg-[var(--paper-surface)] border border-[var(--line)] px-3 py-2.5 text-sm focus:outline-none focus:border-[var(--brand-teal)]"
                    >
                      {(f.options || []).map((o) => <option key={o} value={o}>{o}</option>)}
                    </select>
                  ) : (
                    <input
                      data-testid={`${testidPrefix}-field-${f.key}`}
                      type={f.type === "number" ? "number" : "text"}
                      value={form[f.key] ?? ""}
                      onChange={(e) => setForm({ ...form, [f.key]: e.target.value })}
                      className="w-full bg-[var(--paper-surface)] border border-[var(--line)] px-3 py-2.5 text-sm focus:outline-none focus:border-[var(--brand-teal)]"
                    />
                  )}
                </div>
              ))}
            </div>
            <div className="px-6 py-4 border-t border-[var(--line)] flex justify-end gap-2">
              <button onClick={() => setEditing(null)} className="btn-ghost">Cancel</button>
              <button onClick={save} data-testid={`${testidPrefix}-save`} className="btn-accent">Save</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function renderCell(v) {
  if (v === null || v === undefined || v === "") return <span className="text-[var(--ink-soft)]">—</span>;
  if (typeof v === "boolean") return v ? <span className="text-emerald-600 font-mono text-xs">✓ active</span> : <span className="text-[var(--ink-soft)] font-mono text-xs">inactive</span>;
  if (Array.isArray(v)) return <span className="text-[var(--ink-soft)] font-mono text-xs">{v.length} items</span>;
  const s = String(v);
  return s.length > 80 ? s.slice(0, 80) + "…" : s;
}
