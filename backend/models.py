from pydantic import BaseModel, Field, EmailStr, ConfigDict
from typing import Optional, List
from datetime import datetime, timezone
import uuid


def gen_id() -> str:
    return str(uuid.uuid4())


def now_iso() -> str:
    return datetime.now(timezone.utc).isoformat()


class BaseDoc(BaseModel):
    model_config = ConfigDict(extra="ignore")
    id: str = Field(default_factory=gen_id)
    created_at: str = Field(default_factory=now_iso)
    updated_at: str = Field(default_factory=now_iso)


# ------- USER -------
class User(BaseDoc):
    email: EmailStr
    name: str
    password_hash: str
    role: str = "user"  # 'user' or 'admin'


class UserPublic(BaseModel):
    id: str
    email: EmailStr
    name: str
    role: str
    created_at: str


class RegisterIn(BaseModel):
    email: EmailStr
    name: str
    password: str


class LoginIn(BaseModel):
    email: EmailStr
    password: str


class AuthOut(BaseModel):
    token: str
    user: UserPublic


# ------- BANNER -------
class Banner(BaseDoc):
    title: str
    subtitle: Optional[str] = ""
    image_url: Optional[str] = ""
    cta_label: Optional[str] = ""
    cta_link: Optional[str] = ""
    order: int = 0
    active: bool = True


class BannerIn(BaseModel):
    title: str
    subtitle: Optional[str] = ""
    image_url: Optional[str] = ""
    cta_label: Optional[str] = ""
    cta_link: Optional[str] = ""
    order: int = 0
    active: bool = True


# ------- CATEGORY (tree) -------
class Category(BaseDoc):
    name: str
    slug: str
    parent_id: Optional[str] = None
    description: Optional[str] = ""
    order: int = 0
    active: bool = True


class CategoryIn(BaseModel):
    name: str
    slug: str
    parent_id: Optional[str] = None
    description: Optional[str] = ""
    order: int = 0
    active: bool = True


# ------- SERVICE (product) -------
class Service(BaseDoc):
    name: str
    slug: str
    category_id: Optional[str] = None
    short_description: str = ""
    long_description: str = ""
    image_url: Optional[str] = ""
    price_label: Optional[str] = "Custom Quote"
    features: List[str] = []
    deliverables: List[str] = []
    duration: Optional[str] = ""
    featured: bool = False
    active: bool = True


class ServiceIn(BaseModel):
    name: str
    slug: str
    category_id: Optional[str] = None
    short_description: str = ""
    long_description: str = ""
    image_url: Optional[str] = ""
    price_label: Optional[str] = "Custom Quote"
    features: List[str] = []
    deliverables: List[str] = []
    duration: Optional[str] = ""
    featured: bool = False
    active: bool = True


# ------- CMS PAGE -------
class Page(BaseDoc):
    slug: str
    title: str
    content: str = ""  # markdown / html
    meta_description: Optional[str] = ""


class PageIn(BaseModel):
    slug: str
    title: str
    content: str = ""
    meta_description: Optional[str] = ""


# ------- LEAD -------
class Lead(BaseDoc):
    name: str
    email: EmailStr
    phone: Optional[str] = ""
    company: Optional[str] = ""
    service_interest: Optional[str] = ""
    message: str = ""
    source: str = "contact_form"  # contact_form, lead_capture, pdp
    status: str = "new"  # new, contacted, qualified, closed


class LeadIn(BaseModel):
    name: str
    email: EmailStr
    phone: Optional[str] = ""
    company: Optional[str] = ""
    service_interest: Optional[str] = ""
    message: str = ""
    source: str = "contact_form"


class LeadUpdate(BaseModel):
    status: Optional[str] = None


# ------- CHAT -------
class ChatMessage(BaseDoc):
    session_id: str
    role: str  # user / assistant
    content: str


class ChatIn(BaseModel):
    session_id: Optional[str] = None
    message: str
