// removed disable
import { useEffect, useState } from "react";
import { useParams, Link } from "react-router-dom";
import { api } from "@/lib/api";
import { ArrowUpRight, ArrowLeft } from "@phosphor-icons/react";

export default function CategoryPage() {
  const { slug } = useParams();
  const [category, setCategory] = useState(null);
  const [services, setServices] = useState([]);

  useEffect(() => {
    api.get(`/categories/${slug}`).then((r) => {
      setCategory(r.data);
      api.get(`/services?category_id=${r.data.id}`).then((s) => setServices(s.data));
    }).catch(() => {});
  }, [slug]);

  if (!category) return <div className="max-w-3xl mx-auto p-12 text-center text-[var(--ink-soft)]">Loading…</div>;

  return (
    <div data-testid="category-page">
      <section className="border-b border-[var(--line)] bg-[var(--paper-surface)]">
        <div className="max-w-7xl mx-auto px-6 lg:px-10 py-16">
          <Link to="/services" className="inline-flex items-center gap-2 text-sm text-[var(--ink-soft)] hover:text-[var(--brand-teal)] mb-6" data-testid="back-services">
            <ArrowLeft size={14} /> All services
          </Link>
          <div className="eyebrow mb-4">Practice</div>
          <h1 className="text-5xl sm:text-6xl tracking-tight max-w-3xl">{category.name}</h1>
          <p className="mt-5 text-lg text-[var(--ink-soft)] max-w-xl leading-relaxed">{category.description}</p>
        </div>
      </section>

      <section className="max-w-7xl mx-auto px-6 lg:px-10 py-12">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-px bg-[var(--line)] border border-[var(--line)]" data-testid="category-services-grid">
          {services.map((s) => (
            <Link
              key={s.id}
              to={`/services/${s.slug}`}
              data-testid={`cat-service-${s.slug}`}
              className="group bg-white p-7 hover:bg-[var(--paper-surface)] transition-colors flex flex-col gap-3 min-h-[260px]"
            >
              <div className="flex items-center justify-between">
                <div className="text-[10px] font-mono uppercase tracking-wider text-[var(--brand-amber)]">{s.duration}</div>
                <ArrowUpRight size={18} className="text-[var(--ink-soft)] group-hover:text-[var(--brand-teal)]" />
              </div>
              <h3 className="text-2xl tracking-tight">{s.name}</h3>
              <p className="text-sm text-[var(--ink-soft)] flex-1">{s.short_description}</p>
              <div className="text-sm font-mono">{s.price_label}</div>
            </Link>
          ))}
          {services.length === 0 && (
            <div className="bg-white p-12 col-span-full text-center text-[var(--ink-soft)]">No services in this category yet.</div>
          )}
        </div>
      </section>
    </div>
  );
}
