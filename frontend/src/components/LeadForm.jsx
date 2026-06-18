/* eslint-disable react/no-unescaped-entities */
import { useState } from "react";
import { api } from "@/lib/api";
import { toast } from "sonner";
import { ArrowRight } from "@phosphor-icons/react";

export default function LeadForm({ source = "lead_capture", serviceInterest = "", compact = false }) {
  const [form, setForm] = useState({
    name: "", email: "", phone: "", company: "", service_interest: serviceInterest, message: "",
  });
  const [submitting, setSubmitting] = useState(false);
  const [done, setDone] = useState(false);

  const update = (k) => (e) => setForm({ ...form, [k]: e.target.value });

  const submit = async (e) => {
    e.preventDefault();
    setSubmitting(true);
    try {
      await api.post("/leads", { ...form, source });
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
    <form onSubmit={submit} data-testid="lead-form" className="space-y-4 bg-white border border-[var(--line)] p-6 sm:p-8">
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
