from fastapi import APIRouter, HTTPException, Depends
from db import db
from models import RegisterIn, LoginIn, AuthOut, User, UserPublic, now_iso
from auth import hash_password, verify_password, create_token, get_current_user

router = APIRouter(prefix="/auth", tags=["auth"])


@router.post("/register", response_model=AuthOut)
async def register(payload: RegisterIn):
    existing = await db.users.find_one({"email": payload.email.lower()})
    if existing:
        raise HTTPException(status_code=409, detail="Email already registered")
    user = User(
        email=payload.email.lower(),
        name=payload.name,
        password_hash=hash_password(payload.password),
        role="user",
    )
    await db.users.insert_one(user.model_dump())
    token = create_token(user.id, user.role)
    return AuthOut(token=token, user=UserPublic(**user.model_dump()))


@router.post("/login", response_model=AuthOut)
async def login(payload: LoginIn):
    user_doc = await db.users.find_one({"email": payload.email.lower()}, {"_id": 0})
    if not user_doc or not verify_password(payload.password, user_doc["password_hash"]):
        raise HTTPException(status_code=401, detail="Invalid email or password")
    token = create_token(user_doc["id"], user_doc["role"])
    return AuthOut(token=token, user=UserPublic(**user_doc))


@router.get("/me", response_model=UserPublic)
async def me(user: dict = Depends(get_current_user)):
    return UserPublic(**user)
