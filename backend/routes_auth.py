from fastapi import APIRouter, HTTPException, Depends
from db import db
from models import RegisterIn, LoginIn, AuthOut, User, UserPublic, now_iso
from auth import hash_password, verify_password, create_token, get_current_user
from ratelimit import limit_by_ip, hit

router = APIRouter(prefix="/auth", tags=["auth"])

# A precomputed hash to verify against when the email doesn't exist, so a
# miss takes as long as a wrong password. Without it, response timing tells
# an attacker which emails have accounts.
_DUMMY_HASH = hash_password("timing-equaliser-not-a-real-password")


@router.post("/register", response_model=AuthOut,
             dependencies=[Depends(limit_by_ip("register", 5, 3600))])
async def register(payload: RegisterIn):
    if len(payload.password) < 8:
        raise HTTPException(status_code=400, detail="Password must be at least 8 characters")
    existing = await db.users.find_one({"email": payload.email.lower()})
    if existing:
        raise HTTPException(status_code=409, detail="Email already registered")
    user = User(
        email=payload.email.lower(),
        name=payload.name,
        password_hash=hash_password(payload.password),
        role="user",
        last_login=now_iso(),
    )
    await db.users.insert_one(user.model_dump())
    token = create_token(user.id, user.role)
    return AuthOut(token=token, user=UserPublic(**user.model_dump()))


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
