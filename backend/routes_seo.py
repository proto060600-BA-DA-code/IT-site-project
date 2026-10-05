import os
import html
from fastapi import APIRouter
from fastapi.responses import PlainTextResponse, Response
from db import db

router = APIRouter(prefix="/api", tags=["seo"])

SITE_URL = os.environ.get("SITE_URL", "https://example.com").rstrip("/")

# Google truncates descriptions around 155-160 chars; keep ours inside that so
# the snippet it shows is the one we wrote.
DESC_LIMIT = 155


def _clip(text: str, limit: int = DESC_LIMIT) -> str:
    text = " ".join((text or "").split())
    if len(text) <= limit:
        return text
    cut = text[:limit].rsplit(" ", 1)[0]
    return cut + "…"


@router.get("/seo/routes")
async def seo_routes():
    """Per-route head metadata for every public page.

    Consumed at build time by frontend/scripts/prerender-meta.js, which writes
    a static HTML file per route with this data in <head>. Crawlers and link
    previews then see real titles, descriptions and JSON-LD without needing to
    execute JavaScript.

    Only <head> is affected. React never hydrates <head> in this app, so there
    is no risk of the hydration mismatches that a full prerender would bring.
    """
    from routes_settings import get_settings

    s = await get_settings()
    brand = s.get("brand_name") or "Synferrous"
    tagline = s.get("tagline") or ""
    default_desc = _clip(s.get("footer_description") or tagline)

    org = {
        "@type": "ProfessionalService",
        "@id": f"{SITE_URL}/#org",
        "name": brand,
        "url": f"{SITE_URL}/",
        "description": default_desc,
        "email": s.get("email") or None,
        "telephone": s.get("phone") or None,
        "address": {"@type": "PostalAddress", "addressLocality": s.get("address") or None,
                    "addressCountry": "IN"},
        "sameAs": [u for u in (s.get("linkedin"), s.get("x")) if u],
    }

    def crumbs(*pairs):
        return {
            "@type": "BreadcrumbList",
            "itemListElement": [
                {"@type": "ListItem", "position": i + 1, "name": n, "item": f"{SITE_URL}{p}"}
                for i, (n, p) in enumerate(pairs)
            ],
        }

    def route(path, title, desc, image="", jsonld=None):
        full_title = title if title == brand else f"{title} · {brand}"
        return {
            "path": path,
            "title": full_title,
            "description": _clip(desc) or default_desc,
            "canonical": f"{SITE_URL}{path if path != '/' else '/'}",
            "image": image or "",
            "jsonld": {"@context": "https://schema.org", "@graph": [org] + (jsonld or [])},
        }

    routes = [
        route("/", f"{brand} — {tagline}" if tagline else brand, default_desc),
        route("/services", "Services", f"Business analysis and AI product services from {brand}.",
              jsonld=[crumbs(("Home", "/"), ("Services", "/services"))]),
        route("/contact", "Contact", f"Start a conversation with {brand}. Rohan replies personally within one business day.",
              jsonld=[crumbs(("Home", "/"), ("Contact", "/contact"))]),
    ]

    # CMS pages (about, privacy, terms, …)
    for p in await db.pages.find({}, {"_id": 0}).to_list(200):
        routes.append(route(
            f"/{p['slug']}", p.get("title") or p["slug"].title(),
            p.get("meta_description") or (p.get("content") or "")[:300],
            jsonld=[crumbs(("Home", "/"), (p.get("title") or p["slug"], f"/{p['slug']}"))],
        ))

    for c in await db.categories.find({"active": True}, {"_id": 0}).to_list(500):
        routes.append(route(
            f"/categories/{c['slug']}", c["name"], c.get("description") or "",
            jsonld=[crumbs(("Home", "/"), ("Services", "/services"), (c["name"], f"/categories/{c['slug']}"))],
        ))

    for sv in await db.services.find({"active": True}, {"_id": 0}).to_list(500):
        path = f"/services/{sv['slug']}"
        service_ld = {
            "@type": "Service",
            "name": sv["name"],
            "description": _clip(sv.get("short_description") or sv.get("long_description") or "", 300),
            "provider": {"@id": f"{SITE_URL}/#org"},
            "url": f"{SITE_URL}{path}",
            "areaServed": "IN",
        }
        if sv.get("image_url"):
            service_ld["image"] = sv["image_url"]
        routes.append(route(
            path, sv["name"], sv.get("short_description") or sv.get("long_description") or "",
            image=sv.get("image_url") or "",
            jsonld=[service_ld, crumbs(("Home", "/"), ("Services", "/services"), (sv["name"], path))],
        ))

    posts = await db.posts.find({"status": "published"}, {"_id": 0}).to_list(500)
    if posts:
        routes.append(route("/insights", "Insights", f"Writing on business analysis and applied AI from {brand}.",
                            jsonld=[crumbs(("Home", "/"), ("Insights", "/insights"))]))
    for po in posts:
        path = f"/insights/{po['slug']}"
        article = {
            "@type": "Article",
            "headline": po["title"][:110],
            "description": _clip(po.get("excerpt") or ""),
            "datePublished": po.get("published_at"),
            "dateModified": po.get("updated_at") or po.get("published_at"),
            "publisher": {"@id": f"{SITE_URL}/#org"},
            "mainEntityOfPage": f"{SITE_URL}{path}",
        }
        if po.get("cover_image"):
            article["image"] = po["cover_image"]
        routes.append(route(
            path, po["title"], po.get("excerpt") or "", image=po.get("cover_image") or "",
            jsonld=[article, crumbs(("Home", "/"), ("Insights", "/insights"), (po["title"], path))],
        ))

    # Strip None values from JSON-LD so validators don't flag empty properties.
    def prune(x):
        if isinstance(x, dict):
            return {k: prune(v) for k, v in x.items() if v not in (None, "", [], {})}
        if isinstance(x, list):
            return [prune(v) for v in x]
        return x

    for r in routes:
        r["jsonld"] = prune(r["jsonld"])
        # Escape for safe attribute insertion; the script re-checks too.
        r["title"] = html.unescape(r["title"])

    return {"site_url": SITE_URL, "brand": brand, "routes": routes}


