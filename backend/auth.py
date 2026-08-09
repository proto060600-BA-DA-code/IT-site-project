import os
import bcrypt
import jwt
from datetime import datetime, timezone, timedelta
from fastapi import HTTPException, Header, Depends, Request
from typing import Optional

from db import db

JWT_SECRET = os.environ['JWT_SECRET']
JWT_ALGO = os.environ.get('JWT_ALGO', 'HS256')
JWT_EXPIRE_HOURS = int(os.environ.get('JWT_EXPIRE_HOURS', '72'))


def hash_password(password: str) -> str:
    return bcrypt.hashpw(password.encode('utf-8'), bcrypt.gensalt()).decode('utf-8')


def verify_password(password: str, password_hash: str) -> bool:
    try:
        return bcrypt.checkpw(password.encode('utf-8'), password_hash.encode('utf-8'))
    except Exception:
        return False


def create_token(user_id: str, role: str) -> str:
    exp = datetime.now(timezone.utc) + timedelta(hours=JWT_EXPIRE_HOURS)
    payload = {"sub": user_id, "role": role, "exp": exp}
    return jwt.encode(payload, JWT_SECRET, algorithm=JWT_ALGO)


def decode_token(token: str) -> dict:
    try:
        return jwt.decode(token, JWT_SECRET, algorithms=[JWT_ALGO])
    except jwt.ExpiredSignatureError:
        raise HTTPException(status_code=401, detail="Token expired")
    except jwt.InvalidTokenError:
        raise HTTPException(status_code=401, detail="Invalid token")


async def get_current_user(authorization: Optional[str] = Header(None)) -> dict:
    if not authorization or not authorization.startswith("Bearer "):
        raise HTTPException(status_code=401, detail="Missing or invalid Authorization header")
    token = authorization.split(" ", 1)[1].strip()
    payload = decode_token(token)
    user = await db.users.find_one({"id": payload["sub"]}, {"_id": 0, "password_hash": 0})
    if not user:
        raise HTTPException(status_code=401, detail="User not found")
    return user


async def require_admin(user: dict = Depends(get_current_user)) -> dict:
    """Gate for the admin area as a whole. A user gets in if they hold the
    legacy admin role OR any RBAC role that grants at least one permission."""
    if user.get("role") == "admin":
        return user
    perms = await permissions_for(user)
    if any(a for res in perms.values() for a in res.values()):
        return user
    raise HTTPException(status_code=403, detail="Admin access required")


async def permissions_for(user: dict) -> dict:
    """Resolve a user's effective permission matrix.

    Legacy `role == "admin"` users get everything, so existing logins keep
    working before any Role rows exist. Otherwise the matrix comes from the
    Role referenced by `role_id`.
    """
    from models import full_permissions, no_permissions  # local: avoid cycle

    if user.get("role") == "admin" and not user.get("role_id"):
        return full_permissions()

    role_id = user.get("role_id")
    if not role_id:
        return no_permissions()

    role = await db.roles.find_one({"id": role_id}, {"_id": 0})
    if not role:
        return no_permissions()

    # The admin system role is always all-powerful, whatever is stored,
    # so a bad edit can never lock everyone out.
    if role.get("slug") == "admin":
        return full_permissions()

    base = no_permissions()
    for resource, actions in (role.get("permissions") or {}).items():
        if resource in base and isinstance(actions, dict):
            for action, allowed in actions.items():
                if action in base[resource]:
                    base[resource][action] = bool(allowed)
    return base


# Path segments that don't map 1:1 onto a resource name.
_PATH_RESOURCE_ALIASES = {
    "stats": "reports",
    "export": "reports",
    "insights": "posts",
}

_METHOD_ACTIONS = {
    "GET": "read",
    "HEAD": "read",
    "OPTIONS": "read",
    "POST": "create",
    "PUT": "update",
    "PATCH": "update",
    "DELETE": "delete",
}


async def enforce_admin_rbac(request: Request, user: dict = Depends(get_current_user)) -> dict:
    """Blanket guard for the whole /admin router.

    Infers the resource from the first path segment after /admin/ and the
    action from the HTTP method, so new admin routes are covered automatically
    rather than needing their own dependency.
    """
    from models import RESOURCES

    if not user.get("active", True):
        raise HTTPException(status_code=403, detail="Account is deactivated")

    perms = await permissions_for(user)

    parts = [p for p in request.url.path.split("/") if p]
    try:
        resource = parts[parts.index("admin") + 1]
    except (ValueError, IndexError):
        resource = ""
    resource = _PATH_RESOURCE_ALIASES.get(resource, resource)

    action = _METHOD_ACTIONS.get(request.method.upper(), "read")

    # Unknown segment: fall back to requiring *some* admin capability rather
    # than silently allowing it through.
    if resource not in RESOURCES:
        if any(a for res in perms.values() for a in res.values()):
            return user
        raise HTTPException(status_code=403, detail="Admin access required")

    if not perms.get(resource, {}).get(action):
        raise HTTPException(
            status_code=403,
            detail=f"You do not have permission to {action} {resource}",
        )
    return user


def require_permission(resource: str, action: str):
    """Route dependency: `Depends(require_permission("services", "update"))`."""

    async def _check(user: dict = Depends(get_current_user)) -> dict:
        if not user.get("active", True):
            raise HTTPException(status_code=403, detail="Account is deactivated")
        perms = await permissions_for(user)
        if not perms.get(resource, {}).get(action):
            raise HTTPException(
                status_code=403,
                detail=f"You do not have permission to {action} {resource}",
            )
        return user

    return _check
