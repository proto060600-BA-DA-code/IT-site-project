from fastapi import FastAPI, APIRouter
from dotenv import load_dotenv
from starlette.middleware.cors import CORSMiddleware
import os
import logging
from pathlib import Path

ROOT_DIR = Path(__file__).parent
load_dotenv(ROOT_DIR / '.env')

from db import client  # noqa: E402
import routes_auth  # noqa: E402
import routes_catalog  # noqa: E402
import routes_admin  # noqa: E402
import routes_chat  # noqa: E402
import routes_seo  # noqa: E402
import routes_cloudinary  # noqa: E402
import routes_insights  # noqa: E402
import seed  # noqa: E402

app = FastAPI(title="RK AI Labs API")

# /api prefixed router
api_router = APIRouter(prefix="/api")


@api_router.get("/")
async def root():
    return {"service": "RK AI Labs API", "status": "ok"}


@api_router.get("/health")
async def health():
    return {"ok": True}


api_router.include_router(routes_auth.router)
api_router.include_router(routes_catalog.router)
api_router.include_router(routes_admin.router)
api_router.include_router(routes_chat.router)
api_router.include_router(routes_cloudinary.router)
api_router.include_router(routes_insights.public)
api_router.include_router(routes_insights.admin)

app.include_router(api_router)
app.include_router(routes_seo.router)

app.add_middleware(
    CORSMiddleware,
    allow_credentials=True,
    allow_origins=os.environ.get('CORS_ORIGINS', '*').split(','),
    allow_methods=["*"],
    allow_headers=["*"],
)

logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s',
)
logger = logging.getLogger(__name__)


@app.on_event("startup")
async def on_startup():
    try:
        await seed.run_all()
        logger.info("Seed completed.")
    except Exception as e:
        logger.exception("Seed failed: %s", e)


@app.on_event("shutdown")
async def shutdown_db_client():
    client.close()
