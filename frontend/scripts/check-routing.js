#!/usr/bin/env node
/**
 * Prebuild guard: fail the build rather than ship routing that 404s.
 *
 * Catches two mistakes, both of which only show up in production (client-side
 * navigation hides them — you only see the 404 on refresh or a shared link):
 *
 *  1. With `cleanUrls: true`, Vercel redirects /index.html → /, so a rewrite
 *     to "/index.html" never resolves and every route 404s. (This shipped once.)
 *  2. A page added to the React Router config without a matching rewrite in
 *     vercel.json 404s when loaded directly.
 */
const fs = require("fs");
const path = require("path");

const root = path.join(__dirname, "..");
const vercel = JSON.parse(fs.readFileSync(path.join(root, "vercel.json"), "utf8"));
const app = fs.readFileSync(path.join(root, "src", "App.js"), "utf8");

const errors = [];
const rewrites = vercel.rewrites || [];

if (vercel.cleanUrls) {
  for (const r of rewrites) {
    if (/\.html?$/.test(r.destination)) {
      errors.push(
        `Rewrite "${r.source}" → "${r.destination}": with cleanUrls on, drop the extension ` +
        `(use "/index"). Otherwise every one of these routes returns 404.`
      );
    }
  }
}

// Turn a vercel source like "/services/:slug" or "/admin/:path*" into a regex.
const toRegex = (src) =>
  new RegExp(
    "^" +
      src
        .replace(/[.+?^${}()|[\]\\]/g, "\\$&")
        .replace(/\/:[a-zA-Z]+\*/g, "(?:/.*)?")
        .replace(/:[a-zA-Z]+/g, "[^/]+") +
      "$"
  );
const matchers = rewrites.map((r) => toRegex(r.source));

// Top-level absolute routes from App.js. Nested admin children are relative
// paths and are covered by the /admin/:path* rewrite.
const routes = [...app.matchAll(/<Route\s+path="(\/[^"]*)"/g)].map((m) => m[1]);
for (const r of routes) {
  if (r === "/") continue; // served by index.html directly
  const sample = r.replace(/:[a-zA-Z]+/g, "example");
  if (!matchers.some((rx) => rx.test(sample))) {
    errors.push(`Route "${r}" has no rewrite in vercel.json — it will 404 when loaded directly.`);
  }
}

// index.html is the shell for every page. A canonical in it tells Google every
// page is a duplicate of one URL — this shipped once. Per-page canonicals are
// written by prerender-meta.js instead.
const shell = fs.readFileSync(path.join(root, "public", "index.html"), "utf8")
  .replace(/<!--[\s\S]*?-->/g, "");
if (/<link[^>]+rel=["']canonical["']/i.test(shell) || /property=["']og:url["']/i.test(shell)) {
  errors.push(
    "public/index.html contains a canonical link or og:url. It's the shell for every page, " +
    "so every page would claim the same URL. Remove it — prerender-meta.js writes per-page ones."
  );
}

if (errors.length) {
  console.error("\n✖ Routing check failed:\n");
  errors.forEach((e) => console.error("  • " + e));
  console.error("");
  process.exit(1);
}
console.log(`✓ Routing check: ${routes.length} routes, ${rewrites.length} rewrites, all reachable.`);
