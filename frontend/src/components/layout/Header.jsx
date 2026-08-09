import { Link, NavLink } from "react-router-dom";
import { useEffect, useState } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { api } from "@/lib/api";
import { BRAND } from "@/lib/brand";
import { List, X, CaretDown, User as UserIcon } from "@phosphor-icons/react";

function Logo() {
  return (
    <Link to="/" className="flex items-center gap-3">
      <div className="leading-tight">
        <div className="text-[16px] font-semibold tracking-tight text-[var(--off-white)]">
          RK AI Labs
        </div>

        <div className="text-[10px] uppercase tracking-[0.18em] text-[var(--gold)]">
          Business & AI Solutions
        </div>
      </div>
    </Link>
  );
}

export default function Header() {
  const { user, logout } = useAuth();
  const [categories, setCategories] = useState([]);
  const [open, setOpen] = useState(false);
  const [catOpen, setCatOpen] = useState(false);

  useEffect(() => {
    api.get("/categories").then((r) => setCategories(r.data)).catch(() => {});
  }, []);

  const navLinkCls = ({ isActive }) =>
    `text-sm font-medium tracking-tight transition-colors ${isActive ? "text-[var(--gold)]" : "text-[var(--slate-200)] hover:text-[var(--gold)]"}`;

  return (
    <>
      <div className="bg-[var(--navy-900)] text-[var(--slate-200)] text-xs">
        <div className="max-w-7xl mx-auto px-6 lg:px-10 py-2 flex justify-between">
          <span>
            Business Analysis • AI Solutions • Digital Transformation
          </span>
          <span className="hidden md:block text-[var(--gold)]">
            Free Discovery Call Available
          </span>
        </div>
      </div>

      <header className="sticky top-0 z-40 bg-[var(--navy-950)]/95 backdrop-blur border-b border-[var(--line-dark)]">
        <div className="max-w-7xl mx-auto px-6 lg:px-10 h-16 flex items-center justify-between">
        <div className="flex items-center gap-8">
          <Logo />
          <nav className="hidden lg:flex items-center gap-7" data-testid="primary-nav">
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
                onClick={() => setCatOpen(false)}
              >
                <span className="flex items-center gap-1">Services <CaretDown size={12} weight="bold" /></span>
              </NavLink>
              {catOpen && (
                <div className="absolute top-full left-0 mt-0 w-[520px] bg-[var(--navy-900)] border border-[var(--line-dark)] shadow-2xl p-6 grid grid-cols-2 gap-1">
                  <Link
                    to="/services"
                    className="col-span-2 flex items-center justify-between px-3 py-2.5 hover:bg-white/5 border-b border-[var(--line-dark)] mb-1"
                  >
                    <span className="text-sm font-semibold text-[var(--gold)]">
                      All Services
                    </span>
                  </Link>

                  {categories.map((c) => (
                    <Link
                      key={c.id}
                      to={`/categories/${c.slug}`}
                      className="px-3 py-2.5 hover:bg-white/5"
                    >
                      <div className="text-sm font-medium text-[var(--off-white)]">
                        {c.name}
                      </div>

                      <div className="text-xs on-dark-muted">
                        {c.description}
                      </div>
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

        <div className="flex items-center gap-3">
          {user ? (
            <div className="hidden md:flex items-center gap-3">
              {user.role === "admin" && (
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
          ) : (
            <Link to="/login" data-testid="nav-login" className="hidden md:inline-block text-sm font-medium text-[var(--slate-200)] hover:text-[var(--gold)]">
              Sign in
            </Link>
          )}
          <Link to="/contact" data-testid="header-cta" className="hidden md:inline-flex btn-accent !py-2 !px-4 text-sm">
            Book a consultation →
          </Link>
          <button
            data-testid="mobile-menu-toggle"
            onClick={() => setOpen(!open)}
            className="lg:hidden p-2 -mr-2 text-[var(--off-white)]"
            aria-label="menu"
          >
            {open ? <X size={22} /> : <List size={22} />}
          </button>
        </div>
      </div>

      {open && (
        <div className="lg:hidden border-t border-[var(--line-dark)] bg-[var(--navy-950)] text-[var(--slate-200)]" data-testid="mobile-nav">
          <div className="px-6 py-4 flex flex-col gap-3">
            <Link to="/" onClick={() => setOpen(false)} className="py-1.5 text-sm">Home</Link>
            <Link to="/services" onClick={() => setOpen(false)} className="py-1.5 text-sm">Services</Link>
            <Link to="/about" onClick={() => setOpen(false)} className="py-1.5 text-sm">About</Link>
            <Link to="/insights" onClick={() => setOpen(false)} className="py-1.5 text-sm">Insights</Link>
            <Link to="/contact" onClick={() => setOpen(false)} className="py-1.5 text-sm">Contact</Link>
            <div className="hairline my-2" style={{ background: "var(--line-dark)" }} />
            {user ? (
              <>
                {user.role === "admin" && <Link to="/admin" onClick={() => setOpen(false)} className="py-1.5 text-sm text-[var(--gold)]">Admin</Link>}
                <button onClick={() => { logout(); setOpen(false); }} className="text-left py-1.5 text-sm">Logout</button>
              </>
            ) : (
              <Link to="/login" onClick={() => setOpen(false)} className="py-1.5 text-sm">Sign in</Link>
            )}
            <Link to="/contact" onClick={() => setOpen(false)} className="btn-accent text-center text-sm mt-2">Book a consultation</Link>
          </div>
        </div>
      )}
    </header>
    </>
  );
}
