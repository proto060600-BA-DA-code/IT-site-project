"""Roles and users administration.

Mounted under the /admin router's blanket RBAC guard, so reaching any of these
already means the caller holds the matching roles/users permission.
"""
from fastapi import APIRouter, HTTPException, Depends
from typing import List
import re

from db import db
from models import (
    RESOURCES, ACTIONS, Role, RoleIn, User, UserPublic,
    UserCreateIn, UserUpdateIn, PasswordResetIn,
    full_permissions, no_permissions, read_only_permissions, now_iso,
)
from auth import hash_password, get_current_user, permissions_for

router = APIRouter(tags=["rbac"])


def slugify(s: str) -> str:
    return re.sub(r"[^a-z0-9]+", "-", s.lower()).strip("-") or "role"


# ─── Schema (drives the permission-matrix UI) ────────────────────────────────
@router.get("/permissions/schema")
async def permission_schema():
    return {"resources": RESOURCES, "actions": ACTIONS}


# ─── Roles ───────────────────────────────────────────────────────────────────
@router.get("/roles", response_model=List[Role])
async def list_roles():
    docs = await db.roles.find({}, {"_id": 0}).sort("created_at", 1).to_list(200)
    return [Role(**d) for d in docs]


@router.post("/roles", response_model=Role)
async def create_role(payload: RoleIn):
    slug = slugify(payload.slug or payload.name)
    if await db.roles.find_one({"slug": slug}):
        raise HTTPException(status_code=409, detail="A role with that slug already exists")
    role = Role(
        name=payload.name,
        slug=slug,
        description=payload.description or "",
        permissions=payload.permissions or no_permissions(),
    )
    await db.roles.insert_one(role.model_dump())
    return role


@router.put("/roles/{role_id}", response_model=Role)
async def update_role(role_id: str, payload: RoleIn):
    existing = await db.roles.find_one({"id": role_id}, {"_id": 0})
    if not existing:
        raise HTTPException(status_code=404, detail="Role not found")

    update = {"updated_at": now_iso()}
    if payload.name:
        update["name"] = payload.name
    if payload.description is not None:
        update["description"] = payload.description
    if payload.permissions is not None:
        # The built-in admin role always keeps every permission. Without this
        # a mis-click on the matrix could lock every operator out of the site.
        update["permissions"] = (
            full_permissions() if existing.get("slug") == "admin" else payload.permissions
        )

    res = await db.roles.find_one_and_update(
        {"id": role_id}, {"$set": update}, return_document=True, projection={"_id": 0}
    )
    return Role(**res)


@router.delete("/roles/{role_id}")
async def delete_role(role_id: str):
    role = await db.roles.find_one({"id": role_id}, {"_id": 0})
    if not role:
        raise HTTPException(status_code=404, detail="Role not found")
    if role.get("system"):
        raise HTTPException(status_code=400, detail="Built-in roles cannot be deleted")
    in_use = await db.users.count_documents({"role_id": role_id})
    if in_use:
        raise HTTPException(
            status_code=400,
            detail=f"{in_use} user(s) still hold this role — reassign them first",
        )
    await db.roles.delete_one({"id": role_id})
    return {"ok": True}


# ─── Users ───────────────────────────────────────────────────────────────────
async def _expand(user_doc: dict) -> UserPublic:
    role_name = None
    if user_doc.get("role_id"):
        r = await db.roles.find_one({"id": user_doc["role_id"]}, {"_id": 0, "name": 1})
        role_name = r["name"] if r else None
    elif user_doc.get("role") == "admin":
        role_name = "Administrator (legacy)"
    return UserPublic(**{**user_doc, "role_name": role_name})


@router.get("/users", response_model=List[UserPublic])
async def list_users():
    docs = await db.users.find({}, {"_id": 0, "password_hash": 0}).sort("created_at", 1).to_list(500)
    return [await _expand(d) for d in docs]


@router.post("/users", response_model=UserPublic)
async def create_user(payload: UserCreateIn):
    if await db.users.find_one({"email": payload.email.lower()}):
        raise HTTPException(status_code=409, detail="Email already registered")
    if len(payload.password) < 8:
        raise HTTPException(status_code=400, detail="Password must be at least 8 characters")

    legacy_role = "user"
    if payload.role_id:
        role = await db.roles.find_one({"id": payload.role_id}, {"_id": 0})
        if not role:
            raise HTTPException(status_code=400, detail="Unknown role")
        # Keep the legacy string in sync so existing checks still behave.
        if role.get("slug") == "admin":
            legacy_role = "admin"

    user = User(
        email=payload.email.lower(),
        name=payload.name,
        password_hash=hash_password(payload.password),
        role=legacy_role,
        role_id=payload.role_id,
        active=payload.active,
    )
    await db.users.insert_one(user.model_dump())
    return await _expand(user.model_dump())


