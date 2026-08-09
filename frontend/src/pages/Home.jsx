/* eslint-disable react/no-unescaped-entities */
import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { api } from "@/lib/api";
import {
  ArrowRight,
  ArrowUpRight,
  CheckCircle,
  Quotes,
  PlayCircle,
  Compass,
  ChartLineUp,
  Cpu,
  ShieldCheck,
} from "@phosphor-icons/react";
import LeadForm from "@/components/LeadForm";
import TrustedBy from "@/components/TrustedBy";

const CAPABILITIES = [
  {
    icon: Compass,
    title: "Strategy",
    body: "Frame the real problem before anyone writes code. Discovery, process mapping and a defensible business case.",
  },
  {
    icon: ChartLineUp,
    title: "Transformation",
    body: "Turn strategy into a shippable backlog — epics, user stories and the ceremonies that keep delivery honest.",
  },
  {
    icon: Cpu,
    title: "AI Products",
    body: "Design and build LLM features and automations that reach production, each with a baseline and an eval.",
  },
  {
    icon: ShieldCheck,
    title: "Governance",
    body: "Keep AI accountable — evaluation harnesses, guardrails and the documentation your auditors will ask for.",
  },
];

export default function Home() {
  const [banners, setBanners] = useState([]);
  const [services, setServices] = useState([]);
  const [categories, setCategories] = useState([]);

  useEffect(() => {
    Promise.all([
      api.get("/banners"),
      api.get("/services?featured=true"),
      api.get("/categories"),
    ]).then(([b, s, c]) => {
      setBanners(b.data);
      setServices(s.data);
      setCategories(c.data);
    }).catch(() => {});
  }, []);

  const hero = banners[0];

  return (
    <div data-testid="home-page">
      {/* HERO — full-dark band, image bleeding on the right half */}
      <section className="band-dark relative overflow-hidden" data-testid="hero-section">
        {/* Right-half image, bleeding to the top/right/bottom edges */}
        {hero?.image_url && (
          <div className="absolute inset-y-0 right-0 w-full lg:w-1/2 pointer-events-none" aria-hidden="true">
            <img
              src={hero.image_url}
              alt=""
              className="h-full w-full object-cover"
              loading="eager"
            />
            {/* Scrim: solid navy at the left edge so the headline stays legible,
                clearing to reveal the photo on the right. */}
            <div
              className="absolute inset-0"
              style={{
                background:
                  "linear-gradient(to right, var(--navy-950) 0%, rgba(13,19,33,0.92) 28%, rgba(13,19,33,0.55) 65%, rgba(13,19,33,0.35) 100%)",
              }}
            />
          </div>
        )}
        {/* Mobile / no-image fallback keeps the band readable */}
        <div className="absolute inset-0 lg:hidden bg-[var(--navy-950)]/80 pointer-events-none" aria-hidden="true" />

        <div className="relative max-w-7xl mx-auto px-6 lg:px-10 py-20 lg:py-28 grid grid-cols-1 lg:grid-cols-12 gap-10 items-end">
          <div className="lg:col-span-7 rise">
            <div className="eyebrow eyebrow-invert mb-6" data-testid="hero-eyebrow">{`IT Business Analysis · AI Product Building · Delhi NCR`}</div>
            <h1 className="text-5xl sm:text-6xl lg:text-7xl tracking-tight leading-[1.02] max-w-3xl">
              {hero?.title || (
                <>
                  Business analysis meets <span className="marker">AI product</span> building.
                </>
              )}
            </h1>
            <p className="mt-6 text-lg on-dark-soft max-w-xl leading-relaxed">
              {hero?.subtitle || "From requirements and process discovery to shipped AI products and automations — led by senior analysts who build, not just advise."}
            </p>
            <div className="mt-9 flex flex-wrap gap-3">
              <Link to={hero?.cta_link || "/contact"} data-testid="hero-primary-cta" className="btn-accent">
                {hero?.cta_label || "Book a Consultation"} <ArrowRight size={16} weight="bold" />
              </Link>
              <Link to="/services" data-testid="hero-secondary-cta" className="btn-ghost-invert">
                <PlayCircle size={18} weight="fill" /> Explore services
              </Link>
            </div>
          </div>

          <div className="lg:col-span-5 rise rise-d2">
            <div className="border border-[var(--line-dark)] bg-[var(--navy-900)]/80 backdrop-blur-sm p-6">
              <div className="text-xs font-mono uppercase tracking-[0.2em] text-[var(--gold)] mb-3">Selected outcomes</div>
              <div className="grid grid-cols-2 gap-x-4 gap-y-5">
                <Stat n="6 wks" label="From problem statement to working AI MVP" />
                <Stat n="2-in-1" label="Senior business analysis + AI engineering" />
                <Stat n="100%" label="Builds shipped with a baseline & eval" />
                <Stat n="48h" label="Turnaround on a free 1-page diagnostic" />
              </div>
              <div className="hairline my-6" />
              <p className="text-sm on-dark-soft italic flex gap-3">
                <Quotes size={20} weight="fill" className="text-[var(--gold)] shrink-0" />
                "They framed the problem, then built it. We had a working AI prototype in six weeks."
              </p>
              <p className="text-xs font-mono uppercase tracking-wider on-dark-muted mt-2">— Head of Product, SaaS scale-up</p>
            </div>
          </div>
        </div>
      </section>

      {/* TRUSTED BY — renders only once real clients exist in the CMS */}
      <TrustedBy />

      {/* WHAT WE DO — centered header + four columns split by hairline rules */}
      <section className="border-b border-[var(--line)] bg-white" data-testid="what-we-do-section">
        <div className="max-w-7xl mx-auto px-6 lg:px-10 py-20 lg:py-24">
          <div className="text-center max-w-2xl mx-auto">
            <div className="eyebrow eyebrow-center mb-4">What we do</div>
            <h2 className="text-4xl sm:text-5xl">Analysis that drives meaningful change.</h2>
          </div>

          <div className="mt-14 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4">
            {CAPABILITIES.map((c, i) => (
              <div
                key={c.title}
                data-testid={`capability-${i}`}
                className={`px-0 sm:px-8 py-8 sm:py-2 ${
                  i > 0 ? "lg:border-l lg:border-[var(--line)]" : ""
                } ${i === 1 || i === 3 ? "sm:border-l sm:border-[var(--line)]" : ""} ${
                  i < CAPABILITIES.length - 1 ? "border-b sm:border-b-0 border-[var(--line)]" : ""
                } first:pl-0 last:pr-0`}
              >
                <c.icon size={26} weight="light" className="text-[var(--brand-ink)]" />
                <h3 className="text-lg mt-5">{c.title}</h3>
                <p className="text-sm text-[var(--ink-soft)] mt-2 leading-relaxed">{c.body}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* SECOND BANNER */}
      {banners[1] && (
        <section className="border-b border-[var(--line)] bg-[var(--brand-teal)] text-white">
          <div className="max-w-7xl mx-auto px-6 lg:px-10 py-12 flex flex-col md:flex-row gap-6 items-start md:items-center justify-between">
            <div className="max-w-2xl">
              <div className="text-xs font-mono uppercase tracking-[0.2em] text-[var(--brand-amber-light)] mb-2">Featured Program</div>
              <h2 className="text-3xl tracking-tight">{banners[1].title}</h2>
              <p className="text-white/70 mt-2">{banners[1].subtitle}</p>
            </div>
            <Link to={banners[1].cta_link} data-testid="hero-banner2-cta" className="btn-accent shrink-0">
              {banners[1].cta_label} <ArrowRight size={16} weight="bold" />
            </Link>
          </div>
        </section>
      )}

      {/* CATEGORY TREE (visual) */}
      <section className="border-b border-[var(--line)]">
        <div className="max-w-7xl mx-auto px-6 lg:px-10 py-20">
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-10">
            <div className="lg:col-span-4">
              <div className="eyebrow mb-4">Practice areas</div>
              <h2 className="text-4xl tracking-tight">How we engage.</h2>
              <p className="text-[var(--ink-soft)] mt-4 max-w-sm">Four practice areas. One senior analyst in the room from day one. Compose the engagement around the outcome you need.</p>
            </div>
            <div className="lg:col-span-8 grid grid-cols-1 sm:grid-cols-2 gap-px bg-[var(--line)] border border-[var(--line)]" data-testid="category-tree-section">
              {categories.map((c, i) => (
                <Link
                  key={c.id}
                  to={`/categories/${c.slug}`}
                  data-testid={`home-cat-${c.slug}`}
                  className="group bg-white p-7 hover:bg-[var(--paper-surface)] transition-colors flex flex-col gap-3"
                >
                  <div className="flex items-center justify-between">
                    <div className="font-mono text-xs text-[var(--brand-amber)]">0{i + 1}</div>
                    <ArrowUpRight size={18} className="text-[var(--ink-soft)] group-hover:text-[var(--brand-teal)] transition-transform group-hover:-translate-y-0.5 group-hover:translate-x-0.5" />
                  </div>
                  <h3 className="text-xl tracking-tight">{c.name}</h3>
                  <p className="text-sm text-[var(--ink-soft)]">{c.description}</p>
                </Link>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* SERVICES CAROUSEL */}
      <section className="border-b border-[var(--line)] bg-[var(--paper-surface)]">
        <div className="max-w-7xl mx-auto px-6 lg:px-10 py-20">
          <div className="flex items-end justify-between mb-10 gap-6 flex-wrap">
            <div>
              <div className="eyebrow mb-3">Featured services</div>
              <h2 className="text-4xl tracking-tight max-w-xl">Senior consulting, productized.</h2>
            </div>
            <Link to="/services" data-testid="view-all-services" className="text-sm font-mono uppercase tracking-wider text-[var(--brand-teal)] underline-offset-4 hover:underline">
              View all services →
            </Link>
          </div>

          <div className="flex gap-5 overflow-x-auto no-scrollbar -mx-6 px-6 pb-4 snap-x" data-testid="services-carousel">
            {services.map((s) => (
              <Link
                key={s.id}
                to={`/services/${s.slug}`}
                data-testid={`service-card-${s.slug}`}
                className="snap-start shrink-0 w-[320px] sm:w-[360px] bg-white border border-[var(--line)] hover:border-[var(--brand-teal)] transition-colors flex flex-col group"
              >
                <div
                  className="h-44 bg-cover bg-center"
                  style={{ backgroundImage: `url(${s.image_url})` }}
                />
                <div className="p-6 flex-1 flex flex-col">
                  <div className="text-[10px] font-mono uppercase tracking-wider text-[var(--brand-amber)] mb-2">{s.duration || "Custom"}</div>
                  <h3 className="text-lg tracking-tight">{s.name}</h3>
                  <p className="text-sm text-[var(--ink-soft)] mt-2 line-clamp-3">{s.short_description}</p>
                  <div className="hairline my-5" />
                  <div className="flex items-center justify-between">
                    <div className="text-sm font-mono text-[var(--ink)]">{s.price_label}</div>
                    <ArrowUpRight size={16} className="text-[var(--brand-teal)] group-hover:translate-x-0.5 group-hover:-translate-y-0.5 transition-transform" />
                  </div>
                </div>
              </Link>
            ))}
          </div>
        </div>
      </section>

      {/* WHY US BENTO */}
      <section className="border-b border-[var(--line)]">
        <div className="max-w-7xl mx-auto px-6 lg:px-10 py-20 grid grid-cols-1 md:grid-cols-12 gap-px bg-[var(--line)] border border-[var(--line)]">
          <div className="bg-white md:col-span-7 p-10">
            <div className="eyebrow mb-3">Why RK AI Labs</div>
            <h2 className="text-4xl tracking-tight">Clarity before code.</h2>
            <p className="text-[var(--ink-soft)] mt-4 max-w-lg leading-relaxed">
              A sharp problem statement and honest acceptance criteria de-risk a build more than any framework. We do both halves — senior business analysis and hands-on AI engineering.
            </p>
            <ul className="mt-6 space-y-3">
              {["Senior analyst in the room — never juniors","We build to learn: real users, real evidence","AI where it genuinely helps — not for its own sake","Engagement priced to outcomes, not bench hours"].map((t) => (
                <li key={t} className="flex items-start gap-2.5 text-sm text-[var(--ink)]"><CheckCircle size={18} weight="fill" className="text-[var(--brand-amber)] shrink-0 mt-0.5" />{t}</li>
              ))}
            </ul>
          </div>
          <div className="bg-[var(--brand-teal)] text-white md:col-span-5 p-10 relative grain overflow-hidden">
            <div className="text-xs font-mono uppercase tracking-[0.2em] text-[var(--brand-amber-light)] mb-3">Quick assessment</div>
            <h3 className="text-2xl tracking-tight mb-3">Not sure where to start?</h3>
            <p className="text-white/70 text-sm leading-relaxed mb-6">Tell us about your problem or process. We'll send a free 1-page diagnostic within 48 hours.</p>
            <Link to="/contact" data-testid="bento-cta" className="btn-accent">
              Get my diagnostic →
            </Link>
          </div>
        </div>
      </section>

      {/* LEAD CAPTURE */}
      <section id="lead" className="border-b border-[var(--line)]">
        <div className="max-w-5xl mx-auto px-6 lg:px-10 py-20 grid grid-cols-1 md:grid-cols-2 gap-10 items-start">
          <div>
            <div className="eyebrow mb-3">Start a conversation</div>
            <h2 className="text-4xl tracking-tight">Bring us your hardest problem.</h2>
            <p className="text-[var(--ink-soft)] mt-4 leading-relaxed max-w-md">
              Whether you're scoping requirements, evaluating an AI idea, or want to automate a painful process — a senior analyst will respond within one business day.
            </p>
            <div className="mt-8 space-y-3 text-sm">
              <div className="flex items-center gap-3"><CheckCircle weight="fill" size={18} className="text-[var(--brand-amber)]" />No-obligation 30-minute call</div>
              <div className="flex items-center gap-3"><CheckCircle weight="fill" size={18} className="text-[var(--brand-amber)]" />NDA-friendly, confidential by default</div>
              <div className="flex items-center gap-3"><CheckCircle weight="fill" size={18} className="text-[var(--brand-amber)]" />Senior consultant, no SDRs</div>
            </div>
          </div>
          <LeadForm source="home_lead" />
        </div>
      </section>

      {/* JSON-LD Organization */}
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify({
          "@context": "https://schema.org",
          "@type": "ProfessionalService",
          "name": "RK AI Labs",
          "description": "IT Business Analysis solutions and AI product building",
          "areaServed": "Worldwide",
          "address": { "@type": "PostalAddress", "addressLocality": "Delhi NCR", "addressCountry": "IN" },
          "telephone": "+91-98735-56197",
          "email": "hello@iamrohankapoor.com",
        }) }}
      />
    </div>
  );
}

function Stat({ n, label }) {
  return (
    <div>
      <div className="text-3xl tracking-tight text-[var(--gold)] font-semibold">{n}</div>
      <div className="text-xs on-dark-muted mt-1 leading-snug">{label}</div>
    </div>
  );
}
