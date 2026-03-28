import uuid

from sqlalchemy import and_, or_, select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.models.contact import Contact, ContactStatus
from app.models.seeker_profile import PrivacyLevel, SeekerProfile


class SeekerRepository:
    def __init__(self, session: AsyncSession) -> None:
        self._db = session

    # ── read ──────────────────────────────────────────────────────────────────

    async def get_by_user_id(self, user_id: uuid.UUID) -> SeekerProfile | None:
        result = await self._db.execute(
            select(SeekerProfile)
            .where(SeekerProfile.user_id == user_id)
            .options(selectinload(SeekerProfile.user))
        )
        return result.scalar_one_or_none()

    async def get_by_id(self, profile_id: uuid.UUID) -> SeekerProfile | None:
        result = await self._db.execute(
            select(SeekerProfile)
            .where(SeekerProfile.id == profile_id)
            .options(selectinload(SeekerProfile.user))
        )
        return result.scalar_one_or_none()

    async def get_with_privacy_check(
        self,
        profile_id: uuid.UUID,
        requesting_user_id: uuid.UUID,
    ) -> SeekerProfile | None:
        """
        Load a seeker profile and verify the requesting user is allowed to see it.
        Returns None if the profile does not exist.
        Raises PermissionError (caught by service) if access is denied.
        """
        profile = await self.get_by_id(profile_id)
        if profile is None:
            return None

        # Owner always has access
        if profile.user_id == requesting_user_id:
            return profile

        # public → any authenticated user
        if profile.privacy == PrivacyLevel.public:
            return profile

        # private → owner only
        if profile.privacy == PrivacyLevel.private:
            raise PermissionError("This profile is private")

        # contacts → must be an accepted mutual contact
        # Get requesting user's seeker profile id
        req_profile_result = await self._db.execute(
            select(SeekerProfile.id).where(
                SeekerProfile.user_id == requesting_user_id
            )
        )
        req_profile_id = req_profile_result.scalar_one_or_none()
        if req_profile_id is None:
            raise PermissionError("Access restricted to contacts")

        contact_exists = await self._db.execute(
            select(Contact.seeker_id).where(
                and_(
                    Contact.status == ContactStatus.accepted,
                    or_(
                        and_(
                            Contact.seeker_id == req_profile_id,
                            Contact.contact_id == profile_id,
                        ),
                        and_(
                            Contact.seeker_id == profile_id,
                            Contact.contact_id == req_profile_id,
                        ),
                    ),
                )
            )
        )
        if contact_exists.scalar_one_or_none() is None:
            raise PermissionError("Access restricted to contacts")

        return profile

    # ── write ─────────────────────────────────────────────────────────────────

    async def create(self, user_id: uuid.UUID) -> SeekerProfile:
        profile = SeekerProfile(user_id=user_id)
        self._db.add(profile)
        await self._db.flush()
        await self._db.refresh(profile)
        return profile

    async def update(self, profile: SeekerProfile, **fields) -> SeekerProfile:
        for key, value in fields.items():
            setattr(profile, key, value)
        await self._db.flush()
        await self._db.refresh(profile)
        return profile
