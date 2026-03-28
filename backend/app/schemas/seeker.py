import uuid
from datetime import datetime
from typing import Literal

from pydantic import BaseModel, ConfigDict, Field


# ── Nested ────────────────────────────────────────────────────────────────────

class OpportunityBrief(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    title: str
    type: str
    format: str
    city: str | None
    employer_name: str | None = None  # populated manually


class SeekerBrief(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    user_id: uuid.UUID
    full_name: str | None
    display_name: str  # from user.display_name
    university: str | None = None
    skills: list[str] = []


# ── Seeker profile ─────────────────────────────────────────────────────────────

class SeekerProfileResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    user_id: uuid.UUID
    full_name: str | None
    university: str | None
    graduation_year: int | None
    bio: str | None
    skills: list[str]
    links: dict[str, str]
    privacy: str
    display_name: str  # from user.display_name


class SeekerProfileUpdate(BaseModel):
    full_name: str | None = Field(None, max_length=200)
    university: str | None = Field(None, max_length=200)
    graduation_year: int | None = Field(None, ge=1950, le=2100)
    bio: str | None = None
    skills: list[str] | None = None
    links: dict[str, str] | None = None
    privacy: Literal["private", "contacts", "public"] | None = None


# ── Applications ───────────────────────────────────────────────────────────────

class ApplicationResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    opportunity_id: uuid.UUID
    status: str
    applied_at: datetime
    opportunity: OpportunityBrief | None = None


# ── Contacts ───────────────────────────────────────────────────────────────────

class ContactResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    seeker_id: uuid.UUID
    contact_id: uuid.UUID
    status: str
    created_at: datetime
    # The "other" side of the contact (populated by service)
    profile: SeekerBrief | None = None


class ContactActionRequest(BaseModel):
    accept: bool


# ── Recommendations ─────────────────────────────────────────────────────────────

class RecommendRequest(BaseModel):
    opportunity_id: uuid.UUID
    message: str | None = None


class RecommendationResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    from_seeker_id: uuid.UUID
    to_seeker_id: uuid.UUID
    opportunity_id: uuid.UUID
    message: str | None
    is_read: bool
    created_at: datetime
    from_seeker: SeekerBrief | None = None
    opportunity_title: str | None = None


# ── Seeker search ───────────────────────────────────────────────────────────────

class SeekerSearchResult(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    user_id: uuid.UUID
    full_name: str | None
    display_name: str
    university: str | None
    skills: list[str]
    is_contact: bool = False
    request_sent: bool = False
