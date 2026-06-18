/* eslint-disable react/no-unescaped-entities */
import { useParams, Link } from "react-router-dom";
import { ArrowLeft, CheckCircle, Package, Clock } from "@phosphor-icons/react";
import LeadForm from "@/components/LeadForm";
import { useApiResource } from "@/hooks/useApiResource";

export default function ServicePDP() {
  const { slug } = useParams();
  const { data: service, error } = useApiResource(`/services/${slug}`);

  if (error) return <div className="max-w-3xl mx-auto p-12 text-center text-[var(--ink-soft)]">Service not found. <Link to="/services" className="underline">Back to services</Link></div>;
  if (!service) return <div className="max-w-3xl mx-auto p-12 text-center text-[var(--ink-soft)]">Loading…</div>;

  return (
    <div data-testid="service-pdp">
      <section className="border-b border-[var(--line)] bg-[var(--paper-surface)]">
        <div className="max-w-7xl mx-auto px-6 lg:px-10 py-16">
          <Link to="/services" data-testid="back-to-services" className="inline-flex items-center gap-2 text-sm text-[var(--ink-soft)] hover:text-[var(--brand-teal)] mb-6">
            <ArrowLeft size={14} /> All services
          </Link>
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-10">
            <div className="lg:col-span-7">
              <div className="eyebrow mb-4">{service.price_label}</div>
              <h1 data-testid="service-name" className="text-5xl sm:text-6xl tracking-tight">{service.name}</h1>
              <p className="mt-5 text-lg text-[var(--ink-soft)] max-w-xl leading-relaxed">{service.short_description}</p>
              <div className="mt-7 flex flex-wrap gap-3">
                <a href="#engage" data-testid="pdp-cta" className="btn-accent">Engage this service →</a>
                <Link to="/contact" className="btn-ghost">Speak to a BA</Link>
              </div>
            </div>
            <div className="lg:col-span-5">
              <div className="aspect-[4/3] bg-cover bg-center border border-[var(--line)]" style={{ backgroundImage: `url(${service.image_url})` }} />
            </div>
          </div>
        </div>
      </section>

      <section className="border-b border-[var(--line)]">
        <div className="max-w-7xl mx-auto px-6 lg:px-10 py-16 grid grid-cols-1 lg:grid-cols-12 gap-10">
          <div className="lg:col-span-7">
            <div className="eyebrow mb-3">The engagement</div>
            <h2 className="text-3xl tracking-tight">Overview</h2>
            <p className="mt-4 text-[var(--ink-soft)] leading-relaxed whitespace-pre-line">{service.long_description}</p>

            {service.features?.length > 0 && (
              <>
                <h3 className="text-xl tracking-tight mt-10 mb-3">What's included</h3>
                <ul className="space-y-2.5">
                  {service.features.map((f) => (
                    <li key={f} className="flex items-start gap-2.5 text-[var(--ink)]"><CheckCircle weight="fill" size={18} className="text-[var(--brand-amber)] mt-0.5 shrink-0" />{f}</li>
                  ))}
                </ul>
              </>
            )}

            {service.deliverables?.length > 0 && (
              <>
                <h3 className="text-xl tracking-tight mt-10 mb-3">Deliverables</h3>
                <ul className="space-y-2.5">
                  {service.deliverables.map((d) => (
                    <li key={d} className="flex items-start gap-2.5 text-[var(--ink)]"><Package weight="duotone" size={18} className="text-[var(--brand-teal)] mt-0.5 shrink-0" />{d}</li>
                  ))}
                </ul>
              </>
            )}
          </div>

          <aside className="lg:col-span-5">
            <div className="sticky top-24 border border-[var(--line)] bg-white p-7 space-y-5">
              <Row k="Investment" v={service.price_label} />
              <Row k="Timeline" v={service.duration} icon={<Clock size={16} />} />
              <div className="hairline" />
              <p className="text-sm text-[var(--ink-soft)]">All engagements begin with a no-cost 30-minute scoping call.</p>
              <a href="#engage" className="btn-primary w-full justify-center">Request scoping call →</a>
            </div>
          </aside>
        </div>
      </section>

      <section id="engage" className="border-b border-[var(--line)] bg-[var(--paper-surface)]">
        <div className="max-w-5xl mx-auto px-6 lg:px-10 py-16">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-10">
            <div>
              <div className="eyebrow mb-3">Engage</div>
              <h2 className="text-3xl tracking-tight">Engage on {service.name}</h2>
              <p className="text-[var(--ink-soft)] mt-3">Fill in the form. A senior BA will respond within one business day with next steps.</p>
            </div>
            <LeadForm source={`pdp:${service.slug}`} serviceInterest={service.name} />
          </div>
        </div>
      </section>

      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify({
        "@context": "https://schema.org",
        "@type": "Service",
        "serviceType": service.name,
        "description": service.short_description,
        "provider": { "@type": "ProfessionalService", "name": "AscendAI" },
        "offers": { "@type": "Offer", "priceSpecification": { "@type": "PriceSpecification", "price": service.price_label } },
      }) }} />
    </div>
  );
}

function Row({ k, v, icon }) {
  return (
    <div className="flex items-center justify-between gap-4">
      <div className="text-xs font-mono uppercase tracking-wider text-[var(--ink-soft)] flex items-center gap-2">{icon}{k}</div>
      <div className="text-sm font-semibold text-[var(--ink)] text-right">{v}</div>
    </div>
  );
}
