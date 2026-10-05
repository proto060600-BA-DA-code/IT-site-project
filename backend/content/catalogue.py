"""Service catalogue — the single source for categories, services and prices.

Prices researched October 2026 against Indian (Delhi NCR) market rates for
domestic clients. Rate anchor: ₹2,000–2,500/hour, ₹15,000/day — the low end
of the "intermediate consultant" band (₹2,500–5,000/hr), justified by
enterprise SFCC/OMS delivery experience. Every service maps to something on
Rohan's CV; nothing here promises work he can't evidence.

All engagements are fixed-scope or capped-hours: delivery fits around a
full-time role (async-first, evenings/weekends), so open-ended daytime
availability is deliberately not sold.

Market benchmarks used (2026):
  BA / consultant, intermediate (2–5 yrs) ..... ₹2,500–5,000 / hour
  Freelance consulting / QA day rate .......... median ≈ ₹11,400 / day
  GA4 + GTM audit & setup project ............. ₹12,500–37,500 (avg ≈ ₹20,000)
  Technical SEO audit (freelancer) ............ ₹10,000–50,000
  Small custom e-commerce build ............... ₹80,000–3,00,000
  Basic AI chatbot (small business) ........... ₹50,000–1,50,000
  Website care retainer (standard) ............ ₹8,000–20,000 / month
"""

PRICING_NOTE = (
    "Prices are starting points for a typical scope and exclude GST where applicable. "
    "You get a fixed written quote after a free 30-minute call."
)

CATEGORIES = [
    {"slug": "business-analysis", "order": 1,
     "name": "Business Analysis & Product Ownership",
     "description": "Requirements, process mapping, backlog ownership and UAT — specs your team can build from."},
    {"slug": "ecommerce", "order": 2,
     "name": "E-commerce & Order Management",
     "description": "Store builds with live payments, and order-management process design from enterprise SFCC programmes."},
    {"slug": "analytics-seo", "order": 3,
     "name": "Analytics, Tracking & SEO",
     "description": "GA4 and Tag Manager tracking you can trust, and technical SEO audits with a prioritised fix plan."},
    {"slug": "ai-builds", "order": 4,
     "name": "AI Assistants",
     "description": "Practical AI features for your website — built, tested and handed over properly."},
]

_IMG_WORKSHOP = "https://images.unsplash.com/photo-1521737604893-d14cc237f11d"
_IMG_DESK = "https://images.unsplash.com/photo-1542744173-8e7e53415bb0"
_IMG_COMMERCE = "https://images.unsplash.com/photo-1556742049-0cfed4f6a45d"
_IMG_ANALYTICS = "https://images.unsplash.com/photo-1551288049-bebda4e38f71"
_IMG_AI = "https://images.unsplash.com/photo-1620712943543-bcc4688e7485"

