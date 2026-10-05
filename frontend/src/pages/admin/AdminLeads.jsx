import { Fragment, useCallback, useEffect, useState } from "react";
import { api } from "@/lib/api";
import { toast } from "sonner";
import { ShieldWarning, CheckCircle, UserMinus } from "@phosphor-icons/react";

const STATUSES = ["new", "contacted", "qualified", "closed"];

export default function AdminLeads() {
  const [leads, setLeads] = useState([]);
  const [expanded, setExpanded] = useState(null);
  const [filter, setFilter] = useState("all");
  const [eraseEmail, setEraseEmail] = useState("");

  const load = useCallback(
    () => api.get("/admin/leads").then((r) => setLeads(r.data)),
    []
  );
  useEffect(() => { load(); }, [load]);

  const setStatus = async (id, status) => {
    try {
      await api.put(`/admin/leads/${id}`, { status });
      toast.success(status === "new" ? "Released from spam" : "Status updated");
      load();
    } catch (e) {
      toast.error(e?.response?.data?.detail || "Could not update");
    }
  };

  const remove = async (id) => {
    if (!window.confirm("Delete this lead?")) return;
    try {
      await api.delete(`/admin/leads/${id}`);
      toast.success("Deleted");
      load();
    } catch (e) {
      toast.error(e?.response?.data?.detail || "Delete failed");
    }
  };

  const erase = async () => {
    const email = eraseEmail.trim();
    if (!email) return;
    if (!window.confirm(`Permanently erase every enquiry from ${email}? This cannot be undone.`)) return;
    try {
      const r = await api.post("/admin/leads/erase", { email });
      toast.success(`Erased ${r.data.deleted} record${r.data.deleted === 1 ? "" : "s"}`);
      setEraseEmail("");
      load();
    } catch (e) {
      toast.error(e?.response?.data?.detail || "Erasure failed");
    }
  };

  // Spam is never mixed into "All" — it gets its own queue.
  const real = leads.filter((l) => l.status !== "spam");
  const spam = leads.filter((l) => l.status === "spam");
  const filtered =
    filter === "all" ? real : filter === "spam" ? spam : leads.filter((l) => l.status === filter);

  return (
    <div data-testid="admin-leads-page">
      <div className="eyebrow mb-2">Pipeline</div>
      <h1 className="text-3xl tracking-tight mb-6">Leads</h1>

      <div className="flex flex-wrap gap-2 mb-5">
        <Chip label={`All (${real.length})`} active={filter === "all"} onClick={() => setFilter("all")} testid="leads-filter-all" />
        {STATUSES.map((s) => (
          <Chip key={s} label={`${s} (${leads.filter((l) => l.status === s).length})`} active={filter === s} onClick={() => setFilter(s)} testid={`leads-filter-${s}`} />
        ))}
        <Chip label={`Spam (${spam.length})`} active={filter === "spam"} onClick={() => setFilter("spam")} testid="leads-filter-spam" warn />
      </div>

      {filter === "spam" && (
        <p className="text-sm text-[var(--ink-soft)] mb-4">
          Flagged automatically and not emailed to you. Release anything genuine with <em>Not spam</em>.
        </p>
      )}

      <div className="bg-white border border-[var(--line)] overflow-x-auto">
        <table className="w-full text-sm" data-testid="leads-table">
          <thead className="bg-[var(--paper-surface)] border-b border-[var(--line)]">
            <tr>
              {["Name", "Email", "Company", "Service", "Source", "Status", "Date"].map((h) => (
                <th key={h} className="text-left text-[10px] font-mono uppercase tracking-wider text-[var(--ink-soft)] px-4 py-3">{h}</th>
              ))}
              <th className="text-right text-[10px] font-mono uppercase tracking-wider text-[var(--ink-soft)] px-4 py-3">Actions</th>
            </tr>
          </thead>
          <tbody>
            {filtered.map((l) => (
              <Fragment key={l.id}>
                <tr data-testid={`lead-row-${l.id}`} className="border-b border-[var(--line)] hover:bg-[var(--paper-surface)] cursor-pointer"
                  onClick={() => setExpanded(expanded === l.id ? null : l.id)}>
                  <td className="px-4 py-3 font-medium">{l.name}</td>
                  <td className="px-4 py-3 text-[var(--ink-soft)]">{l.email}</td>
                  <td className="px-4 py-3 text-[var(--ink-soft)]">{l.company || "—"}</td>
                  <td className="px-4 py-3 text-[var(--ink-soft)]">{l.service_interest || "—"}</td>
                  <td className="px-4 py-3 font-mono text-xs text-[var(--ink-soft)]">{l.source}</td>
                  <td className="px-4 py-3">
                    {l.status === "spam" ? (
                      <span className="inline-flex items-center gap-1 text-xs font-mono text-red-600">
                        <ShieldWarning size={13} /> spam · {l.spam_score}
                      </span>
                    ) : (
                      <select
                        data-testid={`lead-status-${l.id}`}
                        value={l.status}
                        onClick={(e) => e.stopPropagation()}
                        onChange={(e) => setStatus(l.id, e.target.value)}
                        className="bg-white border border-[var(--line)] text-xs font-mono px-2 py-1 focus:outline-none focus:border-[var(--brand-ink)]"
                      >
                        {STATUSES.map((s) => <option key={s} value={s}>{s}</option>)}
                      </select>
                    )}
                  </td>
                  <td className="px-4 py-3 text-xs font-mono text-[var(--ink-soft)]">{new Date(l.created_at).toLocaleDateString()}</td>
                  <td className="px-4 py-3 text-right whitespace-nowrap">
                    {l.status === "spam" && (
                      <button onClick={(e) => { e.stopPropagation(); setStatus(l.id, "new"); }}
                        data-testid={`lead-release-${l.id}`}
                        className="text-xs text-emerald-700 hover:underline mr-3 inline-flex items-center gap-1">
                        <CheckCircle size={12} /> Not spam
                      </button>
                    )}
                    <button onClick={(e) => { e.stopPropagation(); remove(l.id); }} data-testid={`lead-delete-${l.id}`} className="text-xs text-red-600 hover:underline">Delete</button>
                  </td>
                </tr>
                {expanded === l.id && (
                  <tr><td colSpan={8} className="bg-[var(--paper-surface)] px-4 py-4">
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-sm">
                      <div><Label>Phone</Label>{l.phone || "—"}</div>
                      <div className="md:col-span-2"><Label>Message</Label>{l.message || "—"}</div>
                      <div>
                        <Label>Consent</Label>
                        {l.consent
                          ? <span className="text-emerald-700">Given {l.consent_at ? `on ${new Date(l.consent_at).toLocaleString()}` : ""}</span>
                          : <span className="text-[var(--ink-soft)]">Not recorded (submitted before consent capture)</span>}
                      </div>
                      {l.spam_reasons?.length > 0 && (
                        <div className="md:col-span-2">
                          <Label>Why it was flagged</Label>
                          <ul className="list-disc pl-5 text-[var(--ink-soft)]">
                            {l.spam_reasons.map((r, i) => <li key={i}>{r}</li>)}
                          </ul>
                        </div>
                      )}
                    </div>
                  </td></tr>
                )}
              </Fragment>
            ))}
            {filtered.length === 0 && (
              <tr><td colSpan={8} className="px-4 py-12 text-center text-[var(--ink-soft)]">
                {filter === "spam" ? "No spam caught." : "No leads yet."}
              </td></tr>
            )}
          </tbody>
        </table>
      </div>

      {/* DPDP data-principal erasure */}
      <div className="mt-8 bg-white border border-[var(--line)] p-5 max-w-2xl">
        <div className="flex items-center gap-2 text-sm font-medium"><UserMinus size={16} /> Erase a person's data</div>
        <p className="text-xs text-[var(--ink-soft)] mt-1 mb-3">
          When someone asks you to delete their information (DPDP Act right to erasure), enter their email to
          remove every enquiry they've sent. The audit log records that an erasure happened, but not whose.
        </p>
        <div className="flex gap-2">
          <input
            type="email"
            value={eraseEmail}
            onChange={(e) => setEraseEmail(e.target.value)}
            placeholder="person@example.com"
            data-testid="erase-email"
            className="flex-1 bg-[var(--paper-surface)] border border-[var(--line)] px-3 py-2 text-sm focus:outline-none focus:border-[var(--brand-ink)]"
          />
          <button onClick={erase} disabled={!eraseEmail.trim()} data-testid="erase-submit"
            className="btn-ghost !py-2 !px-4 text-sm text-red-600 disabled:opacity-40">
            Erase
          </button>
        </div>
      </div>
    </div>
  );
}

function Label({ children }) {
  return <div className="text-[10px] font-mono uppercase tracking-wider text-[var(--ink-soft)] mb-1">{children}</div>;
}

function Chip({ label, active, onClick, testid, warn }) {
  return (
    <button data-testid={testid} onClick={onClick}
      className={`text-xs font-mono uppercase tracking-wider px-3 py-1.5 border transition-colors ${
        active
          ? warn ? "bg-red-600 text-white border-red-600" : "bg-[var(--selected-bg)] text-[var(--selected-fg)] border-[var(--selected-bg)]"
          : "bg-white text-[var(--ink-soft)] border-[var(--line)] hover:border-[var(--brand-ink)]"
      }`}>
      {label}
    </button>
  );
}
