/**
 * Block registry — maps a saved block `type` to a React component.
 *
 * Every block reads its copy from `props`, falling back to the original
 * hardcoded string when a field is blank. That means an unedited site looks
 * exactly as it did before, but every line becomes editable in the page
 * builder the moment someone types over it.
 */
import { Link } from "react-router-dom";
import {
  ArrowRight, ArrowUpRight, CheckCircle, Quotes, PlayCircle,
  Compass, ChartLineUp, Cpu, ShieldCheck, Lightbulb, Gear, Users, Target,
} from "@phosphor-icons/react";
import LeadForm from "@/components/LeadForm";
import TrustedBy from "@/components/TrustedBy";
import ReactMarkdownLite from "@/components/ReactMarkdownLite";

// Icon names offered to the `icon` field in the builder.
const ICONS = { Compass, ChartLineUp, Cpu, ShieldCheck, Lightbulb, Gear, Users, Target, CheckCircle };
const Icon = ({ name, ...rest }) => {
  const C = ICONS[name] || Compass;
  return <C {...rest} />;
};

/** Use the saved value, or the original default when it's blank. */
const t = (value, fallback) => (value === undefined || value === "" ? fallback : value);

function Stat({ n, label }) {
  return (
    <div>
      <div className="text-3xl tracking-tight text-[var(--gold)] font-semibold">{n}</div>
      <div className="text-xs on-dark-muted mt-1 leading-snug">{label}</div>
    </div>
  );
}

/* ── Hero ─────────────────────────────────────────────────────────────── */
function HeroBlock({ props: p, ctx }) {
  const banner = ctx.banners?.[0] || {};
  const image = t(p.image_url, banner.image_url);
  const title = t(p.title, banner.title);

  return (
    <section className="band-dark relative overflow-hidden" data-testid="hero-section">
      {image && (
        <div className="absolute inset-y-0 right-0 w-full lg:w-1/2 pointer-events-none" aria-hidden="true">
          <img src={image} alt="" className="h-full w-full object-cover" loading="eager" />
          <div className="absolute inset-0" style={{
            background:
              "linear-gradient(to right, var(--navy-950) 0%, rgba(13,19,33,0.92) 28%, rgba(13,19,33,0.55) 65%, rgba(13,19,33,0.35) 100%)",
          }} />
        </div>
      )}
      <div className="absolute inset-0 lg:hidden bg-[var(--navy-950)]/80 pointer-events-none" aria-hidden="true" />

      <div className="relative max-w-7xl mx-auto px-6 lg:px-10 py-20 lg:py-28 grid grid-cols-1 lg:grid-cols-12 gap-10 items-end">
        <div className="lg:col-span-7 rise">
          <div className="eyebrow eyebrow-invert mb-6" data-testid="hero-eyebrow">
            {t(p.eyebrow, "IT Business Analysis · AI Product Building · Delhi NCR")}
          </div>
          <h1 className="text-5xl sm:text-6xl lg:text-7xl tracking-tight leading-[1.02] max-w-3xl">
            {title || (<>Business analysis meets <span className="marker">AI product</span> building.</>)}
          </h1>
          <p className="mt-6 text-lg on-dark-soft max-w-xl leading-relaxed">
            {t(p.subtitle, banner.subtitle) ||
              "From requirements and process discovery to shipped AI products and automations — led by senior analysts who build, not just advise."}
          </p>
          <div className="mt-9 flex flex-wrap gap-3">
            <Link to={t(p.cta_link, banner.cta_link) || "/contact"} data-testid="hero-primary-cta" className="btn-accent">
              {t(p.cta_label, banner.cta_label) || "Book a Consultation"} <ArrowRight size={16} weight="bold" />
            </Link>
            <Link to={t(p.secondary_link, "/services")} data-testid="hero-secondary-cta" className="btn-ghost-invert">
              <PlayCircle size={18} weight="fill" /> {t(p.secondary_label, "Explore services")}
            </Link>
          </div>
        </div>

        {p.show_stats !== false && (
          <div className="lg:col-span-5 rise rise-d2">
            <div className="border border-[var(--line-dark)] bg-[var(--navy-900)]/80 backdrop-blur-sm p-6">
              <div className="text-xs font-mono uppercase tracking-[0.2em] text-[var(--gold)] mb-3">
                {t(p.stats_label, "Selected outcomes")}
              </div>
              <div className="grid grid-cols-2 gap-x-4 gap-y-5">
                {(p.stats?.length ? p.stats : DEFAULT_STATS).map((s, i) => (
                  <Stat key={i} n={s.n} label={s.label} />
                ))}
              </div>
              <div className="hairline my-6" />
              <p className="text-sm on-dark-soft italic flex gap-3">
                <Quotes size={20} weight="fill" className="text-[var(--gold)] shrink-0" />
                {t(p.quote, "They framed the problem, then built it. We had a working AI prototype in six weeks.")}
              </p>
              <p className="text-xs font-mono uppercase tracking-wider on-dark-muted mt-2">
                {t(p.quote_author, "— Head of Product, SaaS scale-up")}
              </p>
            </div>
          </div>
        )}
      </div>
    </section>
  );
}

