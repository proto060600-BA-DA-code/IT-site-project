#!/usr/bin/env node
/**
 * Postbuild: write one static HTML file per public route with real <head>
 * metadata (title, description, canonical, Open Graph, Twitter, JSON-LD).
 *
 * Why this and not a full prerender:
 *   - Crawlers, link previews (LinkedIn, WhatsApp, Slack) and most AI crawlers
 *     don't execute JavaScript. They need the <head> to be correct in the HTML.
 *   - We only touch <head>. React never hydrates <head> here, so there is no
 *     hydration-mismatch risk — the failure mode a full DOM prerender brings.
 *   - The body stays client-rendered. Moving to Next.js later remains open.
 *
 * Output: build/<path>.html for each route (served at /<path> via vercel.json
 * `cleanUrls`), build/index.html for "/", and build/404.html with noindex.
 *
 * Never fails the build. If the API is unreachable, it logs a warning and the
 * site ships exactly as a normal CRA build would.
 */
const fs = require("fs");
const path = require("path");

const BUILD = path.join(__dirname, "..", "build");
const TIMEOUT_MS = 60_000; // Render's free tier can take ~50s to wake up.

function readEnvFile(name) {
  try {
    const raw = fs.readFileSync(path.join(__dirname, "..", name), "utf8");
    const out = {};
    for (const line of raw.split(/\r?\n/)) {
      const m = /^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/.exec(line);
      if (m) out[m[1]] = m[2].replace(/^["']|["']$/g, "");
    }
    return out;
  } catch {
    return {};
  }
}

function apiBase() {
  const fromEnv = process.env.SEO_API_URL || process.env.REACT_APP_BACKEND_URL;
  if (fromEnv) return fromEnv.replace(/\/$/, "");
  const file = { ...readEnvFile(".env"), ...readEnvFile(".env.production") };
  return (file.SEO_API_URL || file.REACT_APP_BACKEND_URL || "").replace(/\/$/, "");
}

const esc = (s) =>
  String(s ?? "")
    .replace(/&/g, "&amp;")
    .replace(/"/g, "&quot;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");

// Prevent a "</script>" inside any JSON string from closing the tag early.
const safeJson = (obj) => JSON.stringify(obj).replace(/</g, "\\u003c");

// Every tag we own. Stripped from the template, then re-emitted per route, so
// nothing is ever duplicated.
const OWNED = [
  /<title>[\s\S]*?<\/title>/gi,
  /<meta\s+name="description"[^>]*>/gi,
  /<meta\s+name="robots"[^>]*>/gi,
  /<meta\s+property="og:[^"]*"[^>]*>/gi,
  /<meta\s+name="twitter:[^"]*"[^>]*>/gi,
  /<link\s+rel="canonical"[^>]*>/gi,
  /<script\s+type="application\/ld\+json">[\s\S]*?<\/script>/gi,
];

function stripOwned(html) {
  return OWNED.reduce((h, rx) => h.replace(rx, ""), html);
}

function headFor(r, brand, { noindex = false } = {}) {
  const tags = [
    `<title>${esc(r.title)}</title>`,
    `<meta name="description" content="${esc(r.description)}"/>`,
    noindex ? `<meta name="robots" content="noindex"/>` : "",
    r.canonical && !noindex ? `<link rel="canonical" href="${esc(r.canonical)}"/>` : "",
    `<meta property="og:type" content="${r.path?.startsWith("/insights/") ? "article" : "website"}"/>`,
    `<meta property="og:site_name" content="${esc(brand)}"/>`,
    `<meta property="og:locale" content="en_IN"/>`,
    `<meta property="og:title" content="${esc(r.title)}"/>`,
    `<meta property="og:description" content="${esc(r.description)}"/>`,
    r.canonical ? `<meta property="og:url" content="${esc(r.canonical)}"/>` : "",
    r.image ? `<meta property="og:image" content="${esc(r.image)}"/>` : "",
    `<meta name="twitter:card" content="${r.image ? "summary_large_image" : "summary"}"/>`,
    `<meta name="twitter:title" content="${esc(r.title)}"/>`,
    `<meta name="twitter:description" content="${esc(r.description)}"/>`,
    r.image ? `<meta name="twitter:image" content="${esc(r.image)}"/>` : "",
    r.jsonld ? `<script type="application/ld+json">${safeJson(r.jsonld)}</script>` : "",
  ];
  return tags.filter(Boolean).join("");
}

function inject(template, head) {
  return stripOwned(template).replace(/<\/head>/i, `${head}</head>`);
}

function outFile(routePath) {
  if (routePath === "/") return path.join(BUILD, "index.html");
  const clean = routePath.replace(/^\/+|\/+$/g, "");
  // Refuse anything that could escape the build directory.
  if (!clean || clean.includes("..") || /[^a-z0-9\-/_]/i.test(clean)) return null;
  return path.join(BUILD, `${clean}.html`);
}

async function fetchManifest(base) {
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), TIMEOUT_MS);
  try {
    const res = await fetch(`${base}/api/seo/routes`, { signal: ctrl.signal });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    return await res.json();
  } finally {
    clearTimeout(timer);
  }
}

async function main() {
  const templatePath = path.join(BUILD, "index.html");
  if (!fs.existsSync(templatePath)) {
    console.warn("[prerender-meta] build/index.html not found — skipping.");
    return;
  }
  const template = fs.readFileSync(templatePath, "utf8");

  const base = apiBase();
  // On CI (Vercel), a localhost URL can never answer — don't wait 60s for it.
  if (!base || (process.env.CI && /localhost|127\.0\.0\.1/.test(base))) {
    console.warn("[prerender-meta] No reachable API URL — shipping without per-route meta.");
    return;
  }

  let manifest;
  try {
    manifest = await fetchManifest(base);
  } catch (e) {
    console.warn(`[prerender-meta] Could not reach ${base}/api/seo/routes (${e.message}).`);
    console.warn("[prerender-meta] Shipping without per-route meta. The site still works.");
    return;
  }

  // Wrong canonicals are worse than none: they tell Google every page is a
  // duplicate of another site. The backend falls back to example.com when
  // SITE_URL isn't set on Render, so refuse to ship that.
  const site = manifest.site_url || "";
  if (!site || /example\.(com|org|net)/i.test(site) || /localhost/i.test(site)) {
    console.warn(`[prerender-meta] Backend SITE_URL is "${site || "unset"}" — refusing to write canonical URLs.`);
    console.warn("[prerender-meta] Set SITE_URL on the Render service to your real domain, then redeploy.");
    return;
  }

  const brand = manifest.brand || "RK AI Labs";
  let written = 0;
  for (const r of manifest.routes || []) {
    const file = outFile(r.path);
    if (!file) {
      console.warn(`[prerender-meta] Skipping unsafe path: ${r.path}`);
      continue;
    }
    fs.mkdirSync(path.dirname(file), { recursive: true });
    fs.writeFileSync(file, inject(template, headFor(r, brand)));
    written++;
  }

  // A real 404 page: same app shell (React renders NotFound), but served with
  // a 404 status by Vercel and marked noindex so it never enters the index.
  fs.writeFileSync(
    path.join(BUILD, "404.html"),
    inject(template, headFor(
      { title: `Page not found · ${brand}`, description: "This page does not exist." },
      brand,
      { noindex: true }
    ))
  );

  console.log(`[prerender-meta] Wrote head metadata for ${written} routes + 404.html.`);
}

main().catch((e) => {
  // Belt and braces: this script must never break a deploy.
  console.warn("[prerender-meta] Unexpected error, skipping:", e.message);
});
