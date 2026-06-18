import { NavLink, Outlet, useNavigate } from "react-router-dom";
import { useEffect } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { House, Image, Tree, Briefcase, FileText, Users, SignOut } from "@phosphor-icons/react";

export default function AdminLayout() {
  const { user, loading, logout } = useAuth();
  const navigate = useNavigate();

  useEffect(() => {
    if (!loading && (!user || user.role !== "admin")) {
      navigate("/login", { state: { from: "/admin" }, replace: true });
    }
  }, [user, loading, navigate]);

  if (loading || !user) return <div className="p-12 text-center">Loading…</div>;

  const navCls = ({ isActive }) =>
    `flex items-center gap-2.5 px-3 py-2 text-sm border-l-2 transition-colors ${
      isActive ? "border-[var(--brand-amber)] bg-[var(--paper-surface)] text-[var(--ink)]" : "border-transparent text-[var(--ink-soft)] hover:bg-[var(--paper-surface)] hover:text-[var(--ink)]"
    }`;

  return (
    <div className="min-h-screen flex flex-col lg:flex-row bg-[var(--paper-surface)]" data-testid="admin-layout">
      <aside className="lg:w-64 lg:min-h-screen bg-white border-b lg:border-b-0 lg:border-r border-[var(--line)] flex flex-col">
        <div className="p-5 border-b border-[var(--line)]">
          <div className="flex items-center gap-2.5">
            <span className="inline-flex items-center justify-center w-9 h-9 bg-[var(--brand-teal)] text-[var(--brand-amber-light)] font-bold text-[13px] font-mono">A</span>
            <div>
              <div className="text-sm font-semibold tracking-tight">Admin Console</div>
              <div className="text-[10px] font-mono uppercase tracking-wider text-[var(--ink-soft)]">{user.email}</div>
            </div>
          </div>
        </div>
        <nav className="flex-1 py-4">
          <NavLink to="/admin" end className={navCls} data-testid="admin-nav-dashboard"><House size={16} /> Dashboard</NavLink>
          <NavLink to="/admin/banners" className={navCls} data-testid="admin-nav-banners"><Image size={16} /> Banners</NavLink>
          <NavLink to="/admin/categories" className={navCls} data-testid="admin-nav-categories"><Tree size={16} /> Categories</NavLink>
          <NavLink to="/admin/services" className={navCls} data-testid="admin-nav-services"><Briefcase size={16} /> Services</NavLink>
          <NavLink to="/admin/pages" className={navCls} data-testid="admin-nav-pages"><FileText size={16} /> Pages (CMS)</NavLink>
          <NavLink to="/admin/posts" className={navCls} data-testid="admin-nav-posts"><FileText size={16} /> Blog / Insights</NavLink>
          <NavLink to="/admin/leads" className={navCls} data-testid="admin-nav-leads"><Users size={16} /> Leads</NavLink>
        </nav>
        <div className="p-4 border-t border-[var(--line)] space-y-2">
          <button onClick={() => navigate("/")} className="text-xs font-mono uppercase tracking-wider text-[var(--ink-soft)] hover:text-[var(--ink)]" data-testid="admin-back-to-site">← Back to site</button>
          <button onClick={() => { logout(); navigate("/"); }} className="flex items-center gap-2 text-xs font-mono uppercase tracking-wider text-[var(--ink-soft)] hover:text-[var(--ink)]" data-testid="admin-logout"><SignOut size={12} /> Sign out</button>
        </div>
      </aside>
      <main className="flex-1 p-6 lg:p-10 overflow-x-hidden">
        <Outlet />
      </main>
    </div>
  );
}
