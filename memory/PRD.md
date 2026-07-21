# RK AI Labs — PRD

## Problem statement (verbatim)
Create a complete website for providing IT business analysis & AI product building. Owner is an IT Business Analyst who also builds AI products. Website should contain: signin/login, header with nav, category tree, homepage with marketing banners + product/service carousel + logo/favicon, proper footer (About/Contact/Privacy/Terms quick links, phone/email/address), PLP/PDP, lead capture form, integrated AI chat bot widget, CMS for frontend data, robots.txt + sitemap, SEO + schema markup, backend logic with Admin dashboard.

## User choices (gathered)
- AI chatbot: **Claude Sonnet 4.5** via **Emergent LLM Universal Key** (Ollama fallback declined)
- Auth: **JWT-based custom email/password**
- CMS: **Built-in custom CMS in Admin Dashboard**
- Brand: placeholders (**RK AI Labs**)
- Leads: **Stored in DB + Admin viewable** (no email integration)

## Architecture
- **Backend**: FastAPI under `/api`, MongoDB via motor, modular routers (auth, catalog, admin, chat, seo)
- **Frontend**: React Router + Tailwind + shadcn/ui + Phosphor icons, custom design system (deep teal + warm amber, Bricolage Grotesque + IBM Plex Sans + JetBrains Mono)
- **AI**: `emergentintegrations.LlmChat` streaming Claude `claude-sonnet-4-5-20250929`
- **Auth**: bcrypt + JWT (HS256, 72h), seeded admin on startup
- **SEO**: dynamic `/api/sitemap.xml` + static `/robots.txt`; JSON-LD ProfessionalService + Service schema

## Personas
- **Anonymous visitor** (CTO, VP Digital, Head of Ecom) — browses, chats with Aria, fills lead form
- **Authenticated user** — saves chat history (future), downloads playbooks
- **Admin (BA owner)** — manages all CMS data + leads pipeline

## Implemented (2026-02)
- Public site: Home (hero, banners, category tree, services carousel, why-us bento, lead capture), PLP (`/services` with category filter), PDP (`/services/:slug` with deliverables + schema), Category page, About/Privacy/Terms (CMS-driven), Contact (form), Login/Register, 404
- Header (with hover category tree dropdown), Footer (quick links + contact info + social), persistent Aria chat widget
- Admin: Dashboard (7 stat cards), CRUD for Banners/Categories/Services/Pages, Leads pipeline (4 status filters + status updates + expand-row detail)
- Backend: auth, catalog, admin CRUD, lead capture, chat streaming, sitemap, seed (admin + 4 cat + 2 banners + 6 services + 3 pages)
- SEO meta, OpenGraph, JSON-LD schema, favicon, robots, sitemap

## Backlog (P1)
- Blog/insights CMS section
- Newsletter signup
- File uploads for banner/service images (object storage)
- Email notifications on new lead (Resend/SendGrid)
- Multi-step intake flow with calendar booking
- Audit log of admin actions

## Backlog (P2)
- Multilingual (i18n)
- A/B testing framework for landing pages
- Case studies CMS module
