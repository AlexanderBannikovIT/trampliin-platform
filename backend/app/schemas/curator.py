from datetime import datetime
from uuid import UUID

from pydantic import BaseModel, ConfigDict


# ── Employer verification ──────────────────────────────────────────────────────

class EmployerInQueue(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: UUID
    user_id: UUID
    company_name: str
    inn: str | None
    sphere: str | None
    website: str | None
    corporate_email: str | None
    logo_url: str | None
    verification_status: str
    display_name: str
    email: str
    created_at: datetime
    is_suspicious: bool = False  # flagged if personal email domain or no INN


class VerifyEmployerRequest(BaseModel):
    status: str  # "verified" | "rejected"
    comment: str | None = None


class VerifyEmployerResponse(BaseModel):
    id: UUID
    verification_status: str
    verified_at: datetime | None


# ── Opportunity moderation ─────────────────────────────────────────────────────

class OpportunityInQueue(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: UUID
    employer_id: UUID
    company_name: str
    title: str
    type: str
    format: str
    city: str | None
    salary_min: float | None
    salary_max: float | None
    published_at: datetime
    expires_at: datetime | None
    status: str
    moderation_comment: str | None


class ModerateOpportunityRequest(BaseModel):
    status: str  # "active" | "draft"
    comment: str | None = None


class ModerateOpportunityResponse(BaseModel):
    id: UUID
    status: str
    moderation_comment: str | None


# ── Curator queue (combined) ───────────────────────────────────────────────────

class CuratorQueue(BaseModel):
    verification: list[EmployerInQueue]
    moderation: list[OpportunityInQueue]
    tags: list[dict]


# ── Users management ──────────────────────────────────────────────────────────

class UserListItem(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: UUID
    email: str
    display_name: str
    role: str
    is_active: bool
    created_at: datetime


class UserUpdateRequest(BaseModel):
    role: str | None = None
    is_active: bool | None = None


class CreateCuratorRequest(BaseModel):
    email: str
    display_name: str
    password: str


# ── Tags ──────────────────────────────────────────────────────────────────────

class TagResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: UUID
    name: str
    category: str | None
    is_active: bool


class TagModerateRequest(BaseModel):
    action: str  # "approve" | "reject"
