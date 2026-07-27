import { useCallback, useEffect, useState } from "react";
import { api } from "@/lib/api";
import { toast } from "sonner";

const STATUSES = ["new", "contacted", "qualified", "closed"];

export default function AdminLeads() {
  const [leads, setLeads] = useState([]);
  const [expanded, setExpanded] = useState(null);
  const [filter, setFilter] = useState("all");

  const load = useCallback(
    () => api.get("/admin/leads").then((r) => setLeads(r.data)),
    []
  );
  useEffect(() => { load(); }, [load]);

  const setStatus = async (id, status) => {
    await api.put(`/admin/leads/${id}`, { status });
    toast.success("Status updated");
    load();
  };

  const remove = async (id) => {
    if (!window.confirm("Delete this lead?")) return;
    await api.delete(`/admin/leads/${id}`);
    toast.success("Deleted");
    load();
  };

  const filtered = filter === "all" ? leads : leads.filter((l) => l.status === filter);

  return (
    <div data-testid="admin-leads-page">
      <div className="eyebrow mb-2">Pipeline</div>
      <h1 className="text-3xl tracking-tight mb-6">Leads</h1>

      <div className="flex gap-2 mb-5">
        <Chip label={`All (${leads.length})`} active={filter === "all"} onClick={() => setFilter("all")} testid="leads-filter-all" />
        {STATUSES.map((s) => (
          <Chip key={s} label={`${s} (${leads.filter((l) => l.status === s).length})`} active={filter === s} onClick={() => setFilter(s)} testid={`leads-filter-${s}`} />
        ))}
      </div>

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
              <>
                <tr key={l.id} data-testid={`lead-row-${l.id}`} className="border-b border-[var(--line)] hover:bg-[var(--paper-surface)] cursor-pointer"
                    onClick={() => setExpanded(expanded === l.id ? null : l.id)}>
                  <td className="px-4 py-3 font-medium">{l.name}</td>
                  <td className="px-4 py-3 text-[var(--ink-soft)]">{l.email}</td>
                  <td className="px-4 py-3 text-[var(--ink-soft)]">{l.company || "—"}</td>
                  <td className="px-4 py-3 text-[var(--ink-soft)]">{l.service_interest || "—"}</td>
                  <td className="px-4 py-3 font-mono text-xs text-[var(--ink-soft)]">{l.source}</td>
                  <td className="px-4 py-3">
                    <select
                      data-testid={`lead-status-${l.id}`}
                      value={l.status}
                      onClick={(e) => e.stopPropagation()}
                      onChange={(e) => setStatus(l.id, e.target.value)}
                      className="bg-white border border-[var(--line)] text-xs font-mono px-2 py-1 focus:outline-none focus:border-[var(--brand-teal)]"
                    >
                      {STATUSES.map((s) => <option key={s} value={s}>{s}</option>)}
                    </select>
                  </td>
                  <td className="px-4 py-3 text-xs font-mono text-[var(--ink-soft)]">{new Date(l.created_at).toLocaleDateString()}</td>
                  <td className="px-4 py-3 text-right">
                    <button onClick={(e) => { e.stopPropagation(); remove(l.id); }} data-testid={`lead-delete-${l.id}`} className="text-xs text-red-600 hover:underline">Delete</button>
                  </td>
                </tr>
                {expanded === l.id && (
                  <tr><td colSpan={8} className="bg-[var(--paper-surface)] px-4 py-4">
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-sm">
                      <div><div className="text-[10px] font-mono uppercase tracking-wider text-[var(--ink-soft)] mb-1">Phone</div>{l.phone || "—"}</div>
                      <div className="md:col-span-2"><div className="text-[10px] font-mono uppercase tracking-wider text-[var(--ink-soft)] mb-1">Message</div>{l.message || "—"}</div>
                    </div>
                  </td></tr>
                )}
              </>
            ))}
            {filtered.length === 0 && (
              <tr><td colSpan={8} className="px-4 py-12 text-center text-[var(--ink-soft)]">No leads yet.</td></tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function Chip({ label, active, onClick, testid }) {
  return (
    <button data-testid={testid} onClick={onClick} className={`text-xs font-mono uppercase tracking-wider px-3 py-1.5 border transition-colors ${active ? "bg-[var(--brand-teal)] text-white border-[var(--brand-teal)]" : "bg-white text-[var(--ink-soft)] border-[var(--line)] hover:border-[var(--brand-teal)]"}`}>{label}</button>
  );
}
