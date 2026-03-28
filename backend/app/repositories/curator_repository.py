import uuid
from datetime import datetime, timezone

from sqlalchemy import select, update
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.models.employer_profile import EmployerProfile, VerificationStatus
from app.models.opportunity import Opportunity, OpportunityStatus
from app.models.tag import Tag
from app.models.user import User, UserRole


class CuratorRepository:
    def __init__(self, session: AsyncSession) -> None:
        self._db = session

    # ── Employer verification queue ────────────────────────────────────────────

    async def get_pending_employers(self) -> list[EmployerProfile]:
        result = await self._db.execute(
            select(EmployerProfile)
            .where(EmployerProfile.verification_status == VerificationStatus.pending)
            .options(selectinload(EmployerProfile.user))
            .order_by(EmployerProfile.id)
        )
        return list(result.scalars().all())

    async def get_employer_by_id(self, employer_id: uuid.UUID) -> EmployerProfile | None:
        result = await self._db.execute(
            select(EmployerProfile)
            .where(EmployerProfile.id == employer_id)
            .options(selectinload(EmployerProfile.user))
        )
        return result.scalar_one_or_none()

    async def verify_employer(
        self,
        profile: EmployerProfile,
        status: VerificationStatus,
        curator_id: uuid.UUID,
    ) -> EmployerProfile:
        profile.verification_status = status
        profile.verified_by = curator_id
        profile.verified_at = datetime.now(timezone.utc)
        await self._db.flush()
        await self._db.refresh(profile)
        return profile

    # ── Opportunity moderation queue ───────────────────────────────────────────

    async def get_pending_opportunities(self) -> list[Opportunity]:
        result = await self._db.execute(
            select(Opportunity)
            .where(Opportunity.status == OpportunityStatus.moderation)
            .options(
                selectinload(Opportunity.employer).selectinload(EmployerProfile.user)
            )
            .order_by(Opportunity.published_at.asc())
        )
        return list(result.scalars().all())

    async def get_opportunity_by_id(self, opp_id: uuid.UUID) -> Opportunity | None:
        result = await self._db.execute(
            select(Opportunity)
            .where(Opportunity.id == opp_id)
            .options(
                selectinload(Opportunity.employer).selectinload(EmployerProfile.user)
            )
        )
        return result.scalar_one_or_none()

    async def moderate_opportunity(
        self,
        opp: Opportunity,
        new_status: OpportunityStatus,
        comment: str | None,
    ) -> Opportunity:
        opp.status = new_status
        opp.moderation_comment = comment
        await self._db.flush()
        await self._db.refresh(opp)
        return opp

    # ── Users ──────────────────────────────────────────────────────────────────

    async def get_users(
        self, role: str | None = None, is_active: bool | None = None, limit: int = 100, offset: int = 0
    ) -> list[User]:
        q = select(User).order_by(User.created_at.desc()).limit(limit).offset(offset)
        if role:
            q = q.where(User.role == UserRole(role))
        if is_active is not None:
            q = q.where(User.is_active == is_active)
        result = await self._db.execute(q)
        return list(result.scalars().all())

    async def get_user_by_id(self, user_id: uuid.UUID) -> User | None:
        result = await self._db.execute(select(User).where(User.id == user_id))
        return result.scalar_one_or_none()

    async def update_user(self, user: User, **fields) -> User:
        for key, value in fields.items():
            setattr(user, key, value)
        await self._db.flush()
        await self._db.refresh(user)
        return user

    # ── Tags ───────────────────────────────────────────────────────────────────

    async def get_pending_tags(self) -> list[Tag]:
        result = await self._db.execute(
            select(Tag).where(Tag.is_active == False).order_by(Tag.name)  # noqa: E712
        )
        return list(result.scalars().all())

    async def get_all_active_tags(self) -> list[Tag]:
        result = await self._db.execute(
            select(Tag).where(Tag.is_active == True).order_by(Tag.name)  # noqa: E712
        )
        return list(result.scalars().all())

    async def get_tag_by_id(self, tag_id: uuid.UUID) -> Tag | None:
        result = await self._db.execute(select(Tag).where(Tag.id == tag_id))
        return result.scalar_one_or_none()

    async def approve_tag(self, tag: Tag) -> Tag:
        tag.is_active = True
        await self._db.flush()
        await self._db.refresh(tag)
        return tag

    async def delete_tag(self, tag: Tag) -> None:
        await self._db.delete(tag)
        await self._db.flush()

    async def create_tag(self, name: str, category: str | None, created_by: uuid.UUID | None) -> Tag:
        tag = Tag(name=name, category=category, created_by=created_by, is_active=True)
        self._db.add(tag)
        await self._db.flush()
        await self._db.refresh(tag)
        return tag
