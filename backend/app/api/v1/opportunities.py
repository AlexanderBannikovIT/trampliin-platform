from uuid import UUID

from fastapi import APIRouter, Depends, Query, status
from redis.asyncio import Redis
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.database import get_db
from app.core.dependencies import get_current_active_user, get_current_user
from app.core.redis import get_redis
from app.models.user import User
from app.schemas.opportunity import (
    OpportunityCreate,
    OpportunityListResponse,
    OpportunityResponse,
    OpportunityUpdate,
    SearchParams,
)
from app.services.opportunity_service import OpportunityService

router = APIRouter(prefix="/opportunities", tags=["opportunities"])


def _svc(db: AsyncSession, redis: Redis) -> OpportunityService:
    return OpportunityService(db, redis)


# ── Public: list / search ─────────────────────────────────────────────────────

@router.get("", response_model=OpportunityListResponse, summary="Search opportunities (public)")
async def list_opportunities(
    q: str | None = Query(None, description="Full-text search query"),
    type: str | None = Query(None, description="vacancy | internship | mentorship | event"),
    format: str | None = Query(None, description="office | hybrid | remote"),
    salary_min: float | None = Query(None, ge=0),
    salary_max: float | None = Query(None, ge=0),
    tags: list[str] = Query(default=[], description="Tag UUIDs to filter by"),
    lat: float | None = Query(None, ge=-90, le=90),
    lng: float | None = Query(None, ge=-180, le=180),
    radius_km: float = Query(10.0, ge=0),
    city: str | None = Query(None),
    sort: str = Query("date", pattern="^(date|salary|relevance)$"),
    cursor: str | None = Query(None),
    db: AsyncSession = Depends(get_db),
    redis: Redis = Depends(get_redis),
) -> OpportunityListResponse:
    params = SearchParams(
        q=q, type=type, format=format,
        salary_min=salary_min, salary_max=salary_max,
        tags=tags, lat=lat, lng=lng, radius_km=radius_km,
        city=city, sort=sort, cursor=cursor,  # type: ignore[arg-type]
    )
    return await _svc(db, redis).search_opportunities(params)


# ── Public: single ────────────────────────────────────────────────────────────

@router.get("/{opportunity_id}", response_model=OpportunityResponse, summary="Get opportunity by ID (public)")
async def get_opportunity(
    opportunity_id: UUID,
    db: AsyncSession = Depends(get_db),
    redis: Redis = Depends(get_redis),
) -> OpportunityResponse:
    return await _svc(db, redis).get_opportunity(opportunity_id)


# ── Authenticated: create ─────────────────────────────────────────────────────

@router.post(
    "",
    response_model=OpportunityResponse,
    status_code=status.HTTP_201_CREATED,
    summary="Create opportunity (verified employer only)",
)
async def create_opportunity(
    body: OpportunityCreate,
    db: AsyncSession = Depends(get_db),
    redis: Redis = Depends(get_redis),
    current_user: User = Depends(get_current_active_user),
) -> OpportunityResponse:
    return await _svc(db, redis).create_opportunity(current_user, body)


# ── Authenticated: update ─────────────────────────────────────────────────────

@router.patch(
    "/{opportunity_id}",
    response_model=OpportunityResponse,
    summary="Update opportunity (owner employer or curator)",
)
async def update_opportunity(
    opportunity_id: UUID,
    body: OpportunityUpdate,
    db: AsyncSession = Depends(get_db),
    redis: Redis = Depends(get_redis),
    current_user: User = Depends(get_current_active_user),
) -> OpportunityResponse:
    return await _svc(db, redis).update_opportunity(opportunity_id, body, current_user)


# ── Authenticated: delete ─────────────────────────────────────────────────────

@router.delete(
    "/{opportunity_id}",
    status_code=status.HTTP_204_NO_CONTENT,
    summary="Delete opportunity (owner employer or curator)",
)
async def delete_opportunity(
    opportunity_id: UUID,
    db: AsyncSession = Depends(get_db),
    redis: Redis = Depends(get_redis),
    current_user: User = Depends(get_current_active_user),
) -> None:
    await _svc(db, redis).delete_opportunity(opportunity_id, current_user)
