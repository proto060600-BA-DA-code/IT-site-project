import { useCallback, useEffect, useState } from "react";
import { api } from "@/lib/api";
import { toast } from "sonner";
import { Plus, Trash, LockSimple, FloppyDisk } from "@phosphor-icons/react";
import { Modal, Field } from "./AdminUsers";

/**
 * Role editor with a per-resource create/read/update/delete matrix.
 *
 * The `admin` role renders locked: the backend forces it to full permissions
 * whatever is sent, so letting it be edited here would only ever mislead.
 */
export default function AdminRoles() {
  const [roles, setRoles] = useState([]);
  const [schema, setSchema] = useState({ resources: [], actions: [] });
  const [selected, setSelected] = useState(null);
  const [draft, setDraft] = useState(null);
  const [dirty, setDirty] = useState(false);
  const [creating, setCreating] = useState(false);
  const [newRole, setNewRole] = useState({ name: "", description: "" });

  const load = useCallback(async () => {
    try {
      const [r, s] = await Promise.all([
        api.get("/admin/roles"),
        api.get("/admin/permissions/schema"),
      ]);
      setRoles(r.data);
      setSchema(s.data);
      setSelected((cur) => cur ? r.data.find((x) => x.id === cur.id) || r.data[0] : r.data[0]);
    } catch (e) {
      toast.error(e?.response?.data?.detail || "Could not load roles");
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  useEffect(() => {
    if (selected) { setDraft(JSON.parse(JSON.stringify(selected.permissions || {}))); setDirty(false); }
  }, [selected]);

  const locked = selected?.slug === "admin";

  const toggle = (resource, action) => {
    if (locked) return;
    setDraft((d) => ({
      ...d,
      [resource]: { ...(d[resource] || {}), [action]: !d?.[resource]?.[action] },
    }));
    setDirty(true);
  };

  const toggleRow = (resource, value) => {
    if (locked) return;
    setDraft((d) => ({
      ...d,
      [resource]: schema.actions.reduce((acc, a) => ({ ...acc, [a]: value }), {}),
    }));
    setDirty(true);
  };

  const toggleColumn = (action, value) => {
    if (locked) return;
    setDraft((d) => {
      const next = { ...d };
      schema.resources.forEach((r) => {
        next[r] = { ...(next[r] || {}), [action]: value };
      });
      return next;
    });
    setDirty(true);
  };

  const save = async () => {
    try {
      await api.put(`/admin/roles/${selected.id}`, {
        name: selected.name,
        description: selected.description,
        permissions: draft,
      });
      toast.success(`${selected.name} permissions saved`);
      setDirty(false);
      await load();
    } catch (e) {
      toast.error(e?.response?.data?.detail || "Save failed");
    }
  };

  const create = async () => {
    if (!newRole.name.trim()) return toast.error("Give the role a name");
    try {
      const res = await api.post("/admin/roles", newRole);
      toast.success("Role created");
      setCreating(false);
      setNewRole({ name: "", description: "" });
      await load();
      setSelected(res.data);
    } catch (e) {
      toast.error(e?.response?.data?.detail || "Could not create role");
    }
  };

  const remove = async (role) => {
    if (!window.confirm(`Delete the "${role.name}" role?`)) return;
    try {
      await api.delete(`/admin/roles/${role.id}`);
      toast.success("Role deleted");
      setSelected(null);
      await load();
    } catch (e) {
      toast.error(e?.response?.data?.detail || "Could not delete role");
    }
  };

  const grantedCount = (perms) =>
    Object.values(perms || {}).reduce((n, r) => n + Object.values(r).filter(Boolean).length, 0);

  return (
    <div data-testid="admin-roles-page">
      <div className="flex items-end justify-between mb-6 gap-4 flex-wrap">
        <div>
          <div className="eyebrow mb-2">Manage</div>
          <h1 className="text-3xl tracking-tight">Roles &amp; permissions</h1>
        </div>
        <div className="flex gap-2">
          <button onClick={() => setCreating(true)} data-testid="role-new" className="btn-ghost">
            <Plus size={14} weight="bold" /> New role
          </button>
          <button onClick={save} disabled={!dirty || locked} data-testid="role-save" className="btn-accent disabled:opacity-40">
            <FloppyDisk size={14} weight="bold" /> {dirty ? "Save changes" : "Saved"}
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Role list */}
        <div className="lg:col-span-3 bg-white border border-[var(--line)]">
          {roles.map((r) => (
            <button
              key={r.id}
              onClick={() => setSelected(r)}
              data-testid={`role-${r.slug}`}
              className={`w-full text-left px-4 py-3 border-b border-[var(--line)] last:border-0 transition-colors ${
                selected?.id === r.id ? "bg-[var(--brand-ink)] text-[var(--off-white)]" : "hover:bg-[var(--paper-surface)]"
              }`}
            >
              <div className="flex items-center justify-between gap-2">
                <span className="text-sm font-medium">{r.name}</span>
                {r.system && <LockSimple size={12} className={selected?.id === r.id ? "text-[var(--gold)]" : "text-[var(--ink-soft)]"} />}
              </div>
              <div className={`text-[11px] mt-0.5 ${selected?.id === r.id ? "on-dark-muted" : "text-[var(--ink-soft)]"}`}>
                {grantedCount(r.permissions)} permissions
              </div>
            </button>
          ))}
        </div>

        {/* Matrix */}
        <div className="lg:col-span-9">
          {selected ? (
            <div className="bg-white border border-[var(--line)]">
              <div className="px-5 py-4 border-b border-[var(--line)] flex items-start justify-between gap-4">
                <div>
                  <h2 className="text-lg tracking-tight">{selected.name}</h2>
                  <p className="text-xs text-[var(--ink-soft)] mt-1">{selected.description || "No description"}</p>
                </div>
                {!selected.system && (
                  <button onClick={() => remove(selected)} className="text-xs text-red-600 hover:underline inline-flex items-center gap-1">
                    <Trash size={12} /> Delete role
                  </button>
                )}
              </div>

              {locked && (
                <div className="px-5 py-3 bg-[var(--paper-surface)] border-b border-[var(--line)] text-xs text-[var(--ink-soft)] flex items-center gap-2">
                  <LockSimple size={13} />
                  The Administrator role always holds every permission. This is deliberate — it is what stops a bad edit locking everyone out of the site.
                </div>
              )}

              <div className="overflow-x-auto">
                <table className="w-full text-sm" data-testid="permission-matrix">
                  <thead className="bg-[var(--paper-surface)] border-b border-[var(--line)]">
                    <tr>
                      <th className="text-left text-[10px] font-mono uppercase tracking-wider text-[var(--ink-soft)] px-5 py-3">Resource</th>
                      {schema.actions.map((a) => (
                        <th key={a} className="px-3 py-3 w-24">
                          <div className="text-[10px] font-mono uppercase tracking-wider text-[var(--ink-soft)]">{a}</div>
                          {!locked && (
                            <div className="flex justify-center gap-1 mt-1">
                              <button onClick={() => toggleColumn(a, true)} className="text-[9px] hover:underline text-[var(--brand-ink)]">all</button>
                              <span className="text-[9px] text-[var(--ink-soft)]">/</span>
                              <button onClick={() => toggleColumn(a, false)} className="text-[9px] hover:underline text-[var(--ink-soft)]">none</button>
                            </div>
                          )}
                        </th>
                      ))}
                      <th className="w-20" />
                    </tr>
                  </thead>
                  <tbody>
                    {schema.resources.map((res) => {
                      const row = (locked ? null : draft?.[res]) || {};
                      const all = schema.actions.every((a) => (locked ? true : row[a]));
                      return (
                        <tr key={res} className="border-b border-[var(--line)] last:border-0">
                          <td className="px-5 py-2.5 capitalize">{res}</td>
                          {schema.actions.map((a) => (
                            <td key={a} className="px-3 py-2.5 text-center">
                              <input
                                type="checkbox"
                                data-testid={`perm-${res}-${a}`}
                                checked={locked ? true : !!row[a]}
                                disabled={locked}
                                onChange={() => toggle(res, a)}
                                className="w-4 h-4 accent-[var(--brand-ink)] disabled:opacity-50"
                              />
                            </td>
                          ))}
                          <td className="px-3 py-2.5 text-right">
                            {!locked && (
                              <button onClick={() => toggleRow(res, !all)} className="text-[10px] text-[var(--ink-soft)] hover:underline">
                                {all ? "clear" : "all"}
                              </button>
                            )}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          ) : (
            <div className="bg-white border border-[var(--line)] p-12 text-center text-[var(--ink-soft)]">
              Select a role to edit its permissions.
            </div>
          )}
        </div>
      </div>

      {creating && (
        <Modal title="New role" onClose={() => setCreating(false)} onSave={create} saveLabel="Create" testid="role-modal">
          <Field label="Name">
            <input data-testid="role-field-name" value={newRole.name} onChange={(e) => setNewRole({ ...newRole, name: e.target.value })}
              className="w-full bg-[var(--paper-surface)] border border-[var(--line)] px-3 py-2.5 text-sm focus:outline-none focus:border-[var(--brand-ink)]" />
          </Field>
          <Field label="Description">
            <textarea rows={2} value={newRole.description} onChange={(e) => setNewRole({ ...newRole, description: e.target.value })}
              className="w-full bg-[var(--paper-surface)] border border-[var(--line)] px-3 py-2.5 text-sm focus:outline-none focus:border-[var(--brand-ink)]" />
          </Field>
          <p className="text-xs text-[var(--ink-soft)]">
            New roles start with no permissions. Tick what they need on the matrix afterwards.
          </p>
        </Modal>
      )}
    </div>
  );
}
