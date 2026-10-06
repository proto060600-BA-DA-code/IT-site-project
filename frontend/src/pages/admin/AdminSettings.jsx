import { useCallback, useEffect, useState } from "react";
import { api } from "@/lib/api";
import { toast } from "sonner";
import { FloppyDisk, CheckCircle, WarningCircle, PaperPlaneTilt } from "@phosphor-icons/react";

/**
 * Shows which external services are configured on the server and lets the
 * admin send a real test lead alert — with Resend's actual error on screen
 * instead of a silent failure buried in the Render logs.
 */
function IntegrationsPanel() {
  const [info, setInfo] = useState(null);
  const [sending, setSending] = useState(false);
  const [result, setResult] = useState(null);

  useEffect(() => {
    api.get("/admin/settings/integrations").then((r) => setInfo(r.data)).catch(() => setInfo(false));
  }, []);

  const sendTest = async () => {
    setSending(true);
    setResult(null);
    try {
      const r = await api.post("/admin/settings/test-email");
      setResult(r.data);
    } catch (e) {
      setResult({ ok: false, detail: e?.response?.data?.detail || "Could not reach the server." });
    } finally {
      setSending(false);
    }
  };

  if (info === null) return null;
  if (info === false) return null;

  const Row = ({ ok, label, children }) => (
    <div className="flex items-start gap-3 py-2.5 border-b border-[var(--line)] last:border-0">
      {ok ? <CheckCircle size={18} weight="fill" className="text-emerald-600 shrink-0 mt-0.5" />
          : <WarningCircle size={18} weight="fill" className="text-amber-600 shrink-0 mt-0.5" />}
      <div className="min-w-0">
        <div className="text-sm font-medium">{label}</div>
        <div className="text-xs text-[var(--ink-soft)] mt-0.5 break-words">{children}</div>
      </div>
    </div>
  );

  const la = info.lead_alerts;
  return (
    <div className="bg-white border border-[var(--line)] max-w-3xl mb-4" data-testid="integrations-panel">
      <div className="px-5 py-3 border-b border-[var(--line)] text-[10px] font-mono uppercase tracking-wider text-[var(--ink-soft)]">
        Integrations (set on Render)
      </div>
      <div className="px-5 py-2">
        <Row ok={la.ready && !la.using_test_sender} label="Lead alert emails">
          {la.ready
            ? <>Sending from <code>{la.sender}</code> to <code>{la.recipient}</code>.</>
            : "Not set up — new leads are saved in Admin → Leads but you won't be emailed."}
          {la.notes?.map((n, i) => <div key={i} className="mt-1">{n}</div>)}
        </Row>
        <Row ok={info.chat.ready} label="Chat assistant">
          {info.chat.ready ? `On (${info.chat.model}).` : "Off — the widget is hidden until ANTHROPIC_API_KEY is set."}
        </Row>
        <Row ok={!!info.media.provider} label="Image uploads">
          {info.media.provider ? `Using ${info.media.provider === "s3" ? "Amazon S3" : "Cloudinary"}.`
            : "Not configured — uploads will fail. See DEPLOY.md Step 5."}
        </Row>
        <Row ok={!!info.site_url && !/example\./.test(info.site_url)} label="Site address (SITE_URL)">
          {info.site_url || "Not set — page titles and canonical URLs can't be generated."}
        </Row>
      </div>
      <div className="px-5 py-3 border-t border-[var(--line)] flex flex-wrap items-center gap-3">
        <button onClick={sendTest} disabled={sending || !la.ready} data-testid="send-test-email"
          className="btn-ghost !py-2 !px-4 text-sm disabled:opacity-40">
          <PaperPlaneTilt size={14} /> {sending ? "Sending…" : "Send test email"}
        </button>
        {result && (
          <div className={`text-xs flex-1 min-w-[200px] ${result.ok ? "text-emerald-700" : "text-red-700"}`} data-testid="test-email-result">
            {result.detail}
          </div>
        )}
      </div>
    </div>
  );
}

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

      <IntegrationsPanel />

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
