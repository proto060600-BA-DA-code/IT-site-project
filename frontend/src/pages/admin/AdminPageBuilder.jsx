import { useCallback, useEffect, useState } from "react";
import { api } from "@/lib/api";
import { toast } from "sonner";
import {
  Plus, Trash, Copy, Eye, EyeSlash, FloppyDisk, CaretDown, CaretRight,
  ArrowCounterClockwise, X,
} from "@phosphor-icons/react";
import { SortableList, SortableItem, DragHandle } from "@/components/admin/Sortable";
import ImageUploader from "@/components/ImageUploader";

/**
 * Dynamic-zone page builder.
 *
 * A layout is just an ordered array of block instances, so add / duplicate /
 * remove / reorder / hide are all local edits to that array — nothing is
 * persisted until Save, which writes the whole list in one request.
 */
export default function AdminPageBuilder() {
  const [pages, setPages] = useState([]);
  const [catalogue, setCatalogue] = useState([]);
  const [page, setPage] = useState("home");
  const [blocks, setBlocks] = useState([]);
  const [open, setOpen] = useState({});
  const [dirty, setDirty] = useState(false);
  const [adding, setAdding] = useState(false);
  const [loading, setLoading] = useState(true);

  const loadCatalogue = useCallback(async () => {
    try {
      const r = await api.get("/admin/layouts/block-types");
      setPages(r.data.pages);
      setCatalogue(r.data.blocks);
    } catch (e) {
      toast.error("Could not load the block catalogue");
    }
  }, []);

  const loadLayout = useCallback(async (p) => {
    setLoading(true);
    try {
      const r = await api.get(`/admin/layouts/${p}`);
      setBlocks(r.data.blocks || []);
      setDirty(false);
    } catch (e) {
      toast.error(e?.response?.data?.detail || "Could not load the layout");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { loadCatalogue(); }, [loadCatalogue]);
  useEffect(() => { loadLayout(page); }, [page, loadLayout]);

  const def = (type) => catalogue.find((b) => b.type === type);

  const mutate = (fn) => { setBlocks(fn); setDirty(true); };

  const addBlock = (type) => {
    const meta = def(type);
    if (meta?.singleton && blocks.some((b) => b.type === type)) {
      toast.error(`${meta.label} can only appear once on a page`);
      return;
    }
    const id = `blk_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;
    mutate((b) => [...b, { id, type, props: {}, visible: true }]);
    setOpen((o) => ({ ...o, [id]: true }));
    setAdding(false);
  };

  const duplicate = (block) => {
    const meta = def(block.type);
    if (meta?.singleton) { toast.error(`${meta.label} can only appear once`); return; }
    const copy = {
      ...JSON.parse(JSON.stringify(block)),
      id: `blk_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
    };
    mutate((b) => {
      const i = b.findIndex((x) => x.id === block.id);
      return [...b.slice(0, i + 1), copy, ...b.slice(i + 1)];
    });
  };

  const removeBlock = (id) => mutate((b) => b.filter((x) => x.id !== id));
  const toggleVisible = (id) =>
    mutate((b) => b.map((x) => (x.id === id ? { ...x, visible: !x.visible } : x)));
  const setProp = (id, key, value) =>
    mutate((b) => b.map((x) => (x.id === id ? { ...x, props: { ...x.props, [key]: value } } : x)));

  const save = async () => {
    try {
      await api.put(`/admin/layouts/${page}`, { blocks, published: true });
      toast.success("Layout saved");
      setDirty(false);
    } catch (e) {
      toast.error(e?.response?.data?.detail || "Save failed");
    }
  };

  const reset = async () => {
    if (!window.confirm(`Reset the ${page} page to its built-in layout? Your arrangement will be lost.`)) return;
    try {
      await api.delete(`/admin/layouts/${page}`);
      toast.success("Reset to the built-in layout");
      await loadLayout(page);
    } catch (e) {
      toast.error("Reset failed");
    }
  };

  return (
    <div data-testid="admin-pagebuilder">
      <div className="flex items-end justify-between mb-6 gap-4 flex-wrap">
        <div>
          <div className="eyebrow mb-2">Compose</div>
          <h1 className="text-3xl tracking-tight">Page builder</h1>
          <p className="text-sm text-[var(--ink-soft)] mt-1">
            Drag to reorder. Hidden blocks stay saved but don't render.
          </p>
        </div>
        <div className="flex gap-2 items-center">
          <select
            value={page}
            onChange={(e) => {
              if (dirty && !window.confirm("You have unsaved changes. Switch page anyway?")) return;
              setPage(e.target.value);
            }}
            data-testid="pagebuilder-page"
            className="bg-white border border-[var(--line)] px-3 py-2 text-sm capitalize focus:outline-none focus:border-[var(--brand-ink)]"
          >
            {pages.map((p) => <option key={p} value={p}>{p}</option>)}
          </select>
          <button onClick={reset} className="btn-ghost !py-2 !px-4 text-sm">
            <ArrowCounterClockwise size={14} /> Reset
          </button>
          <button onClick={() => setAdding(true)} data-testid="pagebuilder-add" className="btn-ghost !py-2 !px-4 text-sm">
            <Plus size={14} weight="bold" /> Add block
          </button>
          <button onClick={save} disabled={!dirty} data-testid="pagebuilder-save" className="btn-accent !py-2 !px-4 text-sm disabled:opacity-40">
            <FloppyDisk size={14} weight="bold" /> {dirty ? "Save layout" : "Saved"}
          </button>
        </div>
      </div>

      {loading ? (
        <div className="p-12 text-center text-[var(--ink-soft)] text-sm">Loading…</div>
      ) : blocks.length === 0 ? (
        <div className="border border-dashed border-[var(--line)] p-16 text-center">
          <p className="text-sm text-[var(--ink-soft)]">
            No blocks on this page yet. It will render its built-in layout until you add one.
          </p>
          <button onClick={() => setAdding(true)} className="btn-accent mt-5 inline-flex"><Plus size={14} weight="bold" /> Add the first block</button>
        </div>
      ) : (
        <SortableList items={blocks} onReorder={(next) => mutate(() => next)}>
          <div className="space-y-2">
            {blocks.map((block, i) => {
              const meta = def(block.type);
              const expanded = !!open[block.id];
              return (
                <SortableItem key={block.id} id={block.id} className="bg-white border border-[var(--line)]">
                  {({ handleProps }) => (
                    <>
                      <div className="flex items-center gap-3 px-3 py-3">
                        <DragHandle handleProps={handleProps} />
                        <button
                          onClick={() => setOpen((o) => ({ ...o, [block.id]: !expanded }))}
                          className="flex-1 flex items-center gap-2 text-left min-w-0"
                          data-testid={`block-toggle-${block.id}`}
                        >
                          {expanded ? <CaretDown size={13} /> : <CaretRight size={13} />}
                          <span className="text-[10px] font-mono text-[var(--ink-soft)] w-6">{String(i + 1).padStart(2, "0")}</span>
                          <span className={`text-sm font-medium truncate ${block.visible ? "" : "line-through text-[var(--ink-soft)]"}`}>
                            {meta?.label || block.type}
                          </span>
                          {block.props?.title && (
                            <span className="text-xs text-[var(--ink-soft)] truncate hidden sm:inline">— {block.props.title}</span>
                          )}
                          {meta?.singleton && (
                            <span className="text-[9px] font-mono uppercase tracking-wider text-[var(--ink-soft)] border border-[var(--line)] px-1.5 py-0.5">once</span>
                          )}
                        </button>

                        <button onClick={() => toggleVisible(block.id)} title={block.visible ? "Hide" : "Show"}
                          data-testid={`block-visible-${block.id}`}
                          className={block.visible ? "text-[var(--brand-ink)]" : "text-[var(--ink-soft)]"}>
                          {block.visible ? <Eye size={15} /> : <EyeSlash size={15} />}
                        </button>
                        <button onClick={() => duplicate(block)} title="Duplicate" className="text-[var(--ink-soft)] hover:text-[var(--ink)]">
                          <Copy size={15} />
                        </button>
                        <button onClick={() => removeBlock(block.id)} title="Remove"
                          data-testid={`block-remove-${block.id}`} className="text-[var(--ink-soft)] hover:text-red-600">
                          <Trash size={15} />
                        </button>
                      </div>

                      {expanded && meta && (
                        <div className="border-t border-[var(--line)] p-5 space-y-4 bg-[var(--paper-surface)]">
                          <p className="text-xs text-[var(--ink-soft)]">{meta.description}</p>
                          {meta.fields.map((f) => (
                            <BlockField
                              key={f.key}
                              field={f}
                              value={block.props?.[f.key]}
                              onChange={(v) => setProp(block.id, f.key, v)}
                              testid={`block-${block.id}-${f.key}`}
                            />
                          ))}
                        </div>
                      )}
                    </>
                  )}
                </SortableItem>
              );
            })}
          </div>
        </SortableList>
      )}

      {adding && (
        <div className="fixed inset-0 bg-black/40 z-50 flex items-start justify-center p-6 overflow-y-auto">
          <div className="bg-white border border-[var(--line)] w-full max-w-3xl my-10">
            <div className="px-6 py-4 border-b border-[var(--line)] flex items-center justify-between">
              <h2 className="text-lg tracking-tight">Add a block</h2>
              <button onClick={() => setAdding(false)}><X size={18} /></button>
            </div>
            <div className="p-6 grid grid-cols-1 sm:grid-cols-2 gap-3">
              {catalogue.map((b) => {
                const used = b.singleton && blocks.some((x) => x.type === b.type);
                return (
                  <button
                    key={b.type}
                    onClick={() => addBlock(b.type)}
                    disabled={used}
                    data-testid={`add-block-${b.type}`}
                    className="text-left border border-[var(--line)] p-4 hover:border-[var(--brand-ink)] transition-colors disabled:opacity-40 disabled:hover:border-[var(--line)]"
                  >
                    <div className="text-sm font-medium">{b.label}</div>
                    <div className="text-xs text-[var(--ink-soft)] mt-1">{b.description}</div>
                    {used && <div className="text-[10px] font-mono uppercase tracking-wider text-[var(--gold)] mt-2">already on this page</div>}
                  </button>
                );
              })}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

const inputCls =
  "w-full bg-white border border-[var(--line)] px-3 py-2.5 text-sm focus:outline-none focus:border-[var(--brand-ink)]";

function BlockField({ field, value, onChange, testid }) {
  const label = (
    <label className="block text-xs font-mono uppercase tracking-wider text-[var(--ink-soft)] mb-1.5">
      {field.label}
    </label>
  );

  if (field.type === "boolean") {
    return (
      <label className="flex items-center gap-2 text-sm">
        <input type="checkbox" data-testid={testid} checked={!!value} onChange={(e) => onChange(e.target.checked)} />
        {field.label}
      </label>
    );
  }

  if (field.type === "image") {
    return <div>{label}<ImageUploader value={value || ""} onChange={onChange} folder="pages" testid={testid} /></div>;
  }

  if (field.type === "textarea") {
    return (
      <div>{label}
        <textarea data-testid={testid} rows={field.rows || 3} value={value || ""}
          onChange={(e) => onChange(e.target.value)} className={inputCls} />
      </div>
    );
  }

  if (field.type === "select") {
    return (
      <div>{label}
        <select data-testid={testid} value={value || ""} onChange={(e) => onChange(e.target.value)} className={inputCls}>
          <option value="">—</option>
          {(field.options || []).map((o) => <option key={o} value={o}>{o}</option>)}
        </select>
      </div>
    );
  }

  if (field.type === "array") {
    return (
      <div>{label}
        <textarea data-testid={testid} rows={4}
          value={Array.isArray(value) ? value.join("\n") : value || ""}
          onChange={(e) => onChange(e.target.value.split("\n").map((s) => s.trim()).filter(Boolean))}
          placeholder="One per line"
          className={`${inputCls} font-mono text-xs`} />
      </div>
    );
  }

  if (field.type === "repeater") {
    const rows = Array.isArray(value) ? value : [];
    const update = (i, k, v) => onChange(rows.map((r, idx) => (idx === i ? { ...r, [k]: v } : r)));
    return (
      <div>
        {label}
        <div className="space-y-2">
          {rows.map((row, i) => (
            <div key={i} className="border border-[var(--line)] bg-white p-3 space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-[10px] font-mono uppercase tracking-wider text-[var(--ink-soft)]">Item {i + 1}</span>
                <button onClick={() => onChange(rows.filter((_, idx) => idx !== i))}
                  className="text-[var(--ink-soft)] hover:text-red-600"><Trash size={13} /></button>
              </div>
              {field.item_fields.map((f) =>
                f.type === "textarea" ? (
                  <textarea key={f.key} rows={f.rows || 2} placeholder={f.label} value={row[f.key] || ""}
                    onChange={(e) => update(i, f.key, e.target.value)} className={`${inputCls} !py-2`} />
                ) : (
                  <input key={f.key} placeholder={f.label} value={row[f.key] || ""}
                    onChange={(e) => update(i, f.key, e.target.value)} className={`${inputCls} !py-2`} />
                )
              )}
            </div>
          ))}
          <button onClick={() => onChange([...rows, {}])} className="text-xs text-[var(--brand-ink)] hover:underline inline-flex items-center gap-1">
            <Plus size={12} weight="bold" /> Add item
          </button>
        </div>
      </div>
    );
  }

  return (
    <div>{label}
      <input data-testid={testid} value={value || ""} onChange={(e) => onChange(e.target.value)} className={inputCls} />
    </div>
  );
}
