/* eslint-disable react/no-unescaped-entities */
import LeadForm from "@/components/LeadForm";
import { Phone, EnvelopeSimple, MapPin } from "@phosphor-icons/react";
import { BRAND } from "@/lib/brand";

export default function Contact() {
  return (
    <div data-testid="contact-page">
      <section className="border-b border-[var(--line)] bg-[var(--paper-surface)]">
        <div className="max-w-7xl mx-auto px-6 lg:px-10 py-16">
          <div className="eyebrow mb-4">Contact</div>
          <h1 className="text-5xl sm:text-6xl tracking-tight max-w-3xl">Let's build a defensible commerce roadmap.</h1>
          <p className="mt-5 max-w-xl text-[var(--ink-soft)]">Send me a note. I reply personally — no sales team — within one business day.</p>
        </div>
      </section>
      <section className="max-w-7xl mx-auto px-6 lg:px-10 py-16 grid grid-cols-1 lg:grid-cols-12 gap-10">
        <div className="lg:col-span-4">
          <h2 className="text-2xl tracking-tight mb-6">Reach us directly</h2>
          <ul className="space-y-5">
            <Item icon={<Phone size={18} weight="duotone" />} k="Phone" v={BRAND.phone} href={`tel:${BRAND.phone}`} testid="contact-phone" />
            <Item icon={<EnvelopeSimple size={18} weight="duotone" />} k="Email" v={BRAND.email} href={`mailto:${BRAND.email}`} testid="contact-email" />
            <Item icon={<MapPin size={18} weight="duotone" />} k="Office" v={BRAND.address} testid="contact-address" />
          </ul>
          <div className="hairline my-8" />
          <div className="text-xs font-mono uppercase tracking-[0.2em] text-[var(--brand-teal)] mb-3">Office hours</div>
          <p className="text-sm text-[var(--ink-soft)]">Mon — Fri · 9:00 — 18:00 PT<br/>Async responses 24/7</p>
        </div>
        <div className="lg:col-span-8">
          <LeadForm source="contact_form" />
        </div>
      </section>
    </div>
  );
}

function Item({ icon, k, v, href, testid }) {
  return (
    <li className="flex items-start gap-3">
      <span className="w-9 h-9 inline-flex items-center justify-center bg-[var(--paper-surface)] border border-[var(--line)] text-[var(--brand-teal)]">{icon}</span>
      <div>
        <div className="text-[11px] font-mono uppercase tracking-wider text-[var(--ink-soft)]">{k}</div>
        {href ? <a href={href} data-testid={testid} className="text-[var(--ink)] hover:text-[var(--brand-teal)]">{v}</a> : <span data-testid={testid}>{v}</span>}
      </div>
    </li>
  );
}
