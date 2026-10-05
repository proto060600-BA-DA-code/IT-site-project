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
  const content = page?.content || fallbackContent;
  const hasGrievance = s.grievance_officer_name || s.grievance_officer_email;

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
              {s.grievance_officer_name && s.grievance_officer_email && <br />}
              {s.grievance_officer_email && (
                <a href={`mailto:${s.grievance_officer_email}`} className="underline">{s.grievance_officer_email}</a>
              )}
            </p>
          </div>
        )}
      </section>
    </div>
  );
}
