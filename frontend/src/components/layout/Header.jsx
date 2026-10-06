import { Link, NavLink, useLocation } from "react-router-dom";
import { useEffect, useState } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { api } from "@/lib/api";
import { useSettings } from "@/contexts/SettingsContext";
import { List, X, CaretDown, User as UserIcon } from "@phosphor-icons/react";

function Logo({ title, subtitle }) {
  return (
    <Link to="/" className="flex items-center gap-3 min-w-0" aria-label={`${title} — home`}>
      <div className="leading-tight min-w-0">
        <div className="text-[16px] font-semibold tracking-tight text-[var(--off-white)] whitespace-nowrap">
          {title}
        </div>
        {subtitle && (
          <div className="text-[10px] uppercase tracking-[0.16em] text-[var(--gold)] whitespace-nowrap truncate">
            {subtitle}
          </div>
        )}
      </div>
    </Link>
  );
}

export default function Header() {
  const { user, logout } = useAuth();
  const s = useSettings();
  const location = useLocation();
  const [categories, setCategories] = useState([]);
  const [open, setOpen] = useState(false);
  const [catOpen, setCatOpen] = useState(false);

  // Any RBAC role gets the Admin link, not only the legacy "admin" string.
  const canAdmin = !!user && (user.role === "admin" || !!user.role_id);

  useEffect(() => {
    api.get("/categories").then((r) => setCategories(r.data)).catch(() => {});
  }, []);

  // Close the mobile drawer on navigation…
  useEffect(() => { setOpen(false); setCatOpen(false); }, [location.pathname]);

  // …and on Escape, while locking background scroll behind it.
  useEffect(() => {
    if (!open) return undefined;
    const onKey = (e) => e.key === "Escape" && setOpen(false);
    document.addEventListener("keydown", onKey);
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = prev;
    };
  }, [open]);

  const navLinkCls = ({ isActive }) =>
    `text-sm font-medium tracking-tight transition-colors ${isActive ? "text-[var(--gold)]" : "text-[var(--slate-200)] hover:text-[var(--gold)]"}`;

  const drawerLinkCls = ({ isActive }) =>
    `block py-3 text-base border-b border-[var(--line-dark)] ${isActive ? "text-[var(--gold)]" : "text-[var(--off-white)]"}`;

  return (
    <>
      {s.announcement_enabled && (
        <div className="bg-navy-900 text-[var(--slate-200)] text-xs" data-testid="announcement-bar">
          <div className="max-w-7xl mx-auto px-5 lg:px-10 py-2 flex justify-between gap-4">
            <span className="truncate">{s.announcement_left}</span>
            <span className="hidden md:block shrink-0 text-[var(--gold)]">{s.announcement_right}</span>
          </div>
        </div>
      )}

      {/* Solid navy (95%) — previously `bg-[var(--navy-950)]/95`, which Tailwind
          silently dropped, leaving a transparent header and an invisible logo. */}
      <header className="sticky top-0 z-40 bg-navy-950/95 backdrop-blur border-b border-[var(--line-dark)]">
        <div className="max-w-7xl mx-auto px-5 lg:px-10 h-16 flex items-center justify-between gap-4">
          <div className="flex items-center gap-8 min-w-0">
            <Logo title={s.logo_title} subtitle={s.logo_subtitle} />
            <nav className="hidden lg:flex items-center gap-7" data-testid="primary-nav" aria-label="Primary">
              <NavLink to="/" end className={navLinkCls} data-testid="nav-home">Home</NavLink>
              <div
                className="relative"
                onMouseEnter={() => setCatOpen(true)}
                onMouseLeave={() => setCatOpen(false)}
              >
                <NavLink
                  to="/services"
                  data-testid="nav-services"
                  className={navLinkCls}
                  aria-haspopup="true"
                  aria-expanded={catOpen}
                  onFocus={() => setCatOpen(true)}
                  onClick={() => setCatOpen(false)}
                >
                  <span className="flex items-center gap-1">Services <CaretDown size={12} weight="bold" /></span>
                </NavLink>
                {catOpen && (
                  <div className="absolute top-full left-0 mt-0 w-[520px] bg-navy-900 border border-[var(--line-dark)] shadow-2xl p-6 grid grid-cols-2 gap-1">
                    <Link
                      to="/services"
                      className="col-span-2 flex items-center justify-between px-3 py-2.5 hover:bg-white/5 border-b border-[var(--line-dark)] mb-1"
                    >
                      <span className="text-sm font-semibold text-[var(--gold)]">All Services</span>
                    </Link>
                    {categories.map((c) => (
                      <Link key={c.id} to={`/categories/${c.slug}`} className="px-3 py-2.5 hover:bg-white/5"
                        onBlur={(e) => { if (!e.currentTarget.parentElement.contains(e.relatedTarget)) setCatOpen(false); }}>
                        <div className="text-sm font-medium text-[var(--off-white)]">{c.name}</div>
                        <div className="text-xs on-dark-muted">{c.description}</div>
                      </Link>
                    ))}
                  </div>
                )}
              </div>
              <NavLink to="/about" className={navLinkCls} data-testid="nav-about">About</NavLink>
              <NavLink to="/insights" className={navLinkCls} data-testid="nav-insights">Insights</NavLink>
              <NavLink to="/contact" className={navLinkCls} data-testid="nav-contact">Contact</NavLink>
            </nav>
          </div>

          <div className="flex items-center gap-3 shrink-0">
            {user ? (
              <div className="hidden md:flex items-center gap-3">
                {canAdmin && (
                  <Link to="/admin" data-testid="nav-admin" className="text-xs font-mono uppercase tracking-wider text-[var(--gold)] border border-[var(--gold)] px-3 py-1.5 hover:bg-[var(--gold)] hover:text-[var(--navy-950)] transition-colors">
                    Admin
                  </Link>
                )}
                <div className="flex items-center gap-2 text-sm text-[var(--slate-200)]">
                  <UserIcon size={16} /> {user.name.split(" ")[0]}
                </div>
                <button data-testid="logout-btn" onClick={logout} className="text-sm text-[var(--slate-200)] hover:text-[var(--gold)]">
                  Logout
                </button>
              </div>
            ) : null}
            <Link to={s.header_cta_link || "/contact"} data-testid="header-cta" className="hidden md:inline-flex btn-accent !py-2 !px-4 text-sm whitespace-nowrap">
              {s.header_cta_label}
            </Link>
            <button
              data-testid="mobile-menu-toggle"
              onClick={() => setOpen(!open)}
              className="lg:hidden w-11 h-11 -mr-2 flex items-center justify-center text-[var(--off-white)]"
              aria-label={open ? "Close menu" : "Open menu"}
              aria-expanded={open}
              aria-controls="mobile-nav"
            >
              {open ? <X size={24} /> : <List size={24} />}
            </button>
          </div>
        </div>

        {open && (
          <nav
            id="mobile-nav"
            aria-label="Mobile"
            className="lg:hidden bg-navy-950 border-t border-[var(--line-dark)] overflow-y-auto"
            style={{ maxHeight: "calc(100dvh - 4rem)" }}
            data-testid="mobile-nav"
          >
            <div className="px-5 pt-2 pb-[calc(1.5rem+env(safe-area-inset-bottom))]">
              <NavLink to="/" end className={drawerLinkCls}>Home</NavLink>
              <NavLink to="/services" className={drawerLinkCls}>Services</NavLink>
              {categories.map((c) => (
                <NavLink key={c.id} to={`/categories/${c.slug}`}
                  className={({ isActive }) => `block py-2.5 pl-4 text-sm border-b border-[var(--line-dark)] ${isActive ? "text-[var(--gold)]" : "on-dark-muted"}`}>
                  {c.name}
                </NavLink>
              ))}
              <NavLink to="/about" className={drawerLinkCls}>About</NavLink>
              <NavLink to="/insights" className={drawerLinkCls}>Insights</NavLink>
              <NavLink to="/contact" className={drawerLinkCls}>Contact</NavLink>

              <div className="pt-4 space-y-1">
                {user ? (
                  <>
                    {canAdmin && <Link to="/admin" className="block py-2.5 text-base text-[var(--gold)]">Admin</Link>}
                    <button onClick={logout} className="block w-full text-left py-2.5 text-base text-[var(--slate-200)]">Log out</button>
                  </>
                ) : null}
              </div>

              <Link to={s.header_cta_link || "/contact"} className="btn-accent w-full justify-center mt-5">
                {s.header_cta_label}
              </Link>
            </div>
          </nav>
        )}
      </header>
    </>
  );
}
