import { Link } from "react-router-dom";

export default function NotFound() {
  return (
    <div className="min-h-[60vh] flex flex-col items-center justify-center text-center px-6" data-testid="not-found">
      <div className="text-[10px] font-mono uppercase tracking-[0.2em] text-[var(--brand-amber)] mb-3">404 · Off-stack</div>
      <h1 className="text-5xl tracking-tight mb-3">Page not found.</h1>
      <p className="text-[var(--ink-soft)] max-w-md">Looks like that page never made it out of discovery.</p>
      <Link to="/" data-testid="404-home" className="btn-primary mt-6">← Back home</Link>
    </div>
  );
}
