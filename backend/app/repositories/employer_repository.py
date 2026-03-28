import uuid

from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.models.application import Application
from app.models.employer_profile import EmployerProfile
from app.models.opportunity import Opportunity, OpportunityStatus, OpportunityType


class EmployerRepository:
    def __init__(self, session: AsyncSession) -> None:
        self._db = session

    # ── profile ───────────────────────────────────────────────────────────────

    async def get_by_user_id(self, user_id: uuid.UUID) -> EmployerProfile | None:
        result = await self._db.execute(
            select(EmployerProfile)
            .where(EmployerProfile.user_id == user_id)
            .options(selectinload(EmployerProfile.user))
        )
        return result.scalar_one_or_none()

    async def get_by_id(self, profile_id: uuid.UUID) -> EmployerProfile | None:
        result = await self._db.execute(
            select(EmployerProfile)
            .where(EmployerProfile.id == profile_id)
            .options(selectinload(EmployerProfile.user))
        )
        return result.scalar_one_or_none()

    async def update(self, profile: EmployerProfile, **fields) -> EmployerProfile:
        for key, value in fields.items():
            setattr(profile, key, value)
        await self._db.flush()
        await self._db.refresh(profile)
        return profile

    # ── opportunities ─────────────────────────────────────────────────────────

    async def get_opportunities(
        self,
        employer_id: uuid.UUID,
        status: str | None = None,
        type_filter: str | None = None,
    ) -> list[tuple[Opportunity, int]]:
        """Return list of (opportunity, application_count)."""
        q = (
            select(Opportunity, func.count(Application.id).label("app_count"))
            .outerjoin(Application, Application.opportunity_id == Opportunity.id)
            .where(Opportunity.employer_id == employer_id)
            .group_by(Opportunity.id)
            .order_by(Opportunity.published_at.desc())
        )
        if status:
            q = q.where(Opportunity.status == OpportunityStatus(status))
        if type_filter:
            q = q.where(Opportunity.type == OpportunityType(type_filter))

        rows = (await self._db.execute(q)).all()
        return [(row[0], row[1]) for row in rows]

    async def get_stats(self, employer_id: uuid.UUID) -> dict:
        total_q = await self._db.execute(
            select(func.count()).where(Opportunity.employer_id == employer_id)
        )
        active_q = await self._db.execute(
            select(func.count()).where(
                Opportunity.employer_id == employer_id,
                Opportunity.status == OpportunityStatus.active,
            )
        )
        apps_q = await self._db.execute(
            select(func.count(Application.id))
            .join(Opportunity, Application.opportunity_id == Opportunity.id)
            .where(Opportunity.employer_id == employer_id)
        )
        return {
            "total_opportunities": total_q.scalar_one(),
            "active_opportunities": active_q.scalar_one(),
            "total_applications": apps_q.scalar_one(),
        }

    # ── applications ──────────────────────────────────────────────────────────

    async def get_applications(
        self, opportunity_id: uuid.UUID, employer_id: uuid.UUID
    ) -> list[Application]:
        """Return applications for an opportunity owned by this employer."""
        from app.models.seeker_profile import SeekerProfile

        result = await self._db.execute(
            select(Application)
            .join(Opportunity, Application.opportunity_id == Opportunity.id)
            .where(
                Application.opportunity_id == opportunity_id,
                Opportunity.employer_id == employer_id,
            )
            .options(
                selectinload(Application.seeker).selectinload(SeekerProfile.user)
            )
            .order_by(Application.applied_at.desc())
        )
        return list(result.scalars().all())

    async def get_application_by_id(self, app_id: uuid.UUID) -> Application | None:
        result = await self._db.execute(
            select(Application).where(Application.id == app_id)
        )
        return result.scalar_one_or_none()
