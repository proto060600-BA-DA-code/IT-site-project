import { useCallback, useEffect, useState } from "react";
import { api } from "@/lib/api";
import { toast } from "sonner";
import { useAuth } from "@/contexts/AuthContext";
import {
  Plus, PencilSimple, Trash, X, Key, ShieldCheck, CheckCircle, Prohibit,
} from "@phosphor-icons/react";

const EMPTY = { name: "", email: "", password: "", role_id: "", active: true };

export default function AdminUsers() {
  const { user: me } = useAuth();
  const [users, setUsers] = useState([]);
  const [roles, setRoles] = useState([]);
  const [editing, setEditing] = useState(null); // null | "new" | user
  const [form, setForm] = useState(EMPTY);
  const [pwFor, setPwFor] = useState(null);
  const [pw, setPw] = useState("");
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    try {
      const [u, r] = await Promise.all([api.get("/admin/users"), api.get("/admin/roles")]);
      setUsers(u.data);
      setRoles(r.data);
    } catch (e) {
      toast.error(e?.response?.data?.detail || "Could not load users");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  const startNew = () => { setForm(EMPTY); setEditing("new"); };
  const startEdit = (u) => {
    setForm({ name: u.name, email: u.email, password: "", role_id: u.role_id || "", active: u.active !== false });
    setEditing(u);
  };

  const save = async () => {
    try {
      if (editing === "new") {
        if (form.password.length < 8) return toast.error("Password must be at least 8 characters");
        await api.post("/admin/users", {
          name: form.name, email: form.email, password: form.password,
          role_id: form.role_id || null, active: form.active,
        });
        toast.success("User created");
      } else {
        await api.put(`/admin/users/${editing.id}`, {
          name: form.name, email: form.email,
          role_id: form.role_id || null, active: form.active,
        });
        toast.success("User updated");
      }
      setEditing(null);
      await load();
    } catch (e) {
      toast.error(e?.response?.data?.detail || "Save failed");
    }
  };

  const resetPassword = async () => {
    if (pw.length < 8) return toast.error("Password must be at least 8 characters");
    try {
      await api.post(`/admin/users/${pwFor.id}/password`, { password: pw });
      toast.success(`Password reset for ${pwFor.name}`);
      setPwFor(null); setPw("");
    } catch (e) {
      toast.error(e?.response?.data?.detail || "Reset failed");
    }
  };

  const remove = async (u) => {
    if (!window.confirm(`Delete ${u.name}? This cannot be undone.`)) return;
    try {
      await api.delete(`/admin/users/${u.id}`);
      toast.success("User deleted");
      await load();
    } catch (e) {
      toast.error(e?.response?.data?.detail || "Delete failed");
    }
  };

  const toggleActive = async (u) => {
    try {
      await api.put(`/admin/users/${u.id}`, { active: !(u.active !== false) });
      await load();
    } catch (e) {
      toast.error(e?.response?.data?.detail || "Could not change status");
    }
  };

  return (
    <div data-testid="admin-users-page">
      <div className="flex items-end justify-between mb-6 gap-4 flex-wrap">
        <div>
          <div className="eyebrow mb-2">Manage</div>
          <h1 className="text-3xl tracking-tight">Users</h1>
          <p className="text-sm text-[var(--ink-soft)] mt-1">
            {users.length} account{users.length === 1 ? "" : "s"} · roles are edited under Roles &amp; permissions
          </p>
        </div>
        <button onClick={startNew} data-testid="user-new" className="btn-accent">
          <Plus size={14} weight="bold" /> New user
        </button>
      </div>

      <div className="bg-white border border-[var(--line)] overflow-x-auto">
        <table className="w-full text-sm" data-testid="user-table">
          <thead className="bg-[var(--paper-surface)] border-b border-[var(--line)]">
            <tr>
              {["Name", "Email", "Role", "Status", "Last login"].map((h) => (
                <th key={h} className="text-left text-[10px] font-mono uppercase tracking-wider text-[var(--ink-soft)] px-4 py-3">{h}</th>
              ))}
              <th className="text-right text-[10px] font-mono uppercase tracking-wider text-[var(--ink-soft)] px-4 py-3 w-56">Actions</th>
            </tr>
          </thead>
          <tbody>
            {users.map((u) => (
              <tr key={u.id} data-testid={`user-row-${u.id}`} className="border-b border-[var(--line)] last:border-0 hover:bg-[var(--paper-surface)]">
                <td className="px-4 py-3">
                  {u.name}
                  {u.id === me?.id && <span className="ml-2 text-[10px] font-mono uppercase tracking-wider text-[var(--gold)]">you</span>}
                </td>
                <td className="px-4 py-3 font-mono text-xs text-[var(--ink-soft)]">{u.email}</td>
                <td className="px-4 py-3">
                  {u.role_name ? (
                    <span className="inline-flex items-center gap-1.5 text-xs">
                      <ShieldCheck size={13} className="text-[var(--brand-ink)]" /> {u.role_name}
                    </span>
                  ) : (
                    <span className="text-xs text-[var(--ink-soft)]">No role</span>
                  )}
                </td>
                <td className="px-4 py-3">
                  {u.active !== false
                    ? <span className="text-emerald-600 font-mono text-xs">✓ active</span>
                    : <span className="text-red-600 font-mono text-xs">suspended</span>}
                </td>
                <td className="px-4 py-3 font-mono text-xs text-[var(--ink-soft)]">
                  {u.last_login ? u.last_login.slice(0, 10) : "—"}
                </td>
                <td className="px-4 py-3 text-right whitespace-nowrap">
                  <button onClick={() => startEdit(u)} data-testid={`user-edit-${u.id}`} className="inline-flex items-center gap-1 text-xs text-[var(--brand-ink)] mr-3 hover:underline"><PencilSimple size={12} /> Edit</button>
                  <button onClick={() => { setPwFor(u); setPw(""); }} data-testid={`user-password-${u.id}`} className="inline-flex items-center gap-1 text-xs text-[var(--brand-ink)] mr-3 hover:underline"><Key size={12} /> Password</button>
                  <button onClick={() => toggleActive(u)} disabled={u.id === me?.id} className="inline-flex items-center gap-1 text-xs text-[var(--ink-soft)] mr-3 hover:underline disabled:opacity-30 disabled:no-underline">
                    {u.active !== false ? <><Prohibit size={12} /> Suspend</> : <><CheckCircle size={12} /> Restore</>}
                  </button>
                  <button onClick={() => remove(u)} disabled={u.id === me?.id} data-testid={`user-delete-${u.id}`} className="inline-flex items-center gap-1 text-xs text-red-600 hover:underline disabled:opacity-30 disabled:no-underline"><Trash size={12} /> Delete</button>
                </td>
              </tr>
            ))}
            {!loading && users.length === 0 && (
              <tr><td colSpan={6} className="px-4 py-12 text-center text-[var(--ink-soft)]">No users yet.</td></tr>
            )}
          </tbody>
        </table>
      </div>

      {editing && (
        <Modal title={editing === "new" ? "New user" : `Edit ${editing.name}`} onClose={() => setEditing(null)} onSave={save} testid="user-modal">
          <Field label="Full name">
            <input data-testid="user-field-name" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} className={inputCls} />
          </Field>
          <Field label="Email">
            <input data-testid="user-field-email" type="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} className={inputCls} />
          </Field>
          {editing === "new" && (
            <Field label="Password" helper="minimum 8 characters">
              <input data-testid="user-field-password" type="password" value={form.password} onChange={(e) => setForm({ ...form, password: e.target.value })} className={inputCls} />
            </Field>
          )}
          <Field label="Role">
            <select data-testid="user-field-role" value={form.role_id} onChange={(e) => setForm({ ...form, role_id: e.target.value })} className={inputCls}>
              <option value="">— no role (no admin access) —</option>
              {roles.map((r) => <option key={r.id} value={r.id}>{r.name}</option>)}
            </select>
          </Field>
          <Field label="Active">
            <label className="flex items-center gap-2 text-sm">
              <input type="checkbox" checked={form.active} onChange={(e) => setForm({ ...form, active: e.target.checked })} />
              account can sign in
            </label>
          </Field>
        </Modal>
      )}

      {pwFor && (
        <Modal title={`Reset password — ${pwFor.name}`} onClose={() => setPwFor(null)} onSave={resetPassword} saveLabel="Reset password" testid="password-modal">
          <Field label="New password" helper="minimum 8 characters">
            <input data-testid="password-field" type="password" value={pw} onChange={(e) => setPw(e.target.value)} className={inputCls} />
          </Field>
          <p className="text-xs text-[var(--ink-soft)]">
            The user is not notified. Send them the new password yourself, over a channel you trust.
          </p>
        </Modal>
      )}
    </div>
  );
}