SERVICES = [
    # ── Business analysis & product ownership ───────────────────────────────
    {"slug": "requirements-process-discovery", "category": "business-analysis", "featured": True,
     "name": "Requirements & Process Discovery",
     "short_description": "Turn an idea or a messy process into a build-ready specification your developers or agency can quote against.",
     "long_description": "A fixed-scope discovery that produces the documents a build actually needs: as-is and to-be process maps, a BRD and FRD, user stories with acceptance criteria, and a role-permission matrix. It's the same requirements discipline I applied on enterprise Salesforce Commerce Cloud programmes — sized for your project. " + PRICING_NOTE,
     "price_label": "From ₹45,000",
     "duration": "2–3 weeks",
     "features": ["Stakeholder interviews", "As-is / to-be process maps", "BRD & FRD", "User stories with acceptance criteria", "Role-permission (CRUD) matrix"],
     "deliverables": ["Requirements pack (BRD/FRD)", "Process diagrams", "Prioritised backlog", "Walkthrough session"],
     "image_url": _IMG_WORKSHOP},

    {"slug": "fractional-ba-product-owner", "category": "business-analysis", "featured": True,
     "name": "Fractional BA / Product Owner",
     "short_description": "Part-time product ownership for a build in progress — backlog, specs, agency management and sign-off.",
     "long_description": "A monthly block of BA and product-owner time without a full-time hire: I own the backlog, write and refine stories, keep your agency or developers to their commitments, and run UAT before each release. Work is async-first with a weekly review call. Additional hours are billed at ₹2,200/hour. " + PRICING_NOTE,
     "price_label": "₹40,000 / month (20 hours)",
     "duration": "Monthly, 2-month minimum",
     "features": ["Backlog ownership", "Story writing & refinement", "Agency / vendor management", "Weekly review call", "Release sign-off"],
     "deliverables": ["Groomed backlog", "Weekly status note", "UAT sign-off per release"],
     "image_url": _IMG_DESK},

    {"slug": "uat-release-readiness", "category": "business-analysis", "featured": False,
     "name": "UAT & Release Readiness",
     "short_description": "Structured user-acceptance testing before you go live, so defects are caught by you, not your customers.",
     "long_description": "I write the test plan and cases from your requirements, run structured UAT rounds, trace data through your systems, triage defects with your developers and prepare a go-live checklist with a rollback plan. On enterprise releases this approach delivered zero critical post-release defects. " + PRICING_NOTE,
     "price_label": "From ₹30,000 per release",
     "duration": "1–2 weeks",
     "features": ["Test plan & cases", "Structured UAT rounds", "Defect triage", "Go-live & rollback checklist"],
     "deliverables": ["Test case suite", "Defect log", "Release-readiness report"],
     "image_url": _IMG_WORKSHOP},

    # ── E-commerce & order management ──────────────────────────────────────
    {"slug": "ecommerce-store-build", "category": "ecommerce", "featured": True,
     "name": "E-commerce Store Build & Launch",
     "short_description": "A custom online store with live Razorpay payments and an admin your team can run without a developer.",
     "long_description": "Requirements to launch: storefront, product catalogue, cart and checkout, Razorpay payments with signature-verified webhooks and order reconciliation, and a role-based admin for catalogue, orders and content. Includes domain cutover with a rollback plan, a mobile performance pass and handover documentation. If an off-the-shelf platform like Shopify fits your needs better, I'll tell you before you spend on a custom build. " + PRICING_NOTE,
     "price_label": "From ₹1,50,000",
     "duration": "6–8 weeks",
     "features": ["Storefront & catalogue", "Razorpay live payments", "Role-based admin CMS", "Mobile performance pass", "Domain cutover & rollback plan"],
     "deliverables": ["Live store", "Admin access & training", "Architecture & handover docs"],
     "image_url": _IMG_COMMERCE},

    {"slug": "order-management-consulting", "category": "ecommerce", "featured": False,
     "name": "Order Management & SFCC Process Consulting",
     "short_description": "Process design and specification for order management flows — B2B, Back-to-Back, stock & sell and exceptions.",
     "long_description": "For brands and delivery teams working on Salesforce Commerce Cloud or a custom OMS: I map order and inventory flows, design exception handling, write the functional specs and review integration test results against the order record. Booked by the day for focused problems. " + PRICING_NOTE,
     "price_label": "₹15,000 / day (2-day minimum)",
     "duration": "By the day",
     "features": ["Order & inventory flow mapping", "Exception-handling design", "Functional specifications", "Integration test review"],
     "deliverables": ["Flow diagrams", "Functional spec", "Recommendations memo"],
     "image_url": _IMG_DESK},

    {"slug": "store-care-retainer", "category": "ecommerce", "featured": False,
     "name": "Store Care Retainer",
     "short_description": "Monitoring, small fixes and content changes for a live store, so it stays healthy after launch.",
     "long_description": "Up to 4 hours a month of fixes and small changes, uptime and error monitoring, dependency updates and a monthly health note covering speed, errors and search-console issues. Unused hours don't roll over; larger changes are quoted separately. " + PRICING_NOTE,
     "price_label": "₹8,000 / month",
     "duration": "Monthly",
     "features": ["Up to 4 hours of changes", "Uptime & error monitoring", "Dependency updates", "Monthly health note"],
     "deliverables": ["Monthly health report", "Change log"],
     "image_url": _IMG_COMMERCE},

    # ── Analytics, tracking & SEO ──────────────────────────────────────────
    {"slug": "ga4-gtm-tracking-setup", "category": "analytics-seo", "featured": False,
     "name": "GA4 & Tag Manager Tracking Setup",
     "short_description": "E-commerce tracking you can trust — events, conversions and funnels that show where customers drop off.",
     "long_description": "An audit of your current tracking, then a clean GA4 and Google Tag Manager setup: e-commerce events from product view to purchase, data-layer validation, conversion tracking and a checkout funnel report. Built on GAIQ-certified practice across multiple client environments. " + PRICING_NOTE,
     "price_label": "From ₹20,000",
     "duration": "1–2 weeks",
     "features": ["Tracking audit", "GA4 e-commerce events", "GTM & data-layer validation", "Checkout funnel report"],
     "deliverables": ["Working tracking setup", "Tracking plan document", "Funnel report"],
     "image_url": _IMG_ANALYTICS},

    {"slug": "technical-seo-audit", "category": "analytics-seo", "featured": False,
     "name": "Technical SEO Audit & Fix Plan",
     "short_description": "Find out why your pages aren't ranking or indexing — with a prioritised, developer-ready fix list.",
     "long_description": "A technical audit using Search Console and crawl data: indexing and sitemap issues, titles and meta, structured data, Core Web Vitals from real-user data, and redirects. You get a prioritised fix plan written so a developer can act on it. Implementation can be quoted separately. " + PRICING_NOTE,
     "price_label": "From ₹18,000",
     "duration": "1 week",
     "features": ["Search Console review", "Indexing & sitemap checks", "Core Web Vitals (real-user data)", "Schema & meta review"],
     "deliverables": ["Audit report", "Prioritised fix plan", "Walkthrough call"],
     "image_url": _IMG_ANALYTICS},

    # ── AI assistants ──────────────────────────────────────────────────────
    {"slug": "ai-support-assistant", "category": "ai-builds", "featured": True,
     "name": "AI Support Assistant for Your Website",
     "short_description": "A chat assistant that answers product, order and FAQ questions from your own content — and hands off to a human.",
     "long_description": "A tested, embeddable assistant trained on your FAQs and product information, with guardrails so it doesn't invent prices or promises, a hand-off to your contact form, and conversation history for review. Running costs are your AI provider's usage — typically ₹500–3,500 a month for a small site. " + PRICING_NOTE,
     "price_label": "From ₹60,000",
     "duration": "3–4 weeks",
     "features": ["Answers from your own content", "Guardrails & human hand-off", "Conversation history", "Tested before launch"],
     "deliverables": ["Embedded assistant", "Admin review view", "Handover guide"],
     "image_url": _IMG_AI},
]

# Slugs from the original placeholder catalogue, retired by the v2 migration.
LEGACY_SERVICE_SLUGS = [
    "business-analysis-as-a-service", "ai-product-mvp-build", "llm-genai-integration",
    "intelligent-workflow-automation", "ai-readiness-assessment-roadmap",
]
LEGACY_CATEGORY_SLUGS = [
    "business-analysis-advisory", "ai-product-engineering", "automation-integration", "data-ai-strategy",
]
