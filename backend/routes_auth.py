from fastapi import APIRouter, HTTPException, Depends
from db import db
from models import LoginIn, AuthOut, User, UserPublic, now_iso
from auth import hash_password, verify_password, create_token, get_current_user
from ratelimit import limit_by_ip, hit

router = APIRouter(prefix="/auth", tags=["auth"])

# A precomputed hash to verify against when the email doesn't exist, so a
# miss takes as long as a wrong password. Without it, response timing tells
# an attacker which emails have accounts.
_DUMMY_HASH = hash_password("timing-equaliser-not-a-real-password")


# There is deliberately no public sign-up: visitors have no use for an account,
# and every account is personal data to protect. Admins create users in
# Admin → Users (routes_rbac.create_user), which also assigns a role.


@router.post("/login", response_model=AuthOut,
             dependencies=[Depends(limit_by_ip("login", 20, 900))])
async def login(payload: LoginIn):
    email = payload.email.lower()
    # Per-account limit on top of per-IP: slows a distributed guess at one
    # account without letting one noisy office IP lock out its own staff.
    hit(f"login:email:{email}", 8, 900)

    user_doc = await db.users.find_one({"email": email}, {"_id": 0})
    ok = verify_password(payload.password, user_doc["password_hash"] if user_doc else _DUMMY_HASH)
    if not user_doc or not ok:
        raise HTTPException(status_code=401, detail="Invalid email or password")

    # Suspended accounts were previously able to sign in; the admin "Suspend"
    # button only blocked admin API calls after the fact.
    if user_doc.get("active") is False:
        raise HTTPException(status_code=403, detail="This account has been suspended")

    stamp = now_iso()
    await db.users.update_one({"id": user_doc["id"]}, {"$set": {"last_login": stamp}})
    user_doc["last_login"] = stamp

    token = create_token(user_doc["id"], user_doc["role"])
    return AuthOut(token=token, user=UserPublic(**user_doc))


@router.get("/me", response_model=UserPublic)
async def me(user: dict = Depends(get_current_user)):
    return UserPublic(**user)