const inputCls =
  "w-full bg-[var(--paper-surface)] border border-[var(--line)] px-3 py-2.5 text-sm focus:outline-none focus:border-[var(--brand-ink)]";

export function Field({ label, helper, children }) {
  return (
    <div>
      <label className="block text-xs font-mono uppercase tracking-wider text-[var(--ink-soft)] mb-1.5">
        {label}
        {helper && <span className="ml-2 normal-case font-sans text-[10px]">{helper}</span>}
      </label>
      {children}
    </div>
  );
}

export function Modal({ title, children, onClose, onSave, saveLabel = "Save", testid, wide = false }) {
  return (
    <div className="fixed inset-0 bg-black/40 z-50 flex items-start justify-center p-6 overflow-y-auto" data-testid={testid}>
      <div className={`bg-white border border-[var(--line)] w-full ${wide ? "max-w-5xl" : "max-w-2xl"} my-10`}>
        <div className="px-6 py-4 border-b border-[var(--line)] flex items-center justify-between">
          <h2 className="text-lg tracking-tight">{title}</h2>
          <button onClick={onClose} data-testid={`${testid}-close`}><X size={18} /></button>
        </div>
        <div className="p-6 space-y-4">{children}</div>
        <div className="px-6 py-4 border-t border-[var(--line)] flex justify-end gap-2">
          <button onClick={onClose} className="btn-ghost">Cancel</button>
          {onSave && <button onClick={onSave} data-testid={`${testid}-save`} className="btn-accent">{saveLabel}</button>}
        </div>
      </div>
    </div>
  );
}
