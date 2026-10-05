import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { api } from "@/lib/api";
import { ArrowUpRight, Clock, Tag as TagIcon } from "@phosphor-icons/react";

export default function InsightsList() {
  const [posts, setPosts] = useState([]);
  const [activeTag, setActiveTag] = useState("all");

  useEffect(() => { api.get("/insights").then((r) => setPosts(r.data)).catch(() => {}); }, []);

  const tags = Array.from(new Set(posts.flatMap((p) => p.tags || [])));
  const filtered = activeTag === "all" ? posts : posts.filter((p) => p.tags?.includes(activeTag));

  return (
    <div data-testid="insights-list">
      <section className="border-b border-[var(--line)] bg-[var(--paper-surface)]">
        <div className="max-w-7xl mx-auto px-6 lg:px-10 py-16">
          <div className="eyebrow mb-4">Insights</div>
          <h1 className="text-5xl sm:text-6xl tracking-tight max-w-3xl">Field notes from an analyst who builds.</h1>
          <p className="mt-5 max-w-xl text-[var(--ink-soft)]">Honest writing on business analysis, building AI products, automation, and what actually ships.</p>
        </div>
      </section>

      {tags.length > 0 && (
        <section className="border-b border-[var(--line)] bg-white">
          <div className="max-w-7xl mx-auto px-6 lg:px-10 py-5 flex gap-2 overflow-x-auto no-scrollbar" data-testid="tag-filter">
            <Chip label="All" active={activeTag === "all"} onClick={() => setActiveTag("all")} testid="tag-all" />
            {tags.map((t) => (
              <Chip key={t} label={t} active={activeTag === t} onClick={() => setActiveTag(t)} testid={`tag-${t}`} />
            ))}
          </div>
        </section>
      )}

      <section className="max-w-7xl mx-auto px-6 lg:px-10 py-12">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-px bg-[var(--line)] border border-[var(--line)]" data-testid="insights-grid">
          {filtered.map((p) => (
            <Link
              key={p.id}
              to={`/insights/${p.slug}`}
              data-testid={`post-card-${p.slug}`}
              className="group bg-white p-7 hover:bg-[var(--paper-surface)] transition-colors flex flex-col gap-4"
            >
              <div
                className="h-44 bg-cover bg-center bg-[var(--paper-surface)] -mx-7 -mt-7 mb-1"
                style={{ backgroundImage: p.cover_image ? `url(${p.cover_image})` : undefined }}
              />
              <div className="flex items-center gap-3 text-[10px] font-mono uppercase tracking-wider text-[var(--ink-soft)]">
                <span className="flex items-center gap-1"><Clock size={11} /> {p.read_time_min} min read</span>
                {p.tags?.[0] && <span className="flex items-center gap-1 text-[var(--brand-amber)]"><TagIcon size={11} /> {p.tags[0]}</span>}
              </div>
              <h2 className="text-xl tracking-tight">{p.title}</h2>
              <p className="text-sm text-[var(--ink-soft)] flex-1 line-clamp-3">{p.excerpt}</p>
              <div className="flex items-center justify-between pt-2 border-t border-[var(--line)]">
                <span className="text-xs font-mono text-[var(--ink-soft)]">{p.author}</span>
                <ArrowUpRight size={16} className="text-[var(--brand-teal)] group-hover:-translate-y-0.5 group-hover:translate-x-0.5 transition-transform" />
              </div>
            </Link>
          ))}
          {filtered.length === 0 && (
            <div className="bg-white p-12 col-span-full text-center text-[var(--ink-soft)]">No insights published yet.</div>
          )}
        </div>
      </section>
    </div>
  );
}

function Chip({ label, active, onClick, testid }) {
  return (
    <button
      data-testid={testid}
      onClick={onClick}
      className={`shrink-0 text-sm px-4 py-2 border transition-colors ${
        active ? "bg-[var(--brand-teal)] text-white border-[var(--brand-teal)]"
               : "bg-white text-[var(--ink-soft)] border-[var(--line)] hover:border-[var(--brand-teal)] hover:text-[var(--brand-teal)]"
      }`}
    >
      {label}
    </button>
  );
}