@router.put("/users/{user_id}", response_model=UserPublic)
async def update_user(user_id: str, payload: UserUpdateIn, me: dict = Depends(get_current_user)):
    existing = await db.users.find_one({"id": user_id}, {"_id": 0})
    if not existing:
        raise HTTPException(status_code=404, detail="User not found")

    update = {"updated_at": now_iso()}
    if payload.name is not None:
        update["name"] = payload.name
    if payload.email is not None:
        clash = await db.users.find_one({"email": payload.email.lower(), "id": {"$ne": user_id}})
        if clash:
            raise HTTPException(status_code=409, detail="Another user already has that email")
        update["email"] = payload.email.lower()
    if payload.active is not None:
        if not payload.active and user_id == me["id"]:
            raise HTTPException(status_code=400, detail="You cannot deactivate your own account")
        update["active"] = payload.active
    if payload.role_id is not None:
        role = await db.roles.find_one({"id": payload.role_id}, {"_id": 0})
        if not role:
            raise HTTPException(status_code=400, detail="Unknown role")
        update["role_id"] = payload.role_id
        update["role"] = "admin" if role.get("slug") == "admin" else "user"

    await _guard_last_admin(user_id, update)

    res = await db.users.find_one_and_update(
        {"id": user_id}, {"$set": update},
        return_document=True, projection={"_id": 0, "password_hash": 0},
    )
    return await _expand(res)


async def _guard_last_admin(user_id: str, update: dict):
    """Refuse any change that would leave the site with no active admin."""
    losing_admin = update.get("role") == "user" or update.get("active") is False
    if not losing_admin:
        return

    admin_role = await db.roles.find_one({"slug": "admin"}, {"_id": 0, "id": 1})
    admin_ids = [admin_role["id"]] if admin_role else []
    query = {
        "active": {"$ne": False},
        "id": {"$ne": user_id},
        "$or": [{"role": "admin"}, {"role_id": {"$in": admin_ids}}],
    }
    if await db.users.count_documents(query) == 0:
        raise HTTPException(
            status_code=400,
            detail="This is the last active administrator — promote someone else first",
        )


@router.post("/users/{user_id}/password")
async def reset_password(user_id: str, payload: PasswordResetIn):
    if len(payload.password) < 8:
        raise HTTPException(status_code=400, detail="Password must be at least 8 characters")
    res = await db.users.update_one(
        {"id": user_id},
        {"$set": {"password_hash": hash_password(payload.password), "updated_at": now_iso()}},
    )
    if res.matched_count == 0:
        raise HTTPException(status_code=404, detail="User not found")
    return {"ok": True}


@router.delete("/users/{user_id}")
async def delete_user(user_id: str, me: dict = Depends(get_current_user)):
    if user_id == me["id"]:
        raise HTTPException(status_code=400, detail="You cannot delete your own account")
    await _guard_last_admin(user_id, {"active": False})
    r = await db.users.delete_one({"id": user_id})
    if r.deleted_count == 0:
        raise HTTPException(status_code=404, detail="User not found")
    return {"ok": True}


# ─── Seeding ─────────────────────────────────────────────────────────────────
DEFAULT_ROLES = [
    ("Administrator", "admin", "Full access, including users and roles.", full_permissions),
    ("Editor", "editor", "Manages all content. No access to users or roles.", None),
    ("Viewer", "viewer", "Read-only across the admin.", read_only_permissions),
]


async def attach_legacy_admins():
    """Give every role="admin" user with no role_id the Administrator role.

    Must run AFTER seed_admin: on a fresh database the admin user doesn't
    exist until then, so running it inside seed_roles attached nobody.
    """
    admin_role = await db.roles.find_one({"slug": "admin"}, {"_id": 0, "id": 1})
    if admin_role:
        await db.users.update_many(
            {"role": "admin", "role_id": None},
            {"$set": {"role_id": admin_role["id"]}},
        )


async def seed_roles():
    """Create the three built-in roles. Safe to run on every boot."""
    for name, slug, description, perm_fn in DEFAULT_ROLES:
        if await db.roles.find_one({"slug": slug}):
            continue
        if perm_fn:
            perms = perm_fn()
        else:  # Editor — everything except users and roles
            perms = full_permissions()
            for locked in ("users", "roles", "audit"):
                perms[locked] = {a: False for a in ACTIONS}
            perms["users"]["read"] = True
        await db.roles.insert_one(
            Role(name=name, slug=slug, description=description,
                 permissions=perms, system=True).model_dump()
        )
