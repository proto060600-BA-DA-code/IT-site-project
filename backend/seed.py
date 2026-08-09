"""Seed default admin user + sample CMS data (idempotent)."""
import os
from db import db
from models import User, Banner, Category, Service, Page, now_iso
from auth import hash_password


async def seed_admin():
    email = os.environ["ADMIN_EMAIL"].lower()
    password = os.environ["ADMIN_PASSWORD"]
    existing = await db.users.find_one({"email": email})
    if existing:
        # make sure role is admin
        if existing.get("role") != "admin":
            await db.users.update_one({"email": email}, {"$set": {"role": "admin"}})
        return
    admin = User(
        email=email,
        name="RK AI Labs Admin",
        password_hash=hash_password(password),
        role="admin",
    )
    await db.users.insert_one(admin.model_dump())


async def seed_content():
    # POSTS (Insights)
    posts_seed = [
        {
            "slug": "what-a-business-analyst-actually-does-on-an-ai-project",
            "title": "What a Business Analyst actually does on an AI project",
            "excerpt": "AI projects fail for the same reason most IT projects fail: fuzzy problems, unclear success criteria and no owner for the trade-offs. Here is where a senior BA earns their keep.",
            "cover_image": "https://images.unsplash.com/photo-1552664730-d307ca884978",
            "author": "RK AI Labs Team",
            "tags": ["Business Analysis", "AI", "Delivery"],
            "meta_description": "How a senior Business Analyst de-risks an AI product build, from problem framing to acceptance criteria.",
            "status": "published",
            "read_time_min": 6,
            "body": """## The TL;DR

The hardest part of an AI project is rarely the model. It is deciding **which problem is worth solving**, **what 'good' looks like**, and **who owns the trade-offs** when the model is 85% accurate instead of 100%.

That is Business Analysis work — and on AI projects it matters more, not less.

## Where a BA earns their keep

- **Problem framing.** Translating "we want to use AI" into a specific, measurable job-to-be-done with a baseline to beat.
- **Data reality check.** Mapping what data actually exists, where it lives, and whether it is clean enough to build on — before a single prompt is written.
- **Acceptance criteria for probabilistic systems.** Classic pass/fail criteria break when outputs are non-deterministic. We define thresholds, human-in-the-loop checkpoints and fallback behaviour.
- **Scope discipline.** Cutting a six-month wishlist down to a six-week MVP that proves the value.

## What good looks like

One crisp problem statement. A baseline metric. A short list of acceptance criteria a non-technical stakeholder can read. A decision log that captures every trade-off and who signed off.

Get those four artifacts right and the build is the easy part.
""",
        },
        {
            "slug": "from-prd-to-prototype-shipping-an-ai-mvp-in-six-weeks",
            "title": "From PRD to prototype: shipping an AI MVP in six weeks",
            "excerpt": "A repeatable six-week cadence for taking an AI product idea from problem statement to a working prototype real users can try.",
            "cover_image": "https://images.unsplash.com/photo-1556761175-5973dc0f32e7",
            "author": "RK AI Labs Team",
            "tags": ["AI Product", "MVP", "Delivery"],
            "meta_description": "A defensible six-week cadence for building an AI MVP, from discovery to a usable prototype.",
            "status": "published",
            "read_time_min": 8,
            "body": """## Why six weeks

Long enough to build something real, short enough that nobody loses interest or over-engineers. The constraint forces honest scoping.

## The cadence we run

1. **Week 1 — Discovery & framing.** Problem statement, success metric, data audit, and a one-page solution sketch signed off by the sponsor.
2. **Week 2 — Spec & spike.** Functional requirements, a thin technical spike to de-risk the riskiest assumption (usually data or model behaviour).
3. **Weeks 3–4 — Build the happy path.** A working end-to-end flow over real data. Ugly UI is fine; the loop must be real.
4. **Week 5 — Harden & evaluate.** Add evaluation, guardrails, and human-in-the-loop where the model is weak. Measure against the Week 1 baseline.
5. **Week 6 — Pilot & decide.** Put it in front of 5–10 real users. Gather evidence. Make a go / iterate / stop call with data, not opinions.

## What kills it

- No baseline, so you can never prove the AI is better than what existed.
- Building the polished product before proving the loop works.
- Treating "the demo worked once" as evidence. It is not.

Keep the scope brutal, instrument everything, and let the pilot decide.
""",
        },
        {
            "slug": "the-fractional-ba-playbook",
            "title": "The fractional BA playbook: what good looks like at 20 hours a week",
            "excerpt": "A senior Business Analyst, fractional, is one of the highest-leverage additions a digital or AI team can make. Here is how to set the engagement up to actually ship.",
            "cover_image": "https://images.unsplash.com/photo-1542744173-8e7e53415bb0",
            "author": "RK AI Labs Team",
            "tags": ["Business Analysis", "Operations"],
            "meta_description": "How to structure a fractional Business Analyst engagement that ships.",
            "status": "published",
            "read_time_min": 5,
            "body": """## Why fractional

You almost never need a full-time senior BA for a single initiative. You need their judgment during discovery, vendor and tooling selection, the first few sprints, and around critical milestones.

## What good looks like

- **Two rituals per week:** backlog grooming + a steering review with the sponsor.
- **One artifact per sprint:** a decision memo capturing every architectural and product call and the trade-offs behind it.
- **One stakeholder map:** refreshed monthly — who blocks what, and who needs to be in the room.

## What kills it

Treating the fractional BA as a part-time project manager. They are not. They are a senior outside brain whose job is to challenge your assumptions, write them down, and make sure the team ships against them.
""",
        },
    ]
    for p in posts_seed:
        if not await db.posts.find_one({"slug": p["slug"]}):
            from routes_insights import Post  # local import to avoid cycle
            doc = Post(**p).model_dump()
            doc["published_at"] = now_iso()
            await db.posts.insert_one(doc)

    # CATEGORIES
    cats_seed = [
        {"name": "Business Analysis & Advisory", "slug": "business-analysis-advisory",
         "description": "Requirements, process mapping & BA-as-a-service for IT and product teams.", "order": 1},
        {"name": "AI Product Engineering", "slug": "ai-product-engineering",
         "description": "Design and build AI products, copilots & LLM-powered features end to end.", "order": 2},
        {"name": "Automation & Integration", "slug": "automation-integration",
         "description": "Workflow automation, system integration & intelligent process automation.", "order": 3},
        {"name": "Data, Analytics & AI Strategy", "slug": "data-ai-strategy",
         "description": "AI readiness, data foundations, dashboards & measurable ROI.", "order": 4},
    ]
    cat_map = {}
    for c in cats_seed:
        existing = await db.categories.find_one({"slug": c["slug"]}, {"_id": 0})
        if existing:
            cat_map[c["slug"]] = existing["id"]
            continue
        cat = Category(**c)
        await db.categories.insert_one(cat.model_dump())
        cat_map[c["slug"]] = cat.id

    # BANNERS
    banners_seed = [
        {"title": "Business analysis meets AI product building.",
         "subtitle": "From requirements to shipped AI products — led by senior analysts who build, not just advise.",
         "image_url": "https://images.pexels.com/photos/37320179/pexels-photo-37320179.jpeg",
         "cta_label": "Book a Consultation", "cta_link": "/contact", "order": 1},
        {"title": "From idea to AI MVP in weeks, not quarters.",
         "subtitle": "We scope it, spec it and build it — with measurable outcomes and a clear go/iterate decision.",
         "image_url": "https://images.unsplash.com/photo-1542744173-8e7e53415bb0",
         "cta_label": "See Services", "cta_link": "/services", "order": 2},
    ]
    for b in banners_seed:
        if not await db.banners.find_one({"title": b["title"]}):
            await db.banners.insert_one(Banner(**b).model_dump())

    # SERVICES
    services_seed = [
        {"name": "Business Analysis as a Service", "slug": "business-analysis-as-a-service",
         "category_id": cat_map["business-analysis-advisory"],
         "short_description": "An on-demand senior IT Business Analyst embedded with your product & engineering teams.",
         "long_description": "Get a senior Business Analyst part-time, without the full-time hire. We run discovery, write epics and user stories, manage vendors, facilitate ceremonies and translate strategy into a shippable backlog your team can build against.",
         "image_url": "https://images.unsplash.com/photo-1542744173-8e7e53415bb0",
         "price_label": "From ₹1,20,000/mo",
         "features": ["Epics & user stories", "Backlog ownership", "Discovery & workshops", "Vendor & tooling selection"],
         "deliverables": ["Weekly delivery cadence", "Decision memos", "Stakeholder map"],
         "duration": "Ongoing", "featured": True},
        {"name": "Requirements & Process Discovery", "slug": "requirements-process-discovery",
         "category_id": cat_map["business-analysis-advisory"],
         "short_description": "Turn a fuzzy idea or broken process into a clear, build-ready specification.",
         "long_description": "A structured discovery engagement that produces a defensible requirements package: as-is/to-be process maps, business and functional requirements, success metrics and acceptance criteria — everything engineering needs to estimate and build with confidence.",
         "image_url": "https://images.unsplash.com/photo-1521737604893-d14cc237f11d",
         "price_label": "From ₹1,50,000",
         "features": ["As-is / to-be process maps", "BRD & FRD", "Success metrics & KPIs", "Acceptance criteria"],
         "deliverables": ["Requirements document", "Process diagrams", "Prioritized backlog"],
         "duration": "3–5 weeks", "featured": False},
        {"name": "AI Product MVP Build", "slug": "ai-product-mvp-build",
         "category_id": cat_map["ai-product-engineering"],
         "short_description": "Go from problem statement to a working AI prototype real users can try — in six weeks.",
         "long_description": "Our flagship build engagement. We frame the problem, define a baseline, build an end-to-end AI product over your real data, add evaluation and guardrails, then pilot it with real users so you can make a go/iterate/stop decision backed by evidence.",
         "image_url": "https://images.unsplash.com/photo-1622675363311-3e1904dc1885",
         "price_label": "From ₹6,00,000",
         "features": ["Problem framing & baseline", "End-to-end build", "Evaluation & guardrails", "User pilot"],
         "deliverables": ["Working prototype", "Evaluation report", "Roadmap & decision memo"],
         "duration": "6–8 weeks", "featured": True},
        {"name": "LLM & GenAI Integration", "slug": "llm-genai-integration",
         "category_id": cat_map["ai-product-engineering"],
         "short_description": "Add LLM-powered features — copilots, search, summarisation, agents — to your existing product.",
         "long_description": "We design and integrate generative-AI features into your live product: retrieval-augmented chat, document understanding, copilots and task automation. We handle prompt design, retrieval, evaluation and safe rollout behind feature flags.",
         "image_url": "https://images.unsplash.com/photo-1620712943543-bcc4688e7485",
         "price_label": "Custom Quote",
         "features": ["RAG & retrieval", "Copilots & agents", "Evaluation harness", "Phased, flagged rollout"],
         "deliverables": ["Integrated feature", "Eval dashboard", "Runbook"],
         "duration": "6–12 weeks", "featured": True},
        {"name": "Intelligent Workflow Automation", "slug": "intelligent-workflow-automation",
         "category_id": cat_map["automation-integration"],
         "short_description": "Automate repetitive operational and back-office workflows with AI in the loop.",
         "long_description": "We map your manual workflows, identify the highest-ROI automation candidates and ship integrations that connect your systems — combining rules, APIs and AI where it genuinely helps. Built for reliability with clear human-in-the-loop checkpoints.",
         "image_url": "https://images.pexels.com/photos/1313534/pexels-photo-1313534.jpeg",
         "price_label": "From ₹2,00,000",
         "features": ["Workflow mapping", "System & API integration", "AI-assisted steps", "Human-in-the-loop checkpoints"],
         "deliverables": ["Automation blueprint", "Working integrations", "Monitoring & handover"],
         "duration": "4–8 weeks", "featured": False},
        {"name": "AI Readiness Assessment & Roadmap", "slug": "ai-readiness-assessment-roadmap",
         "category_id": cat_map["data-ai-strategy"],
         "short_description": "A focused audit of your data, processes and opportunities, with a prioritised AI roadmap.",
         "long_description": "Before you invest, know where AI will actually pay off. We assess your data foundations, processes and team readiness, then deliver a prioritised, ROI-ranked roadmap of AI and automation opportunities you can act on.",
         "image_url": "https://images.unsplash.com/photo-1542744173-8e7e53415bb0",
         "price_label": "From ₹75,000",
         "features": ["Data & process audit", "Opportunity mapping", "ROI prioritisation", "Exec readout"],
         "deliverables": ["Readiness report", "Prioritised roadmap", "Leadership presentation"],
         "duration": "2–3 weeks", "featured": False},
    ]
    for s in services_seed:
        if not await db.services.find_one({"slug": s["slug"]}):
            await db.services.insert_one(Service(**s).model_dump())

    # PAGES (about / privacy / terms)
    pages_seed = [
        {"slug": "about",
         "title": "About RK AI Labs",
         "meta_description": "RK AI Labs — IT Business Analysis solutions and AI product building, based in Delhi NCR, India.",
         "content": """> **[PLACEHOLDER — replace with your real story, founder bio and milestones.]**

## Who we are

RK AI Labs is an **IT Business Analysis and AI product studio** based in Delhi NCR, India. We help organisations turn ambiguous problems into clear specifications — and then build the AI-powered products and automations that solve them.

Most consultancies stop at advice. Most dev shops start coding before the problem is understood. We do both halves: senior business analysis *and* hands-on AI product engineering, under one roof.

## What we believe
1. **Clarity before code.** A sharp problem statement and honest acceptance criteria de-risk a build more than any framework.
2. **Build to learn.** Ship a small, real thing in front of real users, then decide with evidence — not opinions.
3. **AI accelerates, judgment decides.** AI multiplies a good team; it does not replace human accountability for the trade-offs.

## What we do
We pair senior Business Analysts with AI engineers to deliver requirements & process discovery, AI product MVP builds, LLM/GenAI integration, intelligent workflow automation, and AI readiness roadmaps.

> **[PLACEHOLDER — add founder name(s), background, team and any track record / case studies here.]**
"""},
        {"slug": "privacy",
         "title": "Privacy Policy",
         "meta_description": "How RK AI Labs handles your data.",
         "content": """**Effective date:** January 1, 2026

> **[PLACEHOLDER — have this reviewed by a qualified legal advisor before publishing.]**

RK AI Labs ("we", "us") respects your privacy. This policy explains what data we collect via iamrohankapoor.com (the "Site") and how we use it.

## 1. Information we collect
- **Contact data** you provide via forms: name, email, phone, company, message.
- **Usage data**: anonymous analytics (pages viewed, referrer, device class) collected via privacy-friendly analytics.
- **Chat data**: when you use our AI assistant Aria, the conversation is stored against an anonymous session ID for quality and continuity.

## 2. How we use it
- Respond to your inquiry and qualify it as a sales lead.
- Improve the Site, the assistant and our service offerings.
- Send occasional updates (only if you opt in).

## 3. Sharing
We do **not** sell your data. We share it only with:
- Our LLM provider, strictly to power the AI assistant.
- Email delivery providers, strictly to reply to you.
- Authorities if required by law.

## 4. Retention
Leads are kept for 36 months; chat transcripts for 12 months; you may request deletion at any time at privacy@iamrohankapoor.com.

## 5. Your rights
Subject to applicable law, you may request access, correction, deletion and portability of your data. Email privacy@iamrohankapoor.com.

## 6. Cookies
We use a minimal session cookie for authentication. No third-party advertising cookies.

## 7. Contact
RK AI Labs, Delhi NCR, India — privacy@iamrohankapoor.com
"""},
        {"slug": "terms",
         "title": "Terms & Conditions",
         "meta_description": "Terms of use for the RK AI Labs website.",
         "content": """**Last updated:** January 1, 2026

> **[PLACEHOLDER — have this reviewed by a qualified legal advisor before publishing.]**

By accessing iamrohankapoor.com (the "Site") you agree to these Terms.

## 1. Use of the Site
You may use the Site for lawful informational purposes only. You may not scrape, reverse-engineer or attempt to disrupt the Site or our AI assistant.

## 2. No professional advice
Content on this Site, including responses from our AI assistant Aria, is provided for general informational purposes and does not constitute professional consulting advice. Engagement letters and signed statements of work govern any actual consulting work.

## 3. Intellectual property
All trademarks, logos, copy, designs and code on the Site are owned by RK AI Labs or our licensors. You may not reproduce them without written permission.

## 4. AI assistant disclaimer
The AI assistant ("Aria") may generate inaccurate or out-of-date information. Do not rely on it for binding decisions. Pricing displayed by Aria is indicative; final pricing is confirmed in writing.

## 5. Accounts
You are responsible for safeguarding your account credentials. Notify us immediately at security@iamrohankapoor.com of any unauthorized use.

## 6. Limitation of liability
To the maximum extent permitted by law, RK AI Labs is not liable for indirect, incidental or consequential damages arising from your use of the Site.

## 7. Governing law
These Terms are governed by the laws of India. Disputes will be subject to the exclusive jurisdiction of the courts of Delhi, India.

## 8. Changes
We may update these Terms. The "Last updated" date at the top reflects the latest revision.

## 9. Contact
legal@iamrohankapoor.com
"""},
    ]
    for p in pages_seed:
        if not await db.pages.find_one({"slug": p["slug"]}):
            await db.pages.insert_one(Page(**p).model_dump())


async def run_all():
    # Roles first: seed_admin attaches the admin role to the seeded user.
    from routes_rbac import seed_roles
    from routes_layouts import seed_layouts

    await seed_roles()
    await seed_admin()
    await seed_content()
    await seed_layouts()
