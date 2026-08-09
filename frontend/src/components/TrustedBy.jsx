import { useEffect, useState } from "react";
import { api } from "@/lib/api";

/**
 * Dark navy "Trusted by" band.
 *
 * Deliberately renders NOTHING until at least one active client exists in the
 * CMS. No placeholder logos — an invented client list is the first thing a
 * real prospect scrutinises. Add clients under Admin → Clients and the band
 * switches itself on.
 */
export default function TrustedBy({ label = "Trusted by ambitious organizations" }) {
  const [clients, setClients] = useState([]);

  useEffect(() => {
    api
      .get("/clients")
      .then((r) => setClients(Array.isArray(r.data) ? r.data : []))
      .catch(() => setClients([]));
  }, []);

  if (clients.length === 0) return null;

  return (
    <section className="band-dark border-b border-[var(--line-dark)]" data-testid="trusted-by-band">
      <div className="max-w-7xl mx-auto px-6 lg:px-10 py-12">
        <div className="text-center text-[11px] uppercase tracking-[0.2em] on-dark-muted">
          {label}
        </div>

        <div className="mt-8 flex flex-wrap items-center justify-center gap-x-14 gap-y-8">
          {clients.map((c) => {
            const mark = c.logo_url ? (
              <img
                src={c.logo_url}
                alt={c.name}
                className="h-7 w-auto object-contain opacity-70 hover:opacity-100 transition-opacity"
                loading="lazy"
              />
            ) : (
              /* No logo file yet — fall back to a wordmark so the row still reads */
              <span className="text-sm uppercase tracking-[0.16em] text-[var(--slate-200)] opacity-75 hover:opacity-100 transition-opacity">
                {c.name}
              </span>
            );

            return c.website ? (
              <a
                key={c.id}
                href={c.website}
                target="_blank"
                rel="noreferrer noopener"
                data-testid={`client-${c.id}`}
              >
                {mark}
              </a>
            ) : (
              <div key={c.id} data-testid={`client-${c.id}`}>
                {mark}
              </div>
            );
          })}
        </div>
      </div>
    </section>
  );
}
