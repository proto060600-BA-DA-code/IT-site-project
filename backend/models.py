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


# ------- RBAC -------
# Every protected resource in the admin. Adding a resource here is all that's
# needed for it to appear in the role permission matrix.
RESOURCES = [
    "banners", "clients", "categories", "services", "pages", "posts",
    "leads", "media", "layouts", "users", "roles", "reports", "settings", "audit",
]
ACTIONS = ["create", "read", "update", "delete"]


def full_permissions() -> dict:
    return {r: {a: True for a in ACTIONS} for r in RESOURCES}


def no_permissions() -> dict:
    return {r: {a: False for a in ACTIONS} for r in RESOURCES}


def read_only_permissions() -> dict:
    return {r: {"create": False, "read": True, "update": False, "delete": False} for r in RESOURCES}


class Role(BaseDoc):
    name: str
    slug: str
    description: Optional[str] = ""
    # {resource: {action: bool}}
    permissions: dict = Field(default_factory=no_permissions)
    # Built-in roles cannot be deleted, and 'admin' cannot have its
    # permissions revoked — that is the lockout guard.
    system: bool = False


class RoleIn(BaseModel):
    name: str
    slug: Optional[str] = ""
    description: Optional[str] = ""
    permissions: Optional[dict] = None


# ------- USER -------
class User(BaseDoc):
    email: EmailStr
    name: str
    password_hash: str
    # Legacy string role, kept so existing tokens/logins keep working.
    role: str = "user"  # 'user' or 'admin'
    role_id: Optional[str] = None   # -> Role.id, the RBAC source of truth
    active: bool = True
    last_login: Optional[str] = None


class UserPublic(BaseModel):
    id: str
    email: EmailStr
    name: str
    role: str
    role_id: Optional[str] = None
    role_name: Optional[str] = None
    permissions: Optional[dict] = None
    active: bool = True
    last_login: Optional[str] = None
    created_at: str


class UserCreateIn(BaseModel):
    email: EmailStr
    name: str
    password: str
    role_id: Optional[str] = None
    active: bool = True


class UserUpdateIn(BaseModel):
    name: Optional[str] = None
    email: Optional[EmailStr] = None
    role_id: Optional[str] = None
    active: Optional[bool] = None


class PasswordResetIn(BaseModel):
    password: str


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


# ------- MEDIA LIBRARY -------
class Asset(BaseDoc):
    filename: str
    url: str
    thumb_url: Optional[str] = ""
    public_id: Optional[str] = ""      # Cloudinary handle, for deletion
    folder: str = "uploads"
    mime: Optional[str] = ""
    bytes: int = 0
    width: int = 0
    height: int = 0
    alt: Optional[str] = ""


class AssetIn(BaseModel):
    filename: str
    url: str
    thumb_url: Optional[str] = ""
    public_id: Optional[str] = ""
    folder: str = "uploads"
    mime: Optional[str] = ""
    bytes: int = 0
    width: int = 0
    height: int = 0
    alt: Optional[str] = ""


class AssetUpdateIn(BaseModel):
    filename: Optional[str] = None
    folder: Optional[str] = None
    alt: Optional[str] = None


# ------- PAGE BUILDER (dynamic zones) -------
class Block(BaseModel):
    """One instance of a section on a page. `type` maps to a React component
    in the frontend block registry; `props` is that block's own content."""
    model_config = ConfigDict(extra="ignore")
    id: str = Field(default_factory=gen_id)
    type: str
    props: dict = Field(default_factory=dict)
    visible: bool = True


class PageLayout(BaseDoc):
    page: str                      # 'home', 'about', 'services', …
    blocks: List[Block] = Field(default_factory=list)
    published: bool = True


class PageLayoutIn(BaseModel):
    blocks: List[Block] = Field(default_factory=list)
    published: bool = True


# ------- CLIENT (the "trusted by" band) -------
# Intentionally seeded empty. The homepage band renders only when at least
# one active client exists, so no placeholder logos can ever ship.
class Client(BaseDoc):
    name: str
    logo_url: Optional[str] = ""
    website: Optional[str] = ""
    order: int = 0
    active: bool = True


class ClientIn(BaseModel):
    name: str
    logo_url: Optional[str] = ""
    website: Optional[str] = ""
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
    status: str = "new"  # new, contacted, qualified, closed, spam
    # Spam scoring — recorded rather than silently dropped, so a false
    # positive can be released from the admin.
    spam_score: int = 0
    spam_reasons: List[str] = []
    # DPDP Act consent record: what the person agreed to, and when.
    consent: bool = False
    consent_at: Optional[str] = None
    consent_text: Optional[str] = None
    purpose: str = "respond_to_enquiry"


class LeadIn(BaseModel):
    name: str
    email: EmailStr
    phone: Optional[str] = ""
    company: Optional[str] = ""
    service_interest: Optional[str] = ""
    message: str = ""
    source: str = "contact_form"
    consent: bool = False
    consent_text: Optional[str] = None
    # Anti-spam signals. `website` is a honeypot: hidden from people, filled
    # by naive bots. `form_started_at` is epoch ms when the form first rendered.
    website: Optional[str] = ""
    form_started_at: Optional[int] = None


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
