from uuid import UUID

from fastapi import APIRouter, Depends, Query
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.database import get_db
from app.core.dependencies import require_admin, require_curator
from app.models.user import User
from app.schemas.curator import (
    CreateCuratorRequest,
    CuratorQueue,
    ModerateOpportunityRequest,
    ModerateOpportunityResponse,
    TagModerateRequest,
    TagResponse,
    UserListItem,
    UserUpdateRequest,
    VerifyEmployerRequest,
    VerifyEmployerResponse,
)
from app.services.curator_service import CuratorService

router = APIRouter(prefix="/curator", tags=["curator"])


# ── Queue ──────────────────────────────────────────────────────────────────────

@router.get("/queue", response_model=CuratorQueue)
async def get_queue(
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_curator),
) -> CuratorQueue:
    return await CuratorService(db).get_queue()


# ── Employer verification ──────────────────────────────────────────────────────

@router.patch("/employers/{employer_id}/verify", response_model=VerifyEmployerResponse)
async def verify_employer(
    employer_id: UUID,
    body: VerifyEmployerRequest,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_curator),
) -> VerifyEmployerResponse:
    return await CuratorService(db).verify_employer(employer_id, body, current_user)


# ── Opportunity moderation ─────────────────────────────────────────────────────

@router.patch("/opportunities/{opportunity_id}/moderate", response_model=ModerateOpportunityResponse)
async def moderate_opportunity(
    opportunity_id: UUID,
    body: ModerateOpportunityRequest,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_curator),
) -> ModerateOpportunityResponse:
    return await CuratorService(db).moderate_opportunity(opportunity_id, body, current_user)


# ── Users management ───────────────────────────────────────────────────────────

@router.get("/users", response_model=list[UserListItem])
async def list_users(
    role: str | None = Query(default=None),
    is_active: bool | None = Query(default=None),
    limit: int = Query(default=100, le=500),
    offset: int = Query(default=0, ge=0),
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_curator),
) -> list[UserListItem]:
    return await CuratorService(db).list_users(role=role, is_active=is_active, limit=limit, offset=offset)


@router.patch("/users/{user_id}", response_model=UserListItem)
async def update_user(
    user_id: UUID,
    body: UserUpdateRequest,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_curator),
) -> UserListItem:
    return await CuratorService(db).update_user(user_id, body, current_user)


# ── Curator management (admin only) ───────────────────────────────────────────

@router.get("/curators", response_model=list[UserListItem])
async def list_curators(
    is_active: bool | None = Query(default=None),
    limit: int = Query(default=100, le=500),
    offset: int = Query(default=0, ge=0),
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_admin),
) -> list[UserListItem]:
    return await CuratorService(db).list_curators(is_active=is_active, limit=limit, offset=offset)


@router.post("/curators", response_model=UserListItem, status_code=201)
async def create_curator(
    body: CreateCuratorRequest,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_admin),
) -> UserListItem:
    return await CuratorService(db).create_curator(body, current_user)


@router.patch("/curators/{curator_id}", response_model=UserListItem)
async def update_curator(
    curator_id: UUID,
    body: UserUpdateRequest,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_admin),
) -> UserListItem:
    return await CuratorService(db).update_curator(curator_id, body, current_user)


# ── Tags management ────────────────────────────────────────────────────────────

@router.get("/tags/pending", response_model=list[TagResponse])
async def get_pending_tags(
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_curator),
) -> list[TagResponse]:
    return await CuratorService(db).get_pending_tags()


@router.patch("/tags/{tag_id}")
async def moderate_tag(
    tag_id: UUID,
    body: TagModerateRequest,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_curator),
) -> dict:
    return await CuratorService(db).moderate_tag(tag_id, body)


@router.patch("/tags/{tag_id}/restore", response_model=TagResponse)
async def restore_tag(
    tag_id: UUID,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_curator),
) -> TagResponse:
    return await CuratorService(db).restore_tag(tag_id)
