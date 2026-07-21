/* eslint-disable react/no-unescaped-entities */
import { useState } from "react";
import { Link, useNavigate, useLocation } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { toast } from "sonner";

export default function Login() {
  const { login } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const from = location.state?.from || "/";
  const [form, setForm] = useState({ email: "", password: "" });
  const [busy, setBusy] = useState(false);

  const submit = async (e) => {
    e.preventDefault();
    setBusy(true);
    try {
      const user = await login(form.email, form.password);
      toast.success(`Welcome back, ${user.name.split(" ")[0]}.`);
      navigate(user.role === "admin" ? "/admin" : from, { replace: true });
    } catch (err) {
      toast.error(err?.response?.data?.detail || "Invalid credentials");
    } finally { setBusy(false); }
  };

  return (
    <div className="min-h-[70vh] grid grid-cols-1 lg:grid-cols-2" data-testid="login-page">
      <div className="hidden lg:block bg-[var(--brand-teal)] text-white relative grain overflow-hidden">
        <div className="absolute inset-0 p-12 flex flex-col justify-between">
          <div className="text-xs font-mono uppercase tracking-[0.2em] text-[var(--brand-amber-light)]">RK AI Labs · Sign in</div>
          <div>
            <div className="text-3xl tracking-tight max-w-md">"They framed the problem, then built it. We had a working AI prototype in six weeks."</div>
            <div className="text-xs font-mono uppercase tracking-wider text-white/60 mt-4">— Head of Product, SaaS scale-up</div>
          </div>
        </div>
      </div>
      <div className="flex items-center justify-center p-8 lg:p-16">
        <form onSubmit={submit} className="w-full max-w-md space-y-6">
          <div>
            <div className="eyebrow mb-3">Welcome back</div>
            <h1 className="text-4xl tracking-tight">Sign in to your account.</h1>
          </div>
          <Field label="Email" type="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} testid="login-email" required />
          <Field label="Password" type="password" value={form.password} onChange={(e) => setForm({ ...form, password: e.target.value })} testid="login-password" required />
          <button type="submit" disabled={busy} data-testid="login-submit" className="btn-accent w-full justify-center">
            {busy ? "Signing in…" : "Sign in →"}
          </button>
          <div className="text-sm text-[var(--ink-soft)] text-center">
            New here? <Link to="/register" data-testid="link-to-register" className="text-[var(--brand-teal)] underline-offset-4 underline">Create an account</Link>
          </div>
        </form>
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
