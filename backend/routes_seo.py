import os
from fastapi import APIRouter
from fastapi.responses import PlainTextResponse, Response
from db import db

router = APIRouter(prefix="/api", tags=["seo"])

SITE_URL = os.environ.get("SITE_URL", "https://example.com").rstrip("/")


@router.get("/robots.txt", response_class=PlainTextResponse)
async def robots():
    return f"""User-agent: *
Allow: /
Disallow: /admin
Disallow: /api

Sitemap: {SITE_URL}/api/sitemap.xml
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