const DEFAULT_STATS = [
  { n: "6 wks", label: "From problem statement to working AI MVP" },
  { n: "2-in-1", label: "Senior business analysis + AI engineering" },
  { n: "100%", label: "Builds shipped with a baseline & eval" },
  { n: "48h", label: "Turnaround on a free 1-page diagnostic" },
];

/* ── Trusted by ───────────────────────────────────────────────────────── */
const TrustedByBlock = ({ props: p }) => (
  <TrustedBy label={t(p.label, "Trusted by ambitious organizations")} />
);

/* ── Capabilities (what we do) ────────────────────────────────────────── */
const DEFAULT_CAPS = [
  { icon: "Compass", title: "Strategy", body: "Frame the real problem before anyone writes code. Discovery, process mapping and a defensible business case." },
  { icon: "ChartLineUp", title: "Transformation", body: "Turn strategy into a shippable backlog — epics, user stories and the ceremonies that keep delivery honest." },
  { icon: "Cpu", title: "AI Products", body: "Design and build LLM features and automations that reach production, each with a baseline and an eval." },
  { icon: "ShieldCheck", title: "Governance", body: "Keep AI accountable — evaluation harnesses, guardrails and the documentation your auditors will ask for." },
];

function CapabilitiesBlock({ props: p }) {
  const items = p.items?.length ? p.items : DEFAULT_CAPS;
  return (
    <section className="border-b border-[var(--line)] bg-white" data-testid="what-we-do-section">
      <div className="max-w-7xl mx-auto px-6 lg:px-10 py-20 lg:py-24">
        <div className="text-center max-w-2xl mx-auto">
          <div className="eyebrow eyebrow-center mb-4">{t(p.eyebrow, "What we do")}</div>
          <h2 className="text-4xl sm:text-5xl">{t(p.title, "Analysis that drives meaningful change.")}</h2>
        </div>
        <div className="mt-14 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4">
          {items.map((c, i) => (
            <div key={i} data-testid={`capability-${i}`}
              className={`px-0 sm:px-8 py-8 sm:py-2 ${i > 0 ? "lg:border-l lg:border-[var(--line)]" : ""} ${
                i % 2 === 1 ? "sm:border-l sm:border-[var(--line)]" : ""
              } ${i < items.length - 1 ? "border-b sm:border-b-0 border-[var(--line)]" : ""} first:pl-0 last:pr-0`}>
              <Icon name={c.icon} size={26} weight="light" className="text-[var(--brand-ink)]" />
              <h3 className="text-lg mt-5">{c.title}</h3>
              <p className="text-sm text-[var(--ink-soft)] mt-2 leading-relaxed">{c.body}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

/* ── Call-out banner ──────────────────────────────────────────────────── */
function BannerBlock({ props: p, ctx }) {
  const b = ctx.banners?.[1];
  const title = t(p.title, b?.title);
  if (!title) return null;
  return (
    <section className="border-b border-[var(--line)] bg-[var(--brand-ink)] text-white">
      <div className="max-w-7xl mx-auto px-6 lg:px-10 py-12 flex flex-col md:flex-row gap-6 items-start md:items-center justify-between">
        <div className="max-w-2xl">
          <div className="text-xs font-mono uppercase tracking-[0.2em] text-[var(--gold)] mb-2">
            {t(p.eyebrow, "Featured Program")}
          </div>
          <h2 className="text-3xl tracking-tight">{title}</h2>
          <p className="text-white/70 mt-2">{t(p.subtitle, b?.subtitle)}</p>
        </div>
        <Link to={t(p.cta_link, b?.cta_link) || "/contact"} data-testid="hero-banner2-cta" className="btn-accent shrink-0">
          {t(p.cta_label, b?.cta_label) || "Learn more"} <ArrowRight size={16} weight="bold" />
        </Link>
      </div>
    </section>
  );
}

/* ── Practice areas ───────────────────────────────────────────────────── */
function CategoryTreeBlock({ props: p, ctx }) {
  return (
    <section className="border-b border-[var(--line)]">
      <div className="max-w-7xl mx-auto px-6 lg:px-10 py-20">
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-10">
          <div className="lg:col-span-4">
            <div className="eyebrow mb-4">{t(p.eyebrow, "Practice areas")}</div>
            <h2 className="text-4xl tracking-tight">{t(p.title, "How we engage.")}</h2>
            <p className="text-[var(--ink-soft)] mt-4 max-w-sm">
              {t(p.body, "Four practice areas. One senior analyst in the room from day one. Compose the engagement around the outcome you need.")}
            </p>
          </div>
          <div className="lg:col-span-8 grid grid-cols-1 sm:grid-cols-2 gap-px bg-[var(--line)] border border-[var(--line)]" data-testid="category-tree-section">
            {(ctx.categories || []).map((c, i) => (
              <Link key={c.id} to={`/categories/${c.slug}`} data-testid={`home-cat-${c.slug}`}
                className="group bg-white p-7 hover:bg-[var(--paper-surface)] transition-colors flex flex-col gap-3">
                <div className="flex items-center justify-between">
                  <div className="font-mono text-xs text-[var(--gold)]">0{i + 1}</div>
                  <ArrowUpRight size={18} className="text-[var(--ink-soft)] group-hover:text-[var(--brand-ink)] transition-transform group-hover:-translate-y-0.5 group-hover:translate-x-0.5" />
                </div>
                <h3 className="text-xl tracking-tight">{c.name}</h3>
                <p className="text-sm text-[var(--ink-soft)]">{c.description}</p>
              </Link>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}

/* ── Featured services ────────────────────────────────────────────────── */
function ServicesCarouselBlock({ props: p, ctx }) {
  return (
    <section className="border-b border-[var(--line)] bg-[var(--paper-surface)]">
      <div className="max-w-7xl mx-auto px-6 lg:px-10 py-20">
        <div className="flex items-end justify-between mb-10 gap-6 flex-wrap">
          <div>
            <div className="eyebrow mb-3">{t(p.eyebrow, "Featured services")}</div>
            <h2 className="text-4xl tracking-tight max-w-xl">{t(p.title, "Senior consulting, productized.")}</h2>
          </div>
          <Link to="/services" data-testid="view-all-services" className="text-sm font-mono uppercase tracking-wider text-[var(--brand-ink)] underline-offset-4 hover:underline">
            {t(p.link_label, "View all services →")}
          </Link>
        </div>
        <div className="flex gap-5 overflow-x-auto no-scrollbar -mx-6 px-6 pb-4 snap-x" data-testid="services-carousel">
          {(ctx.services || []).map((s) => (
            <Link key={s.id} to={`/services/${s.slug}`} data-testid={`service-card-${s.slug}`}
              className="snap-start shrink-0 w-[320px] sm:w-[360px] bg-white border border-[var(--line)] hover:border-[var(--brand-ink)] transition-colors flex flex-col group">
              <div className="h-44 bg-cover bg-center" style={{ backgroundImage: `url(${s.image_url})` }} />
              <div className="p-6 flex-1 flex flex-col">
                <div className="text-[10px] font-mono uppercase tracking-wider text-[var(--gold)] mb-2">{s.duration || "Custom"}</div>
                <h3 className="text-lg tracking-tight">{s.name}</h3>
                <p className="text-sm text-[var(--ink-soft)] mt-2 line-clamp-3">{s.short_description}</p>
                <div className="hairline my-5" />
                <div className="flex items-center justify-between">
                  <div className="text-sm font-mono text-[var(--ink)]">{s.price_label}</div>
                  <ArrowUpRight size={16} className="text-[var(--brand-ink)] group-hover:translate-x-0.5 group-hover:-translate-y-0.5 transition-transform" />
                </div>
              </div>
            </Link>
          ))}
        </div>
      </div>
    </section>
  );
}

/* ── Why us (bento) ───────────────────────────────────────────────────── */
const DEFAULT_WHY = [
  { title: "Senior analyst in the room — never juniors" },
  { title: "We build to learn: real users, real evidence" },
  { title: "AI where it genuinely helps — not for its own sake" },
  { title: "Engagement priced to outcomes, not bench hours" },
];

function WhyUsBlock({ props: p }) {
  const items = p.items?.length ? p.items : DEFAULT_WHY;
  return (
    <section className="border-b border-[var(--line)]">
      <div className="max-w-7xl mx-auto px-6 lg:px-10 py-20 grid grid-cols-1 md:grid-cols-12 gap-px bg-[var(--line)] border border-[var(--line)]">
        <div className="bg-white md:col-span-7 p-10">
          <div className="eyebrow mb-3">{t(p.eyebrow, "Why RK AI Labs")}</div>
          <h2 className="text-4xl tracking-tight">{t(p.title, "Clarity before code.")}</h2>
          <p className="text-[var(--ink-soft)] mt-4 max-w-lg leading-relaxed">
            {t(p.body, "A sharp problem statement and honest acceptance criteria de-risk a build more than any framework. We do both halves — senior business analysis and hands-on AI engineering.")}
          </p>
          <ul className="mt-6 space-y-3">
            {items.map((it, i) => (
              <li key={i} className="flex items-start gap-2.5 text-sm text-[var(--ink)]">
                <CheckCircle size={18} weight="fill" className="text-[var(--gold)] shrink-0 mt-0.5" />
                {it.title || it.body}
              </li>
            ))}
          </ul>
        </div>
        <div className="bg-[var(--brand-ink)] text-white md:col-span-5 p-10 relative grain overflow-hidden">
          <div className="text-xs font-mono uppercase tracking-[0.2em] text-[var(--gold)] mb-3">{t(p.aside_eyebrow, "Quick assessment")}</div>
          <h3 className="text-2xl tracking-tight mb-3">{t(p.aside_title, "Not sure where to start?")}</h3>
          <p className="text-white/70 text-sm leading-relaxed mb-6">
            {t(p.aside_body, "Tell us about your problem or process. We'll send a free 1-page diagnostic within 48 hours.")}
          </p>
          <Link to={t(p.aside_cta_link, "/contact")} data-testid="bento-cta" className="btn-accent">
            {t(p.aside_cta_label, "Get my diagnostic →")}
          </Link>
        </div>
      </div>
    </section>
  );
}

/* ── Lead capture ─────────────────────────────────────────────────────── */
const DEFAULT_BULLETS = [
  "No-obligation 30-minute call",
  "NDA-friendly, confidential by default",
  "Senior consultant, no SDRs",
];

function LeadFormBlock({ props: p }) {
  const bullets = p.bullets?.length ? p.bullets : DEFAULT_BULLETS;
  return (
    <section id="lead" className="border-b border-[var(--line)]">
      <div className="max-w-5xl mx-auto px-6 lg:px-10 py-20 grid grid-cols-1 md:grid-cols-2 gap-10 items-start">
        <div>
          <div className="eyebrow mb-3">{t(p.eyebrow, "Start a conversation")}</div>
          <h2 className="text-4xl tracking-tight">{t(p.title, "Bring us your hardest problem.")}</h2>
          <p className="text-[var(--ink-soft)] mt-4 leading-relaxed max-w-md">
            {t(p.body, "Whether you're scoping requirements, evaluating an AI idea, or want to automate a painful process — a senior analyst will respond within one business day.")}
          </p>
          <div className="mt-8 space-y-3 text-sm">
            {bullets.map((b, i) => (
              <div key={i} className="flex items-center gap-3">
                <CheckCircle weight="fill" size={18} className="text-[var(--gold)]" />{b}
              </div>
            ))}
          </div>
        </div>
        <LeadForm source="home_lead" />
      </div>
    </section>
  );
}

/* ── Rich text & spacer ───────────────────────────────────────────────── */
const RichTextBlock = ({ props: p }) => (
  <section className="border-b border-[var(--line)]">
    <div className={`max-w-3xl mx-auto px-6 lg:px-10 py-20 ${p.centered ? "text-center" : ""}`}>
      {p.title && <h2 className="text-4xl tracking-tight mb-6">{p.title}</h2>}
      <div className="prose-ciq"><ReactMarkdownLite text={p.body || ""} /></div>
    </div>
  </section>
);

const SpacerBlock = ({ props: p }) => {
  const h = { small: "py-6", medium: "py-14", large: "py-24" }[p.size || "medium"];
  return <div className={h}>{p.rule && <div className="max-w-7xl mx-auto px-6 lg:px-10"><div className="hairline" /></div>}</div>;
};

export const BLOCK_COMPONENTS = {
  hero: HeroBlock,
  trusted_by: TrustedByBlock,
  capabilities: CapabilitiesBlock,
  banner: BannerBlock,
  category_tree: CategoryTreeBlock,
  services_carousel: ServicesCarouselBlock,
  why_us: WhyUsBlock,
  lead_form: LeadFormBlock,
  rich_text: RichTextBlock,
  spacer: SpacerBlock,
};

/**
 * Renders a saved layout. `ctx` carries the CMS collections the blocks need
 * (banners, services, categories) so each block doesn't refetch them.
 */
export default function BlockRenderer({ blocks, ctx = {} }) {
  return (
    <>
      {(blocks || []).map((b) => {
        const C = BLOCK_COMPONENTS[b.type];
        if (!C) return null; // unknown type — skip rather than crash the page
        return <C key={b.id} props={b.props || {}} ctx={ctx} />;
      })}
    </>
  );
}
