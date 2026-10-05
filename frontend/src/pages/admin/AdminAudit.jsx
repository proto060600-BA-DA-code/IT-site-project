import { useCallback, useEffect, useState } from "react";
import { api } from "@/lib/api";
import { toast } from "sonner";
import { CaretDown, CaretRight } from "@phosphor-icons/react";

const RESOURCES = [
  "all", "services", "categories", "banners", "clients", "pages", "posts", "leads",
  "media", "layouts", "settings", "users", "roles",
];

/** Read-only view of every admin write. The API exposes GET only. */
export default function AdminAudit() {
  const [items, setItems] = useState([]);
  const [next, setNext] = useState(null);
  const [resource, setResource] = useState("all");
  const [onlyFailed, setOnlyFailed] = useState(false);
  const [open, setOpen] = useState({});
  const [loading, setLoading] = useState(true);

  const load = useCallback(async (cursor) => {
    try {
      const p = new URLSearchParams({ limit: "100" });
      if (resource !== "all") p.set("resource", resource);
      if (onlyFailed) p.set("only_failed", "true");
      if (cursor) p.set("before", cursor);
      const r = await api.get(`/admin/audit?${p}`);
      setItems((cur) => (cursor ? [...cur, ...r.data.items] : r.data.items));
      setNext(r.data.next);
    } catch (e) {
      toast.error(e?.response?.data?.detail || "Could not load the audit log");
    } finally {
      setLoading(false);
    }
  }, [resource, onlyFailed]);

  useEffect(() => { setLoading(true); load(); }, [load]);

  return (
    <div data-testid="admin-audit-page">
      <div className="flex items-end justify-between mb-6 gap-4 flex-wrap">
        <div>
          <div className="eyebrow mb-2">Security</div>
          <h1 className="text-3xl tracking-tight">Audit log</h1>
          <p className="text-sm text-[var(--ink-soft)] mt-1">
            Every admin write — who, what, when. Read-only; entries cannot be edited or removed.
          </p>
        </div>
        <div className="flex items-center gap-3">
          <label className="flex items-center gap-2 text-sm text-[var(--ink-soft)]">
            <input type="checkbox" checked={onlyFailed} onChange={(e) => setOnlyFailed(e.target.checked)} />
            Denied / failed only
          </label>
          <select value={resource} onChange={(e) => setResource(e.target.value)} data-testid="audit-resource"
            className="bg-white border border-[var(--line)] px-3 py-2 text-sm capitalize">
            {RESOURCES.map((r) => <option key={r} value={r}>{r}</option>)}
          </select>
        </div>
      </div>

      <div className="bg-white border border-[var(--line)]">
        {loading ? (
          <div className="p-12 text-center text-sm text-[var(--ink-soft)]">Loading…</div>
        ) : items.length === 0 ? (
          <div className="p-12 text-center text-sm text-[var(--ink-soft)]">
            No entries yet. Every create, update and delete in the admin will appear here.
          </div>
        ) : (
          <div className="divide-y divide-[var(--line)]">
            {items.map((e) => {
              const hasDetail = Object.keys(e.changes || {}).length > 0 || e.before || e.payload;
              const expanded = !!open[e.id];
              return (
                <div key={e.id} data-testid={`audit-${e.id}`}>
                  <button
                    onClick={() => hasDetail && setOpen((o) => ({ ...o, [e.id]: !expanded }))}
                    className={`w-full text-left px-4 py-3 flex items-center gap-3 text-sm ${hasDetail ? "hover:bg-[var(--paper-surface)]" : "cursor-default"}`}
                  >
                    <span className="w-4 text-[var(--ink-soft)]">
                      {hasDetail ? (expanded ? <CaretDown size={12} /> : <CaretRight size={12} />) : null}
                    </span>
                    <span className="font-mono text-[11px] text-[var(--ink-soft)] w-36 shrink-0">
                      {(e.at || "").replace("T", " ").slice(0, 19)}
                    </span>
                    <span className="w-40 shrink-0 truncate">{e.actor_name || e.actor_email || "unknown"}</span>
                    <span className={`text-[10px] font-mono uppercase tracking-wider w-24 shrink-0 ${
                      !e.ok ? "text-red-600" : e.action.startsWith("delete") ? "text-red-600" : e.action.startsWith("create") ? "text-emerald-600" : "text-[var(--brand-ink)]"
                    }`}>
                      {e.action}
                    </span>
                    <span className="capitalize text-[var(--ink-soft)] w-24 shrink-0">{e.resource}</span>
                    <span className="truncate flex-1">{e.record_label || e.record_id || "—"}</span>
                    {!e.ok && (
                      <span className="text-[10px] font-mono text-red-600 shrink-0">
                        {e.status === 403 ? "DENIED" : `HTTP ${e.status}`}
                      </span>
                    )}
                  </button>
                  {expanded && (
                    <div className="px-11 pb-4 text-xs">
                      {Object.keys(e.changes || {}).length > 0 && (
                        <table className="w-full border border-[var(--line)]">
                          <thead className="bg-[var(--paper-surface)]">
                            <tr>
                              {["Field", "Before", "After"].map((h) => (
                                <th key={h} className="text-left px-3 py-2 font-mono uppercase tracking-wider text-[10px] text-[var(--ink-soft)]">{h}</th>
                              ))}
                            </tr>
                          </thead>
                          <tbody>
                            {Object.entries(e.changes).map(([k, [a, b]]) => (
                              <tr key={k} className="border-t border-[var(--line)] align-top">
                                <td className="px-3 py-2 font-mono">{k}</td>
                                <td className="px-3 py-2 text-red-700 break-all">{fmt(a)}</td>
                                <td className="px-3 py-2 text-emerald-700 break-all">{fmt(b)}</td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      )}
                      {e.before && (
                        <pre className="bg-[var(--paper-surface)] border border-[var(--line)] p-3 overflow-x-auto">
                          {JSON.stringify(e.before, null, 2)}
                        </pre>
                      )}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>

      {next && (
        <div className="mt-4 text-center">
          <button onClick={() => load(next)} className="btn-ghost !py-2 !px-4 text-sm">Load older</button>
        </div>
      )}
    </div>
  );
}

function fmt(v) {
  if (v === null || v === undefined || v === "") return "—";
  if (typeof v === "object") return JSON.stringify(v);
  return String(v);
}
