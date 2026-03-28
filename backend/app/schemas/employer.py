import uuid
from datetime import datetime
from typing import Literal

from pydantic import BaseModel, ConfigDict, Field


# ── Employer profile ──────────────────────────────────────────────────────────

class EmployerProfileResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    user_id: uuid.UUID
    company_name: str
    inn: str | None
    sphere: str | None
    description: str | None
    website: str | None
    corporate_email: str | None
    logo_url: str | None
    verification_status: str
    verified_at: datetime | None
    display_name: str  # from user.display_name


class EmployerProfileUpdate(BaseModel):
    company_name: str | None = Field(None, max_length=200)
    sphere: str | None = Field(None, max_length=200)
    description: str | None = None
    website: str | None = Field(None, max_length=500)
    logo_url: str | None = None


# ── Opportunities for employer ────────────────────────────────────────────────

class OpportunityWithStats(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    title: str
    type: str
    format: str
    city: str | None
    status: str
    published_at: datetime
    expires_at: datetime | None
    salary_min: float | None
    salary_max: float | None
    application_count: int = 0


# ── Applications ───────────────────────────────────────────────────────────────

class SeekerBriefForEmployer(BaseModel):
    id: uuid.UUID
    user_id: uuid.UUID
    full_name: str | None
    display_name: str
    skills: list[str] = []
    university: str | None = None


class ApplicationForEmployer(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    seeker_id: uuid.UUID
    opportunity_id: uuid.UUID
    status: str
    applied_at: datetime
    seeker: SeekerBriefForEmployer | None = None


class ApplicationStatusUpdate(BaseModel):
    status: Literal["submitted", "reviewed", "accepted", "rejected", "reserve"]


# ── Stats ─────────────────────────────────────────────────────────────────────

class EmployerStats(BaseModel):
    total_opportunities: int
    active_opportunities: int
    total_applications: int
