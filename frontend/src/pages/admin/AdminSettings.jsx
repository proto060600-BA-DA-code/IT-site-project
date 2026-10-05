import { useCallback, useEffect, useState } from "react";
import { api } from "@/lib/api";
import { toast } from "sonner";
import { FloppyDisk } from "@phosphor-icons/react";

/**
 * Generic editor for the site-settings single type. The form is generated from
 * the schema the backend returns, so adding a field server-side makes it
 * editable here with no frontend change.
 */
export default function AdminSettings() {
  const [groups, setGroups] = useState([]);
  const [values, setValues] = useState({});
  const [dirty, setDirty] = useState(false);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    try {
      const [s, v] = await Promise.all([
        api.get("/admin/settings/schema"),
        api.get("/admin/settings"),
      ]);
      setGroups(s.data.groups);
      setValues(v.data);
      setDirty(false);
    } catch (e) {
      toast.error(e?.response?.data?.detail || "Could not load settings");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  const set = (k, v) => { setValues((s) => ({ ...s, [k]: v })); setDirty(true); };

  const save = async () => {
    try {
      const r = await api.put("/admin/settings", values);
      setValues(r.data);
      setDirty(false);
      toast.success("Settings saved — refresh the site to see them");
    } catch (e) {
      toast.error(e?.response?.data?.detail || "Save failed");
    }
  };

  return (
    <div data-testid="admin-settings-page">
      <div className="flex items-end justify-between mb-6 gap-4 flex-wrap">
        <div>
          <div className="eyebrow mb-2">Configure</div>
          <h1 className="text-3xl tracking-tight">Site settings</h1>
          <p className="text-sm text-[var(--ink-soft)] mt-1">
            Every string outside a page block — header strip, logo, footer, contact details.
          </p>
        </div>
        <button onClick={save} disabled={!dirty} data-testid="settings-save" className="btn-accent disabled:opacity-40">
          <FloppyDisk size={14} weight="bold" /> {dirty ? "Save changes" : "Saved"}
        </button>
      </div>

      {loading ? (
        <div className="p-12 text-center text-[var(--ink-soft)] text-sm">Loading…</div>
      ) : (
        <div className="space-y-4 max-w-3xl">
          {groups.map((g) => (
            <div key={g.group} className="bg-white border border-[var(--line)]">
              <div className="px-5 py-3 border-b border-[var(--line)] text-[10px] font-mono uppercase tracking-wider text-[var(--ink-soft)]">
                {g.group}
              </div>
              <div className="p-5 space-y-4">
                {g.fields.map((f) => (
                  <div key={f.key}>
                    {f.type === "boolean" ? (
                      <label className="flex items-center gap-2 text-sm">
                        <input
                          type="checkbox"
                          data-testid={`setting-${f.key}`}
                          checked={!!values[f.key]}
                          onChange={(e) => set(f.key, e.target.checked)}
                        />
                        {f.label}
                      </label>
                    ) : (
                      <>
                        <label className="block text-xs font-mono uppercase tracking-wider text-[var(--ink-soft)] mb-1.5">
                          {f.label}
                        </label>
                        {f.type === "textarea" ? (
                          <textarea
                            data-testid={`setting-${f.key}`}
                            rows={f.rows || 3}
                            value={values[f.key] ?? ""}
                            onChange={(e) => set(f.key, e.target.value)}
                            className={inputCls}
                          />
                        ) : (
                          <input
                            data-testid={`setting-${f.key}`}
                            type={f.type === "number" ? "number" : "text"}
                            min={f.type === "number" ? 0 : undefined}
                            value={values[f.key] ?? ""}
                            onChange={(e) => set(f.key, e.target.value)}
                            className={`${inputCls} ${f.type === "number" ? "max-w-[10rem]" : ""}`}
                          />
                        )}
                      </>
                    )}
                    {f.help && (
                      <p className={`text-[11px] mt-1.5 leading-relaxed ${
                        !values[f.key] && /required/i.test(f.help) ? "text-amber-700" : "text-[var(--ink-soft)]"
                      }`}>
                        {!values[f.key] && /required/i.test(f.help) ? "Not set — " : ""}{f.help}
                      </p>
                    )}
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

const inputCls =
  "w-full bg-[var(--paper-surface)] border border-[var(--line)] px-3 py-2.5 text-sm focus:outline-none focus:border-[var(--brand-ink)]";
