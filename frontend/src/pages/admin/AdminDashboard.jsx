import { useCallback, useEffect, useState } from "react";
import { api } from "@/lib/api";
import { downloadCsv } from "@/lib/download";
import { toast } from "sonner";
import {
  DownloadSimple, TrendUp, TrendDown, UploadSimple, X, CheckCircle, WarningCircle,
} from "@phosphor-icons/react";
import {
  ResponsiveContainer, AreaChart, Area, XAxis, YAxis, Tooltip, CartesianGrid,
  BarChart, Bar, Cell,
} from "recharts";

const RANGES = [7, 30, 90];

export default function AdminDashboard() {
  const [range, setRange] = useState(30);
  const [leads, setLeads] = useState(null);
  const [content, setContent] = useState(null);
  const [importing, setImporting] = useState(false);

  const load = useCallback(async () => {
    try {
      const [l, c] = await Promise.all([
        api.get(`/admin/reports/leads?days=${range}`),
        api.get("/admin/reports/content"),
      ]);
      setLeads(l.data);
      setContent(c.data);
    } catch (e) {
      toast.error(e?.response?.data?.detail || "Could not load reports");
    }
  }, [range]);

  useEffect(() => { load(); }, [load]);

  const change = leads?.change_pct;

  return (
    <div data-testid="admin-dashboard">
      <div className="flex items-end justify-between mb-8 gap-4 flex-wrap">
        <div>
          <div className="eyebrow mb-2">Console</div>
          <h1 className="text-3xl tracking-tight">Dashboard</h1>
          <p className="text-sm text-[var(--ink-soft)] mt-1">Operational snapshot of the RK AI Labs site.</p>
        </div>
        <div className="flex items-center gap-2">
          <div className="flex border border-[var(--line)] bg-white">
            {RANGES.map((r) => (
              <button
                key={r}
                onClick={() => setRange(r)}
                data-testid={`range-${r}`}
                className={`px-3 py-2 text-xs font-mono uppercase tracking-wider transition-colors ${
                  range === r ? "bg-[var(--selected-bg)] text-[var(--selected-fg)]" : "text-[var(--ink-soft)] hover:bg-[var(--paper-surface)]"
                }`}
              >
                {r}d
              </button>
            ))}
          </div>
          <button onClick={() => setImporting(true)} className="btn-ghost !py-2 !px-4 text-sm">
            <UploadSimple size={14} weight="bold" /> Import CSV
          </button>
          <button
            onClick={() => downloadCsv(`/admin/reports/export/leads?days=${range}`, "leads.csv")}
            data-testid="export-leads"
            className="btn-accent !py-2 !px-4 text-sm"
          >
            <DownloadSimple size={14} weight="bold" /> Export leads
          </button>
        </div>
      </div>

      {/* Headline metrics */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
        <Metric label={`Leads · last ${range}d`} value={leads?.total} accent
          footer={change == null ? "no prior period" : (
            <span className={`inline-flex items-center gap-1 ${change >= 0 ? "text-emerald-600" : "text-red-600"}`}>
              {change >= 0 ? <TrendUp size={12} /> : <TrendDown size={12} />}
              {Math.abs(change)}% vs previous {range}d
            </span>
          )} />
        <Metric label="Qualified" value={leads?.qualified} footer={`${leads?.qualification_pct ?? 0}% of leads`} />
        <Metric label="Closed" value={leads?.closed} footer={`${leads?.conversion_pct ?? 0}% conversion`} />
        <Metric label="Media assets" value={content?.assets} footer={`${content?.services ?? 0} services · ${content?.posts ?? 0} posts`} />
      </div>

      {/* Volume + sources */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 mb-6">
        <Panel title="Leads over time" className="lg:col-span-2">
          <div className="h-64">
            {leads && (
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={leads.series} margin={{ top: 8, right: 8, left: -22, bottom: 0 }}>
                  <defs>
                    <linearGradient id="leadFill" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor="var(--gold)" stopOpacity={0.35} />
                      <stop offset="100%" stopColor="var(--gold)" stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="2 4" stroke="var(--line)" vertical={false} />
                  <XAxis dataKey="date" tick={{ fontSize: 10 }} tickFormatter={(d) => d.slice(5)}
                    stroke="var(--ink-soft)" interval="preserveStartEnd" minTickGap={28} />
                  <YAxis tick={{ fontSize: 10 }} stroke="var(--ink-soft)" allowDecimals={false} width={38} />
                  <Tooltip contentStyle={{ fontSize: 12, border: "1px solid var(--line)", borderRadius: 0 }} />
                  <Area type="monotone" dataKey="count" stroke="var(--gold)" strokeWidth={2} fill="url(#leadFill)" />
                </AreaChart>
              </ResponsiveContainer>
            )}
          </div>
        </Panel>

        <Panel title="Status funnel">
          <div className="h-64">
            {leads && (
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={leads.by_status} margin={{ top: 8, right: 8, left: -26, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="2 4" stroke="var(--line)" vertical={false} />
                  <XAxis dataKey="key" tick={{ fontSize: 10 }} stroke="var(--ink-soft)" />
                  <YAxis tick={{ fontSize: 10 }} stroke="var(--ink-soft)" allowDecimals={false} width={38} />
                  <Tooltip contentStyle={{ fontSize: 12, border: "1px solid var(--line)", borderRadius: 0 }} />
                  <Bar dataKey="count">
                    {leads.by_status.map((_, i) => (
                      <Cell key={i} fill={i === 3 ? "var(--gold)" : "var(--ink-soft)"} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            )}
          </div>
        </Panel>
      </div>

      {/* Breakdowns */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <Panel title="By source">
          <Breakdown rows={leads?.by_source} total={leads?.total} />
        </Panel>
        <Panel title="By service interest">
          <Breakdown rows={leads?.by_service} total={leads?.total} />
        </Panel>
        <Panel title="Recent leads">
          <div className="divide-y divide-[var(--line)]">
            {(leads?.recent || []).map((l) => (
              <div key={l.id} className="py-2.5 flex items-baseline justify-between gap-3">
                <div className="min-w-0">
                  <div className="text-sm truncate">{l.name}</div>
                  <div className="text-[11px] text-[var(--ink-soft)] truncate">{l.email}</div>
                </div>
                <div className="text-[10px] font-mono uppercase tracking-wider text-[var(--ink-soft)] shrink-0">
                  {(l.created_at || "").slice(5, 10)}
                </div>
              </div>
            ))}
            {leads?.recent?.length === 0 && (
              <div className="py-8 text-center text-sm text-[var(--ink-soft)]">No leads in this window.</div>
            )}
          </div>
        </Panel>
      </div>

      {importing && <CsvImport onClose={() => setImporting(false)} onDone={load} />}
    </div>
  );
}

function Metric({ label, value, footer, accent }) {
  return (
    <div className={`bg-white border p-5 ${accent ? "border-[var(--gold)]" : "border-[var(--line)]"}`}>
      <div className="text-[10px] font-mono uppercase tracking-wider text-[var(--ink-soft)]">{label}</div>
      <div className="text-3xl tracking-tight mt-2 tabular">{value ?? "—"}</div>
      <div className="text-[11px] text-[var(--ink-soft)] mt-1.5">{footer}</div>
    </div>
  );
}

function Panel({ title, children, className = "" }) {
  return (
    <div className={`bg-white border border-[var(--line)] ${className}`}>
      <div className="px-5 py-3 border-b border-[var(--line)] text-[10px] font-mono uppercase tracking-wider text-[var(--ink-soft)]">
        {title}
      </div>
      <div className="p-5">{children}</div>
    </div>
  );
}

function Breakdown({ rows, total }) {
  if (!rows?.length) return <div className="py-8 text-center text-sm text-[var(--ink-soft)]">Nothing yet.</div>;
  return (
    <div className="space-y-3">
      {rows.map((r) => {
        const pct = total ? Math.round((r.count / total) * 100) : 0;
        return (
          <div key={r.key}>
            <div className="flex items-baseline justify-between text-xs mb-1">
              <span className="truncate">{r.key}</span>
              <span className="text-[var(--ink-soft)] font-mono shrink-0 ml-2">{r.count} · {pct}%</span>
            </div>
            <div className="h-1.5 bg-[var(--paper-muted)]">
              <div className="h-full bg-[var(--selected-bg)]" style={{ width: `${pct}%` }} />
            </div>
          </div>
        );
      })}
    </div>
  );
}

/** Drag-and-drop CSV import with column mapping and a dry-run preview. */
function CsvImport({ onClose, onDone }) {
  const [resource, setResource] = useState("services");
  const [rows, setRows] = useState(null);
  const [headers, setHeaders] = useState([]);
  const [mapping, setMapping] = useState({});
  const [preview, setPreview] = useState(null);
  const [dragOver, setDragOver] = useState(false);
  const [busy, setBusy] = useState(false);

  const TARGETS = {
    services: ["name", "slug", "short_description", "long_description", "price_label", "featured", "active"],
    categories: ["name", "slug", "description", "order", "active"],
    clients: ["name", "logo_url", "website", "order", "active"],
    leads: ["name", "email", "phone", "company", "service_interest", "message", "source", "status"],
  };

  const parse = async (file) => {
    if (!file) return;
    const Papa = (await import("papaparse")).default;
    Papa.parse(file, {
      header: true, skipEmptyLines: true,
      complete: (res) => {
        if (!res.data?.length) return toast.error("That file has no rows");
        setRows(res.data);
        const hs = res.meta.fields || [];
        setHeaders(hs);
        // Auto-map any header whose name matches a target field exactly.
        const auto = {};
        TARGETS[resource].forEach((t) => { if (hs.includes(t)) auto[t] = t; });
        setMapping(auto);
        setPreview(null);
      },
      error: () => toast.error("Could not read that CSV"),
    });
  };

  const mapped = () =>
    (rows || []).map((r) => {
      const out = {};
      Object.entries(mapping).forEach(([target, source]) => {
        if (source) out[target] = r[source];
      });
      return out;
    });

  const run = async (dry) => {
    setBusy(true);
    try {
      const res = await api.post(`/admin/reports/import/${resource}`, { rows: mapped(), dry_run: dry });
      setPreview(res.data);
      if (!dry) {
        toast.success(`Imported — ${res.data.created} created, ${res.data.updated} updated`);
        onDone?.();
      }
    } catch (e) {
      toast.error(e?.response?.data?.detail || "Import failed");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/40 z-50 flex items-start justify-center p-6 overflow-y-auto" data-testid="csv-import">
      <div className="bg-white border border-[var(--line)] w-full max-w-3xl my-10">
        <div className="px-6 py-4 border-b border-[var(--line)] flex items-center justify-between">
          <h2 className="text-lg tracking-tight">Import CSV</h2>
          <button onClick={onClose}><X size={18} /></button>
        </div>

        <div className="p-6 space-y-5">
          <div>
            <label className="block text-xs font-mono uppercase tracking-wider text-[var(--ink-soft)] mb-1.5">Import into</label>
            <select value={resource} onChange={(e) => { setResource(e.target.value); setRows(null); setPreview(null); }}
              className="w-full bg-[var(--paper-surface)] border border-[var(--line)] px-3 py-2.5 text-sm">
              {Object.keys(TARGETS).map((r) => <option key={r} value={r}>{r}</option>)}
            </select>
          </div>

          <div
            onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
            onDragLeave={() => setDragOver(false)}
            onDrop={(e) => { e.preventDefault(); setDragOver(false); parse(e.dataTransfer.files?.[0]); }}
            className={`border-2 border-dashed p-8 text-center transition-colors ${
              dragOver ? "border-[var(--gold)] bg-[var(--paper-surface)]" : "border-[var(--line)]"
            }`}
          >
            <UploadSimple size={22} className="mx-auto text-[var(--ink-soft)]" />
            <p className="text-sm text-[var(--ink-soft)] mt-2">
              {rows ? `${rows.length} rows loaded` : "Drop a CSV here, or"}{" "}
              {!rows && (
                <label className="text-[var(--brand-ink)] underline cursor-pointer">
                  browse
                  <input type="file" accept=".csv,text/csv" className="hidden" onChange={(e) => parse(e.target.files?.[0])} />
                </label>
              )}
            </p>
          </div>

          {rows && (
            <div>
              <div className="text-xs font-mono uppercase tracking-wider text-[var(--ink-soft)] mb-2">Map columns</div>
              <div className="border border-[var(--line)] divide-y divide-[var(--line)] max-h-64 overflow-y-auto">
                {TARGETS[resource].map((t) => (
                  <div key={t} className="flex items-center gap-3 px-3 py-2">
                    <span className="text-sm w-44 shrink-0">{t}</span>
                    <select
                      value={mapping[t] || ""}
                      onChange={(e) => setMapping({ ...mapping, [t]: e.target.value })}
                      className="flex-1 bg-[var(--paper-surface)] border border-[var(--line)] px-2 py-1.5 text-xs"
                    >
                      <option value="">— skip —</option>
                      {headers.map((h) => <option key={h} value={h}>{h}</option>)}
                    </select>
                  </div>
                ))}
              </div>
            </div>
          )}

          {preview && (
            <div className={`border p-4 text-sm ${preview.errors?.length ? "border-amber-400 bg-amber-50" : "border-emerald-400 bg-emerald-50"}`}>
              <div className="flex items-center gap-2 font-medium">
                {preview.errors?.length ? <WarningCircle size={16} /> : <CheckCircle size={16} />}
                {preview.dry_run ? "Preview" : "Imported"}: {preview.created} created, {preview.updated} updated, {preview.skipped} skipped
              </div>
              {preview.errors?.length > 0 && (
                <ul className="mt-2 text-xs list-disc pl-5 max-h-28 overflow-y-auto">
                  {preview.errors.map((e, i) => <li key={i}>Row {e.row}: {e.error}</li>)}
                </ul>
              )}
            </div>
          )}
        </div>

        <div className="px-6 py-4 border-t border-[var(--line)] flex justify-end gap-2">
          <button onClick={onClose} className="btn-ghost">Cancel</button>
          <button onClick={() => run(true)} disabled={!rows || busy} className="btn-ghost disabled:opacity-40">Preview</button>
          <button onClick={() => run(false)} disabled={!rows || busy || !preview?.dry_run} className="btn-accent disabled:opacity-40">
            Import for real
          </button>
        </div>
      </div>
    </div>
  );
}
