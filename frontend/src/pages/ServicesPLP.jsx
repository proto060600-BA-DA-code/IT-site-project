import { useEffect, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { api } from "@/lib/api";
import { ArrowUpRight } from "@phosphor-icons/react";

export default function ServicesPLP() {
  const [services, setServices] = useState([]);
  const [categories, setCategories] = useState([]);
  const [params, setParams] = useSearchParams();
  const activeCat = params.get("cat") || "all";

  useEffect(() => {
    Promise.all([api.get("/services"), api.get("/categories")])
      .then(([s, c]) => { setServices(s.data); setCategories(c.data); })
      .catch(() => {});
  }, []);

  const filtered = activeCat === "all"
    ? services
    : services.filter((s) => s.category_id === categories.find((c) => c.slug === activeCat)?.id);

  return (
    <div data-testid="services-plp">
      <section className="border-b border-[var(--line)] bg-[var(--paper-surface)]">
        <div className="max-w-7xl mx-auto px-6 lg:px-10 py-16">
          <div className="eyebrow mb-4">Services</div>
          <h1 className="text-5xl sm:text-6xl tracking-tight max-w-3xl">Productized senior consulting.</h1>
          <p className="mt-5 max-w-xl text-[var(--ink-soft)]">Fixed-scope engagements led by senior Business Analysts. Pick a starting point — or compose your own.</p>
        </div>
      </section>

      <section className="border-b border-[var(--line)] bg-white">
        <div className="max-w-7xl mx-auto px-6 lg:px-10 py-5 flex gap-2 overflow-x-auto no-scrollbar" data-testid="category-filter">
          <FilterChip
            label="All services"
            active={activeCat === "all"}
            onClick={() => setParams({})}
            testid="filter-all"
          />
          {categories.map((c) => (
            <FilterChip
              key={c.id}
              label={c.name}
              active={activeCat === c.slug}
              onClick={() => setParams({ cat: c.slug })}
              testid={`filter-${c.slug}`}
            />
          ))}
        </div>
      </section>

      <section className="max-w-7xl mx-auto px-6 lg:px-10 py-12">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-px bg-[var(--line)] border border-[var(--line)]" data-testid="services-grid">
          {filtered.map((s) => (
            <Link
              key={s.id}
              to={`/services/${s.slug}`}
              data-testid={`plp-service-${s.slug}`}
              className="group bg-white p-7 hover:bg-[var(--paper-surface)] transition-colors flex flex-col gap-3 min-h-[280px]"
            >
              <div className="flex items-center justify-between">
                <div className="text-[10px] font-mono uppercase tracking-wider text-[var(--brand-amber)]">{s.duration}</div>
                <ArrowUpRight size={18} className="text-[var(--ink-soft)] group-hover:text-[var(--brand-teal)]" />
              </div>
              <h3 className="text-2xl tracking-tight">{s.name}</h3>
              <p className="text-sm text-[var(--ink-soft)] flex-1">{s.short_description}</p>
              <div className="hairline" />
              <div className="text-sm font-mono text-[var(--ink)]">{s.price_label}</div>
            </Link>
          ))}
          {filtered.length === 0 && (
            <div className="bg-white p-12 col-span-full text-center text-[var(--ink-soft)]">No services in this category yet.</div>
          )}
        </div>
      </section>
    </div>
  );
}

function FilterChip({ label, active, onClick, testid }) {
  return (
    <button
      data-testid={testid}
      onClick={onClick}
      className={`shrink-0 text-sm px-4 py-2 border transition-colors ${
        active
          ? "bg-[var(--brand-teal)] text-white border-[var(--brand-teal)]"
          : "bg-white text-[var(--ink-soft)] border-[var(--line)] hover:border-[var(--brand-teal)] hover:text-[var(--brand-teal)]"
      }`}
    >
      {label}
    </button>
  );
}
