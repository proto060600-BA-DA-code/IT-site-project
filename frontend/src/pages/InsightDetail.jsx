import { useParams, Link } from "react-router-dom";
import { ArrowLeft, Clock } from "@phosphor-icons/react";
import ReactMarkdownLite from "@/components/ReactMarkdownLite";
import { useApiResource } from "@/hooks/useApiResource";
import usePageTitle from "@/lib/usePageTitle";

export default function InsightDetail() {
  const { slug } = useParams();
  const { data: post, error } = useApiResource(`/insights/${slug}`);
  usePageTitle(error ? "Post not found" : post?.title);

  if (error) return <div className="max-w-3xl mx-auto p-12 text-center text-[var(--ink-soft)]">Post not found. <Link to="/insights" className="underline">Back to insights</Link></div>;
  if (!post) return <div className="max-w-3xl mx-auto p-12 text-center text-[var(--ink-soft)]">Loading…</div>;

  return (
    <article data-testid="insight-detail">
      <section className="border-b border-[var(--line)] bg-[var(--paper-surface)]">
        <div className="max-w-4xl mx-auto px-6 lg:px-10 py-12">
          <Link to="/insights" data-testid="back-to-insights" className="inline-flex items-center gap-2 text-sm text-[var(--ink-soft)] hover:text-[var(--brand-teal)] mb-6">
            <ArrowLeft size={14} /> All insights
          </Link>
          <div className="flex flex-wrap items-center gap-3 mb-5 text-[11px] font-mono uppercase tracking-wider">
            <span className="text-[var(--brand-teal)]">{post.author}</span>
            <span className="text-[var(--ink-soft)]">·</span>
            <span className="text-[var(--ink-soft)] flex items-center gap-1"><Clock size={11} /> {post.read_time_min} min read</span>
            {post.tags?.map((t) => (
              <span key={t} className="text-[var(--brand-amber)]">#{t}</span>
            ))}
          </div>
          <h1 data-testid="insight-title" className="text-4xl sm:text-5xl tracking-tight max-w-3xl">{post.title}</h1>
          <p className="mt-5 text-lg text-[var(--ink-soft)] max-w-2xl leading-relaxed">{post.excerpt}</p>
        </div>
      </section>

      {post.cover_image && (
        <div className="max-w-5xl mx-auto px-6 lg:px-10 py-10">
          <div className="aspect-[16/9] bg-cover bg-center border border-[var(--line)]" style={{ backgroundImage: `url(${post.cover_image})` }} />
        </div>
      )}

      <section className="max-w-3xl mx-auto px-6 lg:px-10 py-10 prose-ciq">
        <ReactMarkdownLite text={post.body} />
      </section>

      <section className="max-w-3xl mx-auto px-6 lg:px-10 py-10 border-t border-[var(--line)]">
        <div className="bg-[var(--paper-surface)] p-7 border border-[var(--line)]">
          <div className="eyebrow mb-2">Next step</div>
          <h3 className="text-2xl tracking-tight">Want our take on your stack?</h3>
          <p className="text-[var(--ink-soft)] mt-2 mb-5">I'll reply personally within one business day.</p>
          <Link to="/contact" className="btn-accent">Book a consultation →</Link>
        </div>
      </section>

      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify({
        "@context": "https://schema.org",
        "@type": "Article",
        "headline": post.title,
        "description": post.excerpt,
        "image": post.cover_image,
        "datePublished": post.published_at,
        "dateModified": post.updated_at,
        "author": { "@type": "Person", "name": post.author },
        "publisher": { "@type": "Organization", "name": "Synferrous" },
        "keywords": (post.tags || []).join(", "),
      }) }} />
    </article>
  );
}
