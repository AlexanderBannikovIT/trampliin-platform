from uuid import UUID

from fastapi import APIRouter, Depends, Query, status
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.database import get_db
from app.core.dependencies import require_role
from app.models.user import User, UserRole
from app.schemas.employer import (
    ApplicationForEmployer,
    ApplicationStatusUpdate,
    EmployerProfileResponse,
    EmployerProfileUpdate,
    EmployerStats,
    OpportunityWithStats,
)
from app.services.employer_service import EmployerService

router = APIRouter(prefix="/employer", tags=["employer"])


def _svc(db: AsyncSession) -> EmployerService:
    return EmployerService(db)


# ── Profile ───────────────────────────────────────────────────────────────────

@router.get("/profile", response_model=EmployerProfileResponse)
async def get_employer_profile(
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_role(UserRole.employer)),
) -> EmployerProfileResponse:
    return await _svc(db).get_my_profile(current_user)


@router.patch("/profile", response_model=EmployerProfileResponse)
async def update_employer_profile(
    body: EmployerProfileUpdate,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_role(UserRole.employer)),
) -> EmployerProfileResponse:
    return await _svc(db).update_my_profile(current_user, body)


# ── Stats ─────────────────────────────────────────────────────────────────────

@router.get("/stats", response_model=EmployerStats)
async def get_stats(
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_role(UserRole.employer)),
) -> EmployerStats:
    return await _svc(db).get_stats(current_user)


# ── Opportunities ─────────────────────────────────────────────────────────────

@router.get("/opportunities", response_model=list[OpportunityWithStats])
async def list_my_opportunities(
    status: str | None = Query(None, description="draft|moderation|active|closed"),
    type: str | None = Query(None, description="vacancy|internship|mentorship|event"),
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_role(UserRole.employer)),
) -> list[OpportunityWithStats]:
    return await _svc(db).get_my_opportunities(current_user, status, type)


# ── Applications ──────────────────────────────────────────────────────────────

@router.get(
    "/opportunities/{opportunity_id}/applications",
    response_model=list[ApplicationForEmployer],
)
async def list_applications(
    opportunity_id: UUID,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_role(UserRole.employer)),
) -> list[ApplicationForEmployer]:
    return await _svc(db).get_applications_for_opportunity(current_user, opportunity_id)


@router.patch("/applications/{app_id}", response_model=ApplicationForEmployer)
async def update_application_status(
    app_id: UUID,
    body: ApplicationStatusUpdate,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_role(UserRole.employer)),
) -> ApplicationForEmployer:
    return await _svc(db).update_application_status(current_user, app_id, body)
