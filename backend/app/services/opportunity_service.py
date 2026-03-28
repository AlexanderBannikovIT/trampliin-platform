"""
OpportunityService — business logic for the opportunities domain.

Redis cache
───────────
  key:  "search:{md5(sorted_query_params)}"
  TTL:  60 seconds
  Invalidated on: create / update / delete any opportunity.
"""

import hashlib
import json
import logging
import uuid
from datetime import UTC, datetime

from redis.asyncio import Redis
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.employer_profile import EmployerProfile, VerificationStatus
from app.models.opportunity import Opportunity, OpportunityStatus
from app.models.user import User, UserRole
from app.repositories.opportunity_repository import (
    OpportunityRepository,
    build_geo_json,
    extract_latlon,
)
from app.schemas.opportunity import (
    OpportunityCreate,
    OpportunityListResponse,
    OpportunityResponse,
    OpportunityUpdate,
    SearchParams,
    TagShort,
    EmployerShort,
)

logger = logging.getLogger(__name__)
_CACHE_TTL = 60


# ── helpers ───────────────────────────────────────────────────────────────────

def _cache_key(params: SearchParams) -> str:
    data = params.model_dump(mode="json")
    # Stable key regardless of dict ordering
    canonical = json.dumps(data, sort_keys=True, default=str)
    digest = hashlib.md5(canonical.encode()).hexdigest()
    return f"search:{digest}"


def _opportunity_to_response(opp: Opportunity) -> OpportunityResponse:
    lat, lng = extract_latlon(opp)
    return OpportunityResponse(
        id=opp.id,
        employer_id=opp.employer_id,
        title=opp.title,
        description=opp.description,
        type=opp.type.value,
        format=opp.format.value,
        city=opp.city,
        address=opp.address,
        lat=lat,
        lng=lng,
        salary_min=float(opp.salary_min) if opp.salary_min is not None else None,
        salary_max=float(opp.salary_max) if opp.salary_max is not None else None,
        published_at=opp.published_at,
        expires_at=opp.expires_at,
        status=opp.status.value,
        tags=[TagShort(id=t.id, name=t.name, category=t.category.value if t.category else None) for t in opp.tags],
        employer=EmployerShort(id=opp.employer.id, company_name=opp.employer.company_name)
        if opp.employer
        else None,
    )


# ── service ───────────────────────────────────────────────────────────────────

class OpportunityService:
    def __init__(self, session: AsyncSession, redis: Redis) -> None:
        self._db = session
        self._redis = redis
        self._repo = OpportunityRepository(session)

    # ── employer profile helper ────────────────────────────────────────────────

    async def _get_verified_employer_profile(self, user: User) -> EmployerProfile:
        from fastapi import HTTPException, status

        if user.role not in (UserRole.employer, UserRole.admin):
            raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Employers only")

        result = await self._db.execute(
            select(EmployerProfile).where(EmployerProfile.user_id == user.id)
        )
        profile = result.scalar_one_or_none()
        if not profile:
            raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Employer profile not found")
        if profile.verification_status != VerificationStatus.verified:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Employer account must be verified before posting opportunities",
            )
        return profile

    # ── cache ──────────────────────────────────────────────────────────────────

    async def _invalidate_search_cache(self) -> None:
        try:
            keys = await self._redis.keys("search:*")
            if keys:
                await self._redis.delete(*keys)
        except Exception:
            logger.exception("Failed to invalidate search cache")

    # ── public API ─────────────────────────────────────────────────────────────

    async def create_opportunity(self, user: User, data: OpportunityCreate) -> OpportunityResponse:
        profile = await self._get_verified_employer_profile(user)

        opp = await self._repo.create(
            employer_id=profile.id,
            data=data.model_dump(exclude={"tags"}),
            tag_ids=data.tags,
        )
        await self._db.commit()

        # Reload with relationships via selectinload (refresh would re-expire them)
        opp = await self._repo.get_by_id(opp.id)
        await self._invalidate_search_cache()
        return _opportunity_to_response(opp)

    async def update_opportunity(
        self, opp_id: uuid.UUID, data: OpportunityUpdate, user: User
    ) -> OpportunityResponse:
        from fastapi import HTTPException, status

        opp = await self._repo.get_by_id(opp_id)
        if not opp:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Opportunity not found")

        # Authorization: owner employer or curator/admin
        is_curator = user.role in (UserRole.curator, UserRole.admin)
        if not is_curator:
            ep_result = await self._db.execute(
                select(EmployerProfile).where(EmployerProfile.user_id == user.id)
            )
            ep = ep_result.scalar_one_or_none()
            if not ep or ep.id != opp.employer_id:
                raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Not allowed")

        update_data = data.model_dump(exclude_unset=True)
        tag_ids = update_data.pop("tags", None)

        # Active → back to moderation on edit
        if opp.status == OpportunityStatus.active:
            update_data["status"] = OpportunityStatus.moderation

        opp = await self._repo.update(opp, data=update_data, tag_ids=tag_ids)
        await self._db.commit()
        opp = await self._repo.get_by_id(opp.id)
        await self._invalidate_search_cache()
        return _opportunity_to_response(opp)

    async def get_opportunity(self, opp_id: uuid.UUID) -> OpportunityResponse:
        from fastapi import HTTPException, status

        opp = await self._repo.get_by_id(opp_id)
        if not opp:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Opportunity not found")
        return _opportunity_to_response(opp)

    async def search_opportunities(self, params: SearchParams) -> OpportunityListResponse:
        key = _cache_key(params)

        # Try cache
        cached = await self._redis.get(key)
        if cached:
            try:
                return OpportunityListResponse.model_validate_json(cached)
            except Exception:
                pass  # corrupt cache → re-fetch

        items, total, next_cursor = await self._repo.search(params)
        geo_json = build_geo_json(items)

        response = OpportunityListResponse(
            items=[_opportunity_to_response(opp) for opp in items],
            next_cursor=next_cursor,
            total_count=total,
            geo_json=geo_json,
        )

        # Store in cache
        try:
            await self._redis.setex(key, _CACHE_TTL, response.model_dump_json())
        except Exception:
            logger.exception("Failed to cache search result")

        return response

    async def close_opportunity(self, opp_id: uuid.UUID, user: User) -> OpportunityResponse:
        from fastapi import HTTPException, status

        opp = await self._repo.get_by_id(opp_id)
        if not opp:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Opportunity not found")

        is_curator = user.role in (UserRole.curator, UserRole.admin)
        if not is_curator:
            ep_result = await self._db.execute(
                select(EmployerProfile).where(EmployerProfile.user_id == user.id)
            )
            ep = ep_result.scalar_one_or_none()
            if not ep or ep.id != opp.employer_id:
                raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Not allowed")

        opp = await self._repo.update(
            opp, data={"status": OpportunityStatus.closed}, tag_ids=None
        )
        await self._db.commit()
        opp = await self._repo.get_by_id(opp.id)
        await self._invalidate_search_cache()
        return _opportunity_to_response(opp)

    async def delete_opportunity(self, opp_id: uuid.UUID, user: User) -> None:
        from fastapi import HTTPException, status

        opp = await self._repo.get_by_id(opp_id)
        if not opp:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Opportunity not found")

        is_curator = user.role in (UserRole.curator, UserRole.admin)
        if not is_curator:
            ep_result = await self._db.execute(
                select(EmployerProfile).where(EmployerProfile.user_id == user.id)
            )
            ep = ep_result.scalar_one_or_none()
            if not ep or ep.id != opp.employer_id:
                raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Not allowed")

        await self._repo.delete(opp)
        await self._db.commit()
        await self._invalidate_search_cache()
