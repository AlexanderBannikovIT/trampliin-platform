import uuid
from datetime import datetime

from pydantic import BaseModel, ConfigDict, EmailStr, field_validator, model_validator


# ── Request schemas ───────────────────────────────────────────────────────────

class RegisterRequest(BaseModel):
    email: EmailStr
    display_name: str
    password: str
    role: str  # "seeker" | "employer"

    # Employer-only fields (required when role == "employer")
    company_name: str | None = None
    inn: str | None = None
    corporate_email: EmailStr | None = None

    @field_validator("role")
    @classmethod
    def validate_role(cls, v: str) -> str:
        if v not in ("seeker", "employer"):
            raise ValueError("role must be 'seeker' or 'employer'")
        return v

    @field_validator("password")
    @classmethod
    def validate_password(cls, v: str) -> str:
        if len(v) < 8:
            raise ValueError("password must be at least 8 characters")
        return v

    @model_validator(mode="after")
    def employer_fields_required(self) -> "RegisterRequest":
        if self.role == "employer" and not self.company_name:
            raise ValueError("company_name is required for employer registration")
        if self.role == "employer" and not self.corporate_email:
            raise ValueError("corporate_email is required for employer registration")
        return self


class LoginRequest(BaseModel):
    email: EmailStr
    password: str


# ── Response schemas ──────────────────────────────────────────────────────────

class UserResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    email: str
    display_name: str
    role: str
    is_active: bool
    created_at: datetime


class RegisterResponse(BaseModel):
    detail: str
    user: UserResponse


class MessageResponse(BaseModel):
    detail: str
