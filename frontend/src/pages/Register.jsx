import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { toast } from "sonner";

export default function Register() {
  const { register } = useAuth();
  const navigate = useNavigate();
  const [form, setForm] = useState({ name: "", email: "", password: "" });
  const [busy, setBusy] = useState(false);

  const submit = async (e) => {
    e.preventDefault();
    setBusy(true);
    try {
      await register(form.name, form.email, form.password);
      toast.success("Account created.");
      navigate("/", { replace: true });
    } catch (err) {
      toast.error(err?.response?.data?.detail || "Registration failed");
    } finally { setBusy(false); }
  };

  return (
    <div className="min-h-[70vh] grid grid-cols-1 lg:grid-cols-2" data-testid="register-page">
      <div className="flex items-center justify-center p-8 lg:p-16 order-2 lg:order-1">
        <form onSubmit={submit} className="w-full max-w-md space-y-6">
          <div>
            <div className="eyebrow mb-3">Get started</div>
            <h1 className="text-4xl tracking-tight">Create your account.</h1>
          </div>
          <Field label="Full name" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} testid="register-name" required />
          <Field label="Work email" type="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} testid="register-email" required />
          <Field label="Password" type="password" value={form.password} onChange={(e) => setForm({ ...form, password: e.target.value })} testid="register-password" required />
          <button type="submit" disabled={busy} data-testid="register-submit" className="btn-accent w-full justify-center">
            {busy ? "Creating…" : "Create account →"}
          </button>
          <div className="text-sm text-[var(--ink-soft)] text-center">
            Already have one? <Link to="/login" data-testid="link-to-login" className="text-[var(--brand-teal)] underline-offset-4 underline">Sign in</Link>
          </div>
        </form>
      </div>
      <div className="hidden lg:block bg-[var(--paper-surface)] order-1 lg:order-2 p-12 relative">
        <div className="text-xs font-mono uppercase tracking-[0.2em] text-[var(--brand-teal)]">Why register?</div>
        <ul className="mt-6 space-y-4 text-sm text-[var(--ink)]">
          <li>✓ Save your scoping conversations</li>
          <li>✓ Download our diagnostics & playbooks</li>
          <li>✓ Get private invites to roundtables</li>
        </ul>
      </div>
    </div>
  );
}

function Field({ label, testid, ...rest }) {
  return (
    <div>
      <label className="block text-xs font-mono uppercase tracking-wider text-[var(--ink-soft)] mb-1.5">{label}</label>
      <input data-testid={testid} {...rest} className="w-full bg-[var(--paper-surface)] border border-[var(--line)] px-3 py-2.5 text-sm focus:outline-none focus:border-[var(--brand-teal)]" />
    </div>
  );
}
