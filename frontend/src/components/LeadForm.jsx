/* eslint-disable react/no-unescaped-entities */
import { useRef, useState } from "react";
import { Link } from "react-router-dom";
import { api } from "@/lib/api";
import { toast } from "sonner";
import { ArrowRight } from "@phosphor-icons/react";
import { useSettings } from "@/contexts/SettingsContext";

export default function LeadForm({ source = "lead_capture", serviceInterest = "", compact = false }) {
  const s = useSettings();
  const consentText =
    s.consent_text ||
    "I agree to RK AI Labs using these details to respond to my enquiry, as described in the Privacy Policy.";

  const [form, setForm] = useState({
    name: "", email: "", phone: "", company: "", service_interest: serviceInterest, message: "",
  });
  const [consent, setConsent] = useState(false);
  const [honeypot, setHoneypot] = useState("");
  // When the form first rendered. The server treats a sub-3-second submit as
  // a bot. A ref, not state, so it never changes on re-render.
  const startedAt = useRef(Date.now());
  const [submitting, setSubmitting] = useState(false);
  const [done, setDone] = useState(false);

  const update = (k) => (e) => setForm({ ...form, [k]: e.target.value });

  const submit = async (e) => {
    e.preventDefault();
    if (!consent) {
      toast.error("Please tick the consent box so we can reply to you.");
      return;
    }
    setSubmitting(true);
    try {
      await api.post("/leads", {
        ...form,
        source,
        consent: true,
        consent_text: consentText,
        website: honeypot,
        form_started_at: startedAt.current,
      });
      setDone(true);
      toast.success("Thanks! We'll be in touch within one business day.");
    } catch (err) {
      toast.error(err?.response?.data?.detail || "Could not submit. Please try again.");
    } finally {
      setSubmitting(false);
    }
  };

  if (done) {
    return (
      <div data-testid="lead-form-success" className="border border-[var(--brand-teal)] bg-white p-8 text-center">
        <div className="text-xs font-mono uppercase tracking-[0.2em] text-[var(--brand-amber)] mb-2">✓ Received</div>
        <h3 className="text-2xl tracking-tight mb-2">We'll be in touch.</h3>
        <p className="text-sm text-[var(--ink-soft)]">A senior consultant will reach out within one business day.</p>
      </div>
    );
  }

  return (
    <form onSubmit={submit} data-testid="lead-form" className="relative space-y-4 bg-white border border-[var(--line)] p-6 sm:p-8">
      <div className={`grid ${compact ? "grid-cols-1" : "grid-cols-1 md:grid-cols-2"} gap-4`}>
        <Field label="Full name *" required value={form.name} onChange={update("name")} testid="lead-name" />
        <Field label="Work email *" type="email" required value={form.email} onChange={update("email")} testid="lead-email" />
        <Field label="Phone" value={form.phone} onChange={update("phone")} testid="lead-phone" />
        <Field label="Company" value={form.company} onChange={update("company")} testid="lead-company" />
      </div>
      <Field label="Service of interest" value={form.service_interest} onChange={update("service_interest")} testid="lead-service" />
      <div>
        <label className="block text-xs font-mono uppercase tracking-wider text-[var(--ink-soft)] mb-1.5">Tell us a bit more</label>
        <textarea
          data-testid="lead-message"
          value={form.message}
          onChange={update("message")}
          rows={4}
          className="w-full bg-[var(--paper-surface)] border border-[var(--line)] px-3 py-2.5 text-sm focus:outline-none focus:border-[var(--brand-teal)]"
          placeholder="What problem are you trying to solve?"
        />
      </div>

      {/* Honeypot: off-screen and skipped by keyboard and screen readers, so
          only bots fill it. Not display:none — some bots skip hidden fields. */}
      <div aria-hidden="true" style={{ position: "absolute", left: "-10000px", width: 1, height: 1, overflow: "hidden" }}>
        <label>
          Website
          <input type="text" name="website" tabIndex={-1} autoComplete="off"
            value={honeypot} onChange={(e) => setHoneypot(e.target.value)} />
        </label>
      </div>

      <label className="flex items-start gap-2.5 text-xs text-[var(--ink-soft)] leading-relaxed cursor-pointer">
        <input
          type="checkbox"
          data-testid="lead-consent"
          required
          checked={consent}
          onChange={(e) => setConsent(e.target.checked)}
          className="mt-0.5 w-4 h-4 shrink-0 accent-[var(--brand-ink)]"
        />
        <span>
          {consentText}{" "}
          <Link to="/privacy" className="underline hover:text-[var(--ink)]">Privacy Policy</Link>
        </span>
      </label>

      <button
        data-testid="lead-submit"
        disabled={submitting}
        className="btn-accent disabled:opacity-50 w-full md:w-auto"
        type="submit"
      >
        {submitting ? "Sending…" : "Send inquiry"} <ArrowRight size={16} weight="bold" />
      </button>
    </form>
  );
}

function Field({ label, type = "text", required, value, onChange, testid }) {
  return (
    <div>
      <label className="block text-xs font-mono uppercase tracking-wider text-[var(--ink-soft)] mb-1.5">{label}</label>
      <input
        data-testid={testid}
        type={type}
        required={required}
        value={value}
        onChange={onChange}
        className="w-full bg-[var(--paper-surface)] border border-[var(--line)] px-3 py-2.5 text-sm focus:outline-none focus:border-[var(--brand-teal)]"
      />
    </div>
  );
}