@router.get("/robots.txt", response_class=PlainTextResponse)
async def robots():
    return f"""User-agent: *
Allow: /
Disallow: /admin
Disallow: /api

Sitemap: {SITE_URL}/sitemap.xml
"""


@router.get("/sitemap.xml")
async def sitemap():
    urls = [
        ("/", "1.0", "weekly"),
        ("/services", "0.9", "weekly"),
        ("/about", "0.7", "monthly"),
        ("/contact", "0.8", "monthly"),
        ("/privacy", "0.4", "yearly"),
        ("/terms", "0.4", "yearly"),
    ]
    services = await db.services.find({"active": True}, {"_id": 0, "slug": 1}).to_list(500)
    for s in services:
        urls.append((f"/services/{s['slug']}", "0.8", "weekly"))

    cats = await db.categories.find({"active": True}, {"_id": 0, "slug": 1}).to_list(500)
    for c in cats:
        urls.append((f"/categories/{c['slug']}", "0.6", "monthly"))

    posts = await db.posts.find({"status": "published"}, {"_id": 0, "slug": 1}).to_list(500)
    for p in posts:
        urls.append((f"/insights/{p['slug']}", "0.7", "weekly"))
    if posts:
        urls.append(("/insights", "0.8", "weekly"))

    body = ['<?xml version="1.0" encoding="UTF-8"?>',
            '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">']
    for path, prio, freq in urls:
        body.append(
            f"<url><loc>{SITE_URL}{path}</loc>"
            f"<changefreq>{freq}</changefreq><priority>{prio}</priority></url>"
        )
    body.append("</urlset>")
    return Response(content="\n".join(body), media_type="application/xml")
