import { useEffect, useState } from "react";
import { api } from "@/lib/api";

export default function AdminDashboard() {
  const [stats, setStats] = useState(null);
  useEffect(() => { api.get("/admin/stats").then((r) => setStats(r.data)); }, []);

  const cards = [
    { k: "new_leads", label: "New leads", accent: true },
    { k: "leads", label: "Total leads" },
    { k: "services", label: "Services" },
    { k: "categories", label: "Categories" },
    { k: "banners", label: "Banners" },
    { k: "pages", label: "CMS pages" },
    { k: "users", label: "Users" },
  ];

  return (
    <div data-testid="admin-dashboard">
      <div className="eyebrow mb-3">Console</div>
      <h1 className="text-3xl tracking-tight mb-2">Dashboard</h1>
      <p className="text-sm text-[var(--ink-soft)] mb-8">Operational snapshot of the RK AI Labs site.</p>

      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4" data-testid="dashboard-stats">
        {cards.map((c) => (
          <div key={c.k} data-testid={`stat-${c.k}`} className={`bg-white border border-[var(--line)] p-5 ${c.accent ? "border-[var(--brand-amber)]" : ""}`}>
            <div className="text-[10px] font-mono uppercase tracking-wider text-[var(--ink-soft)]">{c.label}</div>
            <div className="text-3xl tracking-tight mt-2">{stats ? stats[c.k] : "—"}</div>
          </div>
        ))}
      </div>
    </div>
  );
}
