import { Link } from "react-router-dom";
import { useSettings } from "@/contexts/SettingsContext";
import { Phone, EnvelopeSimple, MapPin, LinkedinLogo, XLogo } from "@phosphor-icons/react";

export default function Footer() {
  const s = useSettings();

  return (
    <footer className="bg-[var(--navy-950)] text-white" data-testid="site-footer">
      <div className="max-w-7xl mx-auto px-6 lg:px-10 py-16 grid grid-cols-1 md:grid-cols-12 gap-10">
        <div className="md:col-span-5">
          <div className="flex items-center gap-3 mb-5">
            <span className="inline-flex items-center justify-center w-10 h-10 bg-[var(--gold)] text-[var(--navy-950)] font-semibold text-sm tracking-tight">RK</span>
            <div>
              <div className="text-lg font-semibold tracking-tight">{s.brand_name}</div>
              <div className="text-[11px] font-mono uppercase tracking-[0.2em] text-white/70">{s.founded}</div>
            </div>
          </div>
          <p className="text-sm text-white/75 leading-relaxed max-w-md">
            {s.footer_description}
          </p>
          {(s.linkedin || s.x) && (
            <div className="flex gap-3 mt-6">
              {s.linkedin && (
                <a href={s.linkedin} target="_blank" rel="noopener noreferrer" aria-label="LinkedIn" data-testid="footer-linkedin" className="w-9 h-9 inline-flex items-center justify-center border border-white/20 hover:bg-white/10 transition-colors">
                  <LinkedinLogo size={16} />
                </a>
              )}
              {s.x && (
                <a href={s.x} target="_blank" rel="noopener noreferrer" aria-label="X" data-testid="footer-x" className="w-9 h-9 inline-flex items-center justify-center border border-white/20 hover:bg-white/10 transition-colors">
                  <XLogo size={16} />
                </a>
              )}
            </div>
          )}
        </div>

        <div className="md:col-span-3">
          <div className="text-xs font-mono uppercase tracking-[0.2em] text-[var(--gold)] mb-4">{s.footer_links_heading}</div>
          <ul className="space-y-2.5 text-sm">
            <li><Link to="/about" data-testid="footer-link-about" className="text-white/80 hover:text-white">About us</Link></li>
            <li><Link to="/services" data-testid="footer-link-services" className="text-white/80 hover:text-white">Services</Link></li>
            <li><Link to="/insights" data-testid="footer-link-insights" className="text-white/80 hover:text-white">Insights</Link></li>
            <li><Link to="/contact" data-testid="footer-link-contact" className="text-white/80 hover:text-white">Contact Us</Link></li>
            <li><Link to="/privacy" data-testid="footer-link-privacy" className="text-white/80 hover:text-white">Privacy Policy</Link></li>
            <li><Link to="/terms" data-testid="footer-link-terms" className="text-white/80 hover:text-white">Terms &amp; Conditions</Link></li>
          </ul>
        </div>

        <div className="md:col-span-4">
          <div className="text-xs font-mono uppercase tracking-[0.2em] text-[var(--gold)] mb-4">{s.footer_contact_heading}</div>
          <ul className="space-y-3 text-sm">
            <li className="flex items-start gap-3"><Phone size={16} className="mt-0.5 text-[var(--gold)]" /><a href={`tel:${s.phone}`} className="text-white/90 hover:text-white" data-testid="footer-phone">{s.phone}</a></li>
            <li className="flex items-start gap-3"><EnvelopeSimple size={16} className="mt-0.5 text-[var(--gold)]" /><a href={`mailto:${s.email}`} className="text-white/90 hover:text-white" data-testid="footer-email">{s.email}</a></li>
            <li className="flex items-start gap-3"><MapPin size={16} className="mt-0.5 text-[var(--gold)]" /><span className="text-white/90" data-testid="footer-address">{s.address}</span></li>
          </ul>
        </div>
      </div>

      <div className="border-t border-white/10">
        <div className="max-w-7xl mx-auto px-6 lg:px-10 py-5 flex flex-col md:flex-row items-center justify-between gap-3">
          <div className="text-xs font-mono text-white/60">{s.footer_legal}</div>
          <div className="text-xs font-mono text-white/60">{s.footer_locale}</div>
        </div>
      </div>
    </footer>
  );
}
