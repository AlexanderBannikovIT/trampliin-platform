from uuid import UUID

from fastapi import APIRouter, Depends, status
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.database import get_db
from app.core.dependencies import get_current_active_user, require_role
from app.models.user import User, UserRole
from app.schemas.seeker import (
    SeekerProfileResponse,
    SeekerProfileUpdate,
    ApplicationResponse,
)
from app.services.seeker_service import SeekerService

router = APIRouter(prefix="/profile", tags=["profile"])


def _svc(db: AsyncSession) -> SeekerService:
    return SeekerService(db)


# ── Seeker profile ─────────────────────────────────────────────────────────────

@router.get(
    "/seeker",
    response_model=SeekerProfileResponse,
    summary="My seeker profile",
)
async def get_my_seeker_profile(
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_role(UserRole.seeker)),
) -> SeekerProfileResponse:
    return await _svc(db).get_my_profile(current_user)


@router.patch(
    "/seeker",
    response_model=SeekerProfileResponse,
    summary="Update my seeker profile",
)
async def update_my_seeker_profile(
    body: SeekerProfileUpdate,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_role(UserRole.seeker)),
) -> SeekerProfileResponse:
    return await _svc(db).update_my_profile(current_user, body)


@router.get(
    "/seeker/{profile_id}",
    response_model=SeekerProfileResponse,
    summary="View another seeker's public profile (respects privacy)",
)
async def get_seeker_profile_by_id(
    profile_id: UUID,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_active_user),
) -> SeekerProfileResponse:
    return await _svc(db).get_public_profile(profile_id, current_user)


@router.get(
    "/seeker/applications/my",
    response_model=list[ApplicationResponse],
    summary="My applications history",
)
async def get_my_applications(
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_role(UserRole.seeker)),
) -> list[ApplicationResponse]:
    return await _svc(db).get_applications_history(current_user)


# ── Employer profile (stubs — to be implemented in employer prompt) ────────────

@router.get("/employer", status_code=status.HTTP_501_NOT_IMPLEMENTED)
async def get_employer_profile() -> dict:
    return {"detail": "Not implemented yet"}


@router.patch("/employer", status_code=status.HTTP_501_NOT_IMPLEMENTED)
async def update_employer_profile() -> dict:
    return {"detail": "Not implemented yet"}
