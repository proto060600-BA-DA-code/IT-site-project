# RK AI Labs — project rules

Consulting-studio site: FastAPI + MongoDB backend (`backend/`, Render service
`ascendai-backend`), React CRA + craco frontend (`frontend/`, Vercel). Main repo:
`proto060600-BA-DA-code/IT-site-project`.

## What this product is — and isn't

- A lead-generation site with a CMS. Engagements are sold through conversation →
  proposal → invoice, **not** a cart.
- Deliberately **not built**: cart, checkout, payments, coupons, bundles, stock /
  capacity / licence pools, ERP sync, shipping. Don't add them without a change in
  how the business sells.

## Architecture decisions

- **SEO:** `npm run build` → `postbuild` runs `scripts/prerender-meta.js`, which
  writes per-route `<head>` (title, description, canonical, OG, JSON-LD) from
  `GET /api/seo/routes`. Only `<head>` is touched, so there's no hydration risk.
  Body stays client-rendered. Next.js is the upgrade path if body SEO is needed.
- **RBAC:** one guard (`enforce_admin_rbac`) infers resource from the path and
  action from the method. Every admin router must use it or `require_permission`
  — never the older `require_admin` (it lets any role in).
- **Audit log:** ASGI middleware records every `/api/admin` write automatically.
- **Copy:** site chrome lives in Site settings; homepage copy lives in Page
  builder block props. Don't hardcode user-facing strings in JSX.

## Standing rules

1. A single source of truth per value — one setting, read everywhere.
2. Admins get an explanation, not just a state.
3. Unknown URLs return a real 404 (see `vercel.json` — no catch-all rewrite).
4. Hashed `/static/*` assets cache for a year; HTML always revalidates.
5. Never put personal data in a URL. Erasure takes the email in the body.
6. Escape every visitor-supplied value that goes into HTML, including emails.
7. Secrets only in env vars. `SITE_URL` must be the real domain on Render.
8. Spam is scored and kept for review, never silently dropped.

## Verifying changes

```
cd backend && pip install -r requirements-dev.txt && pytest tests -q
cd frontend && npm run build
```

Backend tests run on an in-memory MongoDB — no database or secrets needed.

## Gotchas

- Running `git` from the Linux sandbox leaves a `.git/index.lock` it can't delete.
  Let the user run git.
- An interrupted `npm install` corrupts `node_modules`; fix with a clean
  reinstall, not another `npm install`.
