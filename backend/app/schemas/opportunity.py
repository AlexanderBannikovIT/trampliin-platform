import uuid
from datetime import datetime
from typing import Literal

from pydantic import BaseModel, ConfigDict, Field, model_validator


# ── Nested ────────────────────────────────────────────────────────────────────

class TagShort(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    name: str
    category: str | None = None


class EmployerShort(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    company_name: str


# ── Search params (used as both query-param model and cache-key source) ───────

class SearchParams(BaseModel):
    q: str | None = None
    type: str | None = None          # OpportunityType value
    format: str | None = None        # OpportunityFormat value
    salary_min: float | None = None
    salary_max: float | None = None
    tags: list[str] = Field(default_factory=list)  # tag UUIDs
    lat: float | None = None
    lng: float | None = None
    radius_km: float = Field(default=10.0, ge=0)
    city: str | None = None
    sort: Literal["date", "salary", "relevance"] = "date"
    cursor: str | None = None

    @model_validator(mode="after")
    def relevance_requires_q(self) -> "SearchParams":
        if self.sort == "relevance" and not self.q:
            self.sort = "date"
        return self


# ── Create / Update ───────────────────────────────────────────────────────────

class OpportunityCreate(BaseModel):
    title: str = Field(..., max_length=300)
    description: str | None = None
    type: str        # OpportunityType value
    format: str      # OpportunityFormat value
    city: str | None = Field(None, max_length=200)
    address: str | None = Field(None, max_length=500)
    lat: float | None = None
    lng: float | None = None
    salary_min: float | None = Field(None, ge=0)
    salary_max: float | None = Field(None, ge=0)
    expires_at: datetime | None = None
    tags: list[uuid.UUID] = Field(default_factory=list)

    @model_validator(mode="after")
    def lat_lng_together(self) -> "OpportunityCreate":
        if (self.lat is None) != (self.lng is None):
            raise ValueError("lat and lng must both be provided or both omitted")
        return self


class OpportunityUpdate(BaseModel):
    title: str | None = Field(None, max_length=300)
    description: str | None = None
    type: str | None = None
    format: str | None = None
    city: str | None = None
    address: str | None = None
    lat: float | None = None
    lng: float | None = None
    salary_min: float | None = None
    salary_max: float | None = None
    expires_at: datetime | None = None
    tags: list[uuid.UUID] | None = None

    @model_validator(mode="after")
    def lat_lng_together(self) -> "OpportunityUpdate":
        if (self.lat is None) != (self.lng is None):
            raise ValueError("lat and lng must both be provided or both omitted")
        return self


# ── Response ──────────────────────────────────────────────────────────────────

class OpportunityResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    employer_id: uuid.UUID
    title: str
    description: str | None
    type: str
    format: str
    city: str | None
    address: str | None
    lat: float | None = None
    lng: float | None = None
    salary_min: float | None
    salary_max: float | None
    published_at: datetime
    expires_at: datetime | None
    status: str
    tags: list[TagShort] = []
    employer: EmployerShort | None = None


class OpportunityListResponse(BaseModel):
    items: list[OpportunityResponse]
    next_cursor: str | None
    total_count: int
    geo_json: dict  # GeoJSON FeatureCollection
