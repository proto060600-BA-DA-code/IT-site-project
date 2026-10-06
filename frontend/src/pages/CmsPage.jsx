import { useEffect, useState } from "react";
import { api } from "@/lib/api";
import ReactMarkdownLite from "@/components/ReactMarkdownLite";
import { useSettings } from "@/contexts/SettingsContext";
import usePageTitle from "@/lib/usePageTitle";

export default function CmsPage({ slug, fallbackTitle, fallbackContent }) {
  const [page, setPage] = useState(null);
  usePageTitle(page?.title || fallbackTitle);
  const s = useSettings();

  useEffect(() => {
    api.get(`/pages/${slug}`).then((r) => setPage(r.data)).catch(() => setPage(null));
  }, [slug]);

  const title = page?.title || fallbackTitle;
  const content = fillTokens(page?.content || fallbackContent, s);
  // Fall back to the main contact address so the policy never points at a
  // grievance contact that isn't there.
  const grievanceEmail = s.grievance_officer_email || s.email;
  const hasGrievance = s.grievance_officer_name || grievanceEmail;

  return (
    <div data-testid={`cms-page-${slug}`}>
      <section className="border-b border-[var(--line)] bg-[var(--paper-surface)]">
        <div className="max-w-4xl mx-auto px-6 lg:px-10 py-16">
          <div className="eyebrow mb-4">{slug === "about" ? "About" : "Legal"}</div>
          <h1 className="text-5xl tracking-tight">{title}</h1>
        </div>
      </section>
      <section className="max-w-4xl mx-auto px-6 lg:px-10 py-12 prose-ciq">
        <ReactMarkdownLite text={content} />

        {/* DPDP Act: the grievance officer's contact must be published. Driven
            by Site settings so it stays current without editing the policy. */}
        {slug === "privacy" && hasGrievance && (
          <div className="mt-10 border border-[var(--line)] p-6 not-prose" data-testid="grievance-officer">
            <h2 className="!mt-0">Grievance officer</h2>
            <p>
              For any request to access, correct or erase your personal data, or to raise a complaint
              about how it is handled, contact:
            </p>
            <p className="!mb-0">
              {s.grievance_officer_name && <strong>{s.grievance_officer_name}</strong>}
              {s.grievance_officer_name && grievanceEmail && <br />}
              {grievanceEmail && (
                <a href={`mailto:${grievanceEmail}`} className="underline">{grievanceEmail}</a>
              )}
            </p>
          </div>
        )}
      </section>
    </div>
  );
}

/** 730 → "deleted automatically after 2 years"; 0 means the retention job keeps data indefinitely. */
function retention(days) {
  const n = Number(days);
  if (!n) return "kept until you ask us to delete them";
  const span = n % 365 === 0 ? (n === 365 ? "1 year" : `${n / 365} years`) : `${n} days`;
  return `deleted automatically after ${span}`;
}

/**
 * Pages can say {{email}}, {{brand_name}} or {{lead_retention}} instead of
 * restating values that live in Site settings — one source of truth, so the
 * policy can't drift from what the retention job actually does.
 */
function fillTokens(text, s) {
  if (!text) return text;
  const values = {
    lead_retention: retention(s.lead_retention_days ?? 730),
    spam_retention: retention(s.spam_retention_days ?? 30),
    audit_retention: retention(s.audit_retention_days ?? 730),
  };
  return text.replace(/\{\{\s*([a-z_]+)\s*\}\}/g, (m, key) => {
    const v = key in values ? values[key] : s[key];
    return typeof v === "string" || typeof v === "number" ? String(v) : m;
  });
}
