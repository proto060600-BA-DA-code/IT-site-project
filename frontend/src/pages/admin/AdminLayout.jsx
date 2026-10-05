import { NavLink, Outlet, useLocation, useNavigate } from "react-router-dom";
import { useEffect, useState } from "react";
import { useAuth } from "@/contexts/AuthContext";
import {
  House, Image, Tree, Briefcase, FileText, Users, Buildings, SignOut,
  ShieldCheck, UserCircle, Images, SquaresFour, ArrowCounterClockwise, Gear, ClockCounterClockwise,
  Sun, Moon, Desktop, List, X,
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
  { id: "settings", to: "/admin/settings", label: "Site settings", icon: Gear },
  { id: "audit", to: "/admin/audit", label: "Audit log", icon: ClockCounterClockwise },
];

const ORDER_KEY = "rk_admin_nav_order";
const THEME_KEY = "rk_admin_theme"; // "light" | "dark" | "system"

const store = {
  get: (k) => { try { return localStorage.getItem(k); } catch { return null; } },
  set: (k, v) => { try { localStorage.setItem(k, v); } catch { /* private mode */ } },
  del: (k) => { try { localStorage.removeItem(k); } catch { /* private mode */ } },
};

function loadOrder() {
  try {
    const saved = JSON.parse(store.get(ORDER_KEY) || "[]");
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

/** Admin-only theme. Defaults to following the operating system. */
function useAdminTheme() {
  const [pref, setPref] = useState(() => store.get(THEME_KEY) || "system");
  const [systemDark, setSystemDark] = useState(
    () => window.matchMedia?.("(prefers-color-scheme: dark)").matches ?? false
  );

  useEffect(() => {
    const mq = window.matchMedia?.("(prefers-color-scheme: dark)");
    if (!mq) return undefined;
    const onChange = (e) => setSystemDark(e.matches);
    mq.addEventListener?.("change", onChange);
    return () => mq.removeEventListener?.("change", onChange);
  }, []);

  const choose = (next) => {
    setPref(next);
    if (next === "system") store.del(THEME_KEY);
    else store.set(THEME_KEY, next);
  };

  const resolved = pref === "system" ? (systemDark ? "dark" : "light") : pref;
  return { pref, resolved, choose };
}

const THEME_OPTIONS = [
  { id: "light", label: "Light", icon: Sun },
  { id: "dark", label: "Dark", icon: Moon },
  { id: "system", label: "System", icon: Desktop },
];

function ThemeSwitch({ pref, choose }) {
  return (
    <div role="radiogroup" aria-label="Admin theme" className="flex border border-[var(--line)]" data-testid="admin-theme">
      {THEME_OPTIONS.map((o) => {
        const active = pref === o.id;
        return (
          <button
            key={o.id}
            role="radio"
            aria-checked={active}
            title={o.label}
            onClick={() => choose(o.id)}
            data-testid={`admin-theme-${o.id}`}
            className={`flex-1 flex items-center justify-center gap-1.5 py-1.5 text-[11px] transition-colors ${
              active ? "bg-[var(--selected-bg)] text-[var(--selected-fg)]" : "text-[var(--ink-soft)] hover:text-[var(--ink)]"
            }`}
          >
            <o.icon size={13} weight={active ? "fill" : "regular"} /> {o.label}
          </button>
        );
      })}
    </div>
  );
}

export default function AdminLayout() {
  const { user, loading, logout } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [items, setItems] = useState(loadOrder);
  const [arranging, setArranging] = useState(false);
  const [drawer, setDrawer] = useState(false);
  const { pref, resolved, choose } = useAdminTheme();

  useEffect(() => {
    if (!loading && !user) {
      navigate("/login", { state: { from: "/admin" }, replace: true });
    }
  }, [user, loading, navigate]);

  // Close the phone drawer whenever the route changes.
  useEffect(() => { setDrawer(false); }, [location.pathname]);

  useEffect(() => {
    if (!drawer) return undefined;
    const onKey = (e) => e.key === "Escape" && setDrawer(false);
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [drawer]);

  if (loading || !user) {
    return <div data-theme={resolved} className="min-h-screen p-12 text-center">Loading…</div>;
  }

  const reorder = (next) => {
    setItems(next);
    store.set(ORDER_KEY, JSON.stringify(next.map((n) => n.id)));
  };

  const resetOrder = () => {
    store.del(ORDER_KEY);
    setItems(NAV);
  };

  const navCls = ({ isActive }) =>
    `flex items-center gap-2.5 px-3 py-2.5 lg:py-2 text-sm border-l-2 transition-colors ${
      isActive
        ? "border-[var(--gold)] bg-[var(--paper-surface)] text-[var(--ink)]"
        : "border-transparent text-[var(--ink-soft)] hover:bg-[var(--paper-surface)] hover:text-[var(--ink)]"
    }`;

  const current = items.find((n) =>
    n.end ? location.pathname === n.to : location.pathname.startsWith(n.to)
  );

  return (
    <div
      data-theme={resolved}
      className="min-h-screen flex flex-col lg:flex-row bg-[var(--paper-surface)] text-[var(--ink)]"
      data-testid="admin-layout"
    >
      {/* Phone / tablet top bar */}
      <div className="lg:hidden sticky top-0 z-30 flex items-center gap-3 px-4 h-14 bg-white border-b border-[var(--line)]">
        <button
          onClick={() => setDrawer(true)}
          aria-label="Open admin menu"
          aria-expanded={drawer}
          aria-controls="admin-sidebar"
          className="w-10 h-10 -ml-2 flex items-center justify-center"
          data-testid="admin-menu-toggle"
        >
          <List size={22} />
        </button>
        <div className="flex-1 min-w-0 text-sm font-semibold truncate">{current?.label || "Admin"}</div>
        <button
          onClick={() => choose(resolved === "dark" ? "light" : "dark")}
          aria-label={resolved === "dark" ? "Switch to light mode" : "Switch to dark mode"}
          className="w-10 h-10 -mr-2 flex items-center justify-center text-[var(--ink-soft)]"
        >
          {resolved === "dark" ? <Sun size={20} /> : <Moon size={20} />}
        </button>
      </div>

      {drawer && (
        <div className="lg:hidden fixed inset-0 z-40 bg-black/50" onClick={() => setDrawer(false)} aria-hidden="true" />
      )}

      <aside
        id="admin-sidebar"
        className={`fixed lg:static inset-y-0 left-0 z-50 w-72 lg:w-64 max-w-[85vw] lg:min-h-screen bg-white border-r border-[var(--line)] flex flex-col transition-transform duration-200 lg:translate-x-0 ${
          // invisible as well as off-screen, so keyboard Tab can't wander
          // into a closed drawer on phones.
          drawer ? "translate-x-0" : "-translate-x-full max-lg:invisible"
        }`}
      >
        <div className="p-5 border-b border-[var(--line)] flex items-center gap-2.5">
          <span className="inline-flex items-center justify-center w-9 h-9 bg-navy-950 text-[var(--gold)] font-semibold text-[12px] tracking-tight shrink-0">RK</span>
          <div className="min-w-0 flex-1">
            <div className="text-sm font-semibold tracking-tight">Admin Console</div>
            <div className="text-[10px] font-mono uppercase tracking-wider text-[var(--ink-soft)] truncate">{user.email}</div>
          </div>
          <button onClick={() => setDrawer(false)} aria-label="Close admin menu" className="lg:hidden w-9 h-9 -mr-2 flex items-center justify-center text-[var(--ink-soft)]">
            <X size={20} />
          </button>
        </div>

        <div className="px-3 pt-3 flex items-center justify-between">
          <span className="text-[10px] font-mono uppercase tracking-wider text-[var(--ink-soft)]">Navigation</span>
          <div className="flex items-center gap-2">
            {arranging && (
              <button onClick={resetOrder} title="Reset order" aria-label="Reset navigation order" className="text-[var(--ink-soft)] hover:text-[var(--ink)]">
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

        <nav className="flex-1 py-2 overflow-y-auto" data-testid="admin-nav" aria-label="Admin">
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

        <div className="p-4 border-t border-[var(--line)] space-y-3" style={{ paddingBottom: "max(1rem, env(safe-area-inset-bottom))" }}>
          <ThemeSwitch pref={pref} choose={choose} />
          <div className="flex items-center justify-between">
            <button onClick={() => navigate("/")} className="text-xs font-mono uppercase tracking-wider text-[var(--ink-soft)] hover:text-[var(--ink)]" data-testid="admin-back-to-site">← Site</button>
            <button onClick={() => { logout(); navigate("/"); }} className="flex items-center gap-2 text-xs font-mono uppercase tracking-wider text-[var(--ink-soft)] hover:text-[var(--ink)]" data-testid="admin-logout"><SignOut size={12} /> Sign out</button>
          </div>
        </div>
      </aside>

      <main className="flex-1 min-w-0 p-4 sm:p-6 lg:p-10 overflow-x-hidden">
        <Outlet />
      </main>
    </div>
  );
}
