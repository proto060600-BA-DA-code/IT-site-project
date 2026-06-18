import { useEffect, useState } from "react";
import { api } from "@/lib/api";
import ReactMarkdownLite from "@/components/ReactMarkdownLite";

export default function CmsPage({ slug, fallbackTitle, fallbackContent }) {
  const [page, setPage] = useState(null);
  useEffect(() => {
    api.get(`/pages/${slug}`).then((r) => setPage(r.data)).catch(() => setPage(null));
  }, [slug]);

  const title = page?.title || fallbackTitle;
  const content = page?.content || fallbackContent;

  return (
    <div data-testid={`cms-page-${slug}`}>
      <section className="border-b border-[var(--line)] bg-[var(--paper-surface)]">
        <div className="max-w-4xl mx-auto px-6 lg:px-10 py-16">
          <div className="eyebrow mb-4">{slug === "about" ? "About" : slug === "privacy" ? "Legal" : "Legal"}</div>
          <h1 className="text-5xl tracking-tight">{title}</h1>
        </div>
      </section>
      <section className="max-w-4xl mx-auto px-6 lg:px-10 py-12 prose-ciq">
        <ReactMarkdownLite text={content} />
      </section>
    </div>
  );
}
