import { NavLink, Outlet, useNavigate } from "react-router-dom";
import { useEffect, useState } from "react";
import { useAuth } from "@/contexts/AuthContext";
import {
  House, Image, Tree, Briefcase, FileText, Users, Buildings, SignOut,
  ShieldCheck, UserCircle, Images, SquaresFour, ArrowCounterClockwise,
} from "@phosphor-icons/react";
import { SortableList, SortableItem, DragHandle } from "@/components/admin/Sortable";

// Canonical nav. The user's own order is layered on top of this, so adding an
// item here still shows up for people who have already customised their nav.
const NAV = [
  { id: "dashboard", to: "/admin", end: true, label: "Dashboard", icon: House },
  { id: "pagebuilder", to: "/admin/page-builder", label: "Page builder", icon: SquaresFour },
  { id: "banners", to: "/admin/banners", label: "Banners", icon: Image },
  { id: "clients", to: "/admin/clients", label: "Clients", icon: Buildings },
  { id: "categories", to: "/admin/categories", label: "Categories", icon: Tree },
  { id: "services", to: "/admin/services", label: "Services", icon: Briefcase },
  { id: "pages", to: "/admin/pages", label: "Pages (CMS)", icon: FileText },
  { id: "posts", to: "/admin/posts", label: "Blog / Insights", icon: FileText },
  { id: "media", to: "/admin/media", label: "Media", icon: Images },
  { id: "leads", to: "/admin/leads", label: "Leads", icon: Users },
  { id: "users", to: "/admin/users", label: "Users", icon: UserCircle },
  { id: "roles", to: "/admin/roles", label: "Roles & permissions", icon: ShieldCheck },
];

const ORDER_KEY = "rk_admin_nav_order";

function loadOrder() {
  try {
    const saved = JSON.parse(localStorage.getItem(ORDER_KEY) || "[]");
    if (!Array.isArray(saved) || !saved.length) return NAV;
    const byId = Object.fromEntries(NAV.map((n) => [n.id, n]));
    const ordered = saved.map((id) => byId[id]).filter(Boolean);
    // Anything added to NAV since the order was saved goes to the bottom.
    const missing = NAV.filter((n) => !saved.includes(n.id));
    return [...ordered, ...missing];
  } catch {
    return NAV;
  }
}

export default function AdminLayout() {
  const { user, loading, logout } = useAuth();
  const navigate = useNavigate();
  const [items, setItems] = useState(loadOrder);
  const [arranging, setArranging] = useState(false);

  useEffect(() => {
    if (!loading && !user) {
      navigate("/login", { state: { from: "/admin" }, replace: true });
    }
  }, [user, loading, navigate]);

  if (loading || !user) return <div className="p-12 text-center">Loading…</div>;

  const reorder = (next) => {
    setItems(next);
    localStorage.setItem(ORDER_KEY, JSON.stringify(next.map((n) => n.id)));
  };

  const resetOrder = () => {
    localStorage.removeItem(ORDER_KEY);
    setItems(NAV);
  };

  const navCls = ({ isActive }) =>
    `flex items-center gap-2.5 px-3 py-2 text-sm border-l-2 transition-colors ${
      isActive
        ? "border-[var(--gold)] bg-[var(--paper-surface)] text-[var(--ink)]"
        : "border-transparent text-[var(--ink-soft)] hover:bg-[var(--paper-surface)] hover:text-[var(--ink)]"
    }`;

  return (
    <div className="min-h-screen flex flex-col lg:flex-row bg-[var(--paper-surface)]" data-testid="admin-layout">
      <aside className="lg:w-64 lg:min-h-screen bg-white border-b lg:border-b-0 lg:border-r border-[var(--line)] flex flex-col">
        <div className="p-5 border-b border-[var(--line)]">
          <div className="flex items-center gap-2.5">
            <span className="inline-flex items-center justify-center w-9 h-9 bg-[var(--navy-950)] text-[var(--gold)] font-semibold text-[12px] tracking-tight">RK</span>
            <div className="min-w-0">
              <div className="text-sm font-semibold tracking-tight">Admin Console</div>
              <div className="text-[10px] font-mono uppercase tracking-wider text-[var(--ink-soft)] truncate">{user.email}</div>
            </div>
          </div>
        </div>

        <div className="px-3 pt-3 flex items-center justify-between">
          <span className="text-[10px] font-mono uppercase tracking-wider text-[var(--ink-soft)]">Navigation</span>
          <div className="flex items-center gap-2">
            {arranging && (
              <button onClick={resetOrder} title="Reset order" className="text-[var(--ink-soft)] hover:text-[var(--ink)]">
                <ArrowCounterClockwise size={12} />
              </button>
            )}
            <button
              onClick={() => setArranging((a) => !a)}
              data-testid="admin-nav-arrange"
              className="text-[10px] font-mono uppercase tracking-wider text-[var(--brand-ink)] hover:underline"
            >
              {arranging ? "done" : "arrange"}
            </button>
          </div>
        </div>

        <nav className="flex-1 py-2" data-testid="admin-nav">
          {arranging ? (
            <SortableList items={items} onReorder={reorder}>
              <div>
                {items.map((n) => (
                  <SortableItem key={n.id} id={n.id} className="bg-white">
                    {({ handleProps }) => (
                      <div className="flex items-center gap-2 px-3 py-2 text-sm text-[var(--ink-soft)]">
                        <DragHandle handleProps={handleProps} />
                        <n.icon size={16} /> {n.label}
                      </div>
                    )}
                  </SortableItem>
                ))}
              </div>
            </SortableList>
          ) : (
            items.map((n) => (
              <NavLink key={n.id} to={n.to} end={n.end} className={navCls} data-testid={`admin-nav-${n.id}`}>
                <n.icon size={16} /> {n.label}
              </NavLink>
            ))
          )}
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
