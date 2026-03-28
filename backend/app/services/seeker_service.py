import uuid

from sqlalchemy import and_, or_, select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.models.application import Application
from app.models.contact import Contact, ContactStatus
from app.models.opportunity import Opportunity
from app.models.seeker_profile import SeekerProfile
from app.models.user import User, UserRole
from app.repositories.seeker_repository import SeekerRepository
from app.schemas.seeker import (
    ApplicationResponse,
    ContactActionRequest,
    ContactResponse,
    OpportunityBrief,
    RecommendRequest,
    RecommendationResponse,
    SeekerBrief,
    SeekerProfileResponse,
    SeekerProfileUpdate,
    SeekerSearchResult,
)


def _profile_to_response(profile: SeekerProfile) -> SeekerProfileResponse:
    return SeekerProfileResponse(
        id=profile.id,
        user_id=profile.user_id,
        full_name=profile.full_name,
        university=profile.university,
        graduation_year=profile.graduation_year,
        bio=profile.bio,
        skills=profile.skills or [],
        links=profile.links or {},
        privacy=profile.privacy.value,
        display_name=profile.user.display_name if profile.user else "",
    )


class SeekerService:
    def __init__(self, session: AsyncSession) -> None:
        self._db = session
        self._repo = SeekerRepository(session)

    # ── profile ───────────────────────────────────────────────────────────────

    async def get_my_profile(self, user: User) -> SeekerProfileResponse:
        from fastapi import HTTPException, status

        profile = await self._repo.get_by_user_id(user.id)
        if profile is None:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND, detail="Seeker profile not found"
            )
        return _profile_to_response(profile)

    async def update_my_profile(
        self, user: User, data: SeekerProfileUpdate
    ) -> SeekerProfileResponse:
        from fastapi import HTTPException, status

        profile = await self._repo.get_by_user_id(user.id)
        if profile is None:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND, detail="Seeker profile not found"
            )

        updates = data.model_dump(exclude_unset=True)
        await self._repo.update(profile, **updates)
        await self._db.commit()
        # reload user relationship
        profile = await self._repo.get_by_user_id(user.id)
        return _profile_to_response(profile)  # type: ignore[arg-type]

    async def _employer_has_application_from_seeker(
        self, employer_user_id: uuid.UUID, seeker_profile_id: uuid.UUID
    ) -> bool:
        """Returns True if the employer has received at least one application from this seeker."""
        from app.models.employer_profile import EmployerProfile

        result = await self._db.execute(
            select(Application.id)
            .join(Opportunity, Application.opportunity_id == Opportunity.id)
            .join(EmployerProfile, Opportunity.employer_id == EmployerProfile.id)
            .where(
                EmployerProfile.user_id == employer_user_id,
                Application.seeker_id == seeker_profile_id,
            )
            .limit(1)
        )
        return result.scalar_one_or_none() is not None

    async def get_public_profile(
        self, profile_id: uuid.UUID, requesting_user: User
    ) -> SeekerProfileResponse:
        from fastapi import HTTPException, status
        from app.models.seeker_profile import PrivacyLevel

        # Load the profile first (no privacy check yet)
        profile = await self._repo.get_by_id(profile_id)
        if profile is None:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Profile not found")

        # Owner always has full access
        if profile.user_id == requesting_user.id:
            return _profile_to_response(profile)

        # If the requester is an employer, check if they have received an application
        # from this seeker — if so, grant access regardless of privacy setting
        if requesting_user.role == UserRole.employer:
            has_application = await self._employer_has_application_from_seeker(
                requesting_user.id, profile.id
            )
            if has_application:
                return _profile_to_response(profile)

        # Apply normal privacy rules
        if profile.privacy == PrivacyLevel.public:
            return _profile_to_response(profile)

        if profile.privacy == PrivacyLevel.private:
            raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="This profile is private")

        # privacy == contacts: check accepted contact relationship
        try:
            checked = await self._repo.get_with_privacy_check(profile_id, requesting_user.id)
        except PermissionError as e:
            raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail=str(e))

        if checked is None:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Profile not found")

        return _profile_to_response(checked)

    # ── applications ──────────────────────────────────────────────────────────

    async def apply(self, user: User, opportunity_id: uuid.UUID) -> ApplicationResponse:
        from fastapi import HTTPException, status as http_status
        from app.models.opportunity import Opportunity, OpportunityStatus

        profile = await self._repo.get_by_user_id(user.id)
        if profile is None:
            raise HTTPException(status_code=http_status.HTTP_404_NOT_FOUND, detail="Seeker profile not found")

        opp = await self._db.get(Opportunity, opportunity_id)
        if opp is None or opp.status != OpportunityStatus.active:
            raise HTTPException(status_code=http_status.HTTP_404_NOT_FOUND, detail="Opportunity not found or not active")

        existing = await self._db.execute(
            select(Application).where(
                Application.seeker_id == profile.id,
                Application.opportunity_id == opportunity_id,
            )
        )
        if existing.scalar_one_or_none() is not None:
            raise HTTPException(status_code=http_status.HTTP_409_CONFLICT, detail="Already applied to this opportunity")

        app = Application(seeker_id=profile.id, opportunity_id=opportunity_id)
        self._db.add(app)
        await self._db.flush()
        await self._db.commit()
        await self._db.refresh(app)

        return ApplicationResponse(
            id=app.id,
            opportunity_id=app.opportunity_id,
            status=app.status.value,
            applied_at=app.applied_at,
        )

    async def get_applications_history(self, user: User) -> list[ApplicationResponse]:
        from fastapi import HTTPException, status

        profile = await self._repo.get_by_user_id(user.id)
        if profile is None:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND, detail="Seeker profile not found"
            )

        result = await self._db.execute(
            select(Application)
            .where(Application.seeker_id == profile.id)
            .options(
                selectinload(Application.opportunity).selectinload(Opportunity.employer)
            )
            .order_by(Application.applied_at.desc())
        )
        applications = list(result.scalars().all())

        out = []
        for app in applications:
            opp = app.opportunity
            opp_brief = None
            if opp:
                opp_brief = OpportunityBrief(
                    id=opp.id,
                    title=opp.title,
                    type=opp.type.value,
                    format=opp.format.value,
                    city=opp.city,
                    employer_name=opp.employer.company_name if opp.employer else None,
                )
            out.append(
                ApplicationResponse(
                    id=app.id,
                    opportunity_id=app.opportunity_id,
                    status=app.status.value,
                    applied_at=app.applied_at,
                    opportunity=opp_brief,
                )
            )
        return out

    # ── contacts ──────────────────────────────────────────────────────────────

    async def _require_seeker_profile(self, user: User) -> SeekerProfile:
        from fastapi import HTTPException, status

        if user.role != UserRole.seeker:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN, detail="Only seekers have contacts"
            )
        profile = await self._repo.get_by_user_id(user.id)
        if profile is None:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND, detail="Seeker profile not found"
            )
        return profile

    async def add_contact(
        self, requesting_user: User, target_seeker_id: uuid.UUID
    ) -> ContactResponse:
        from fastapi import HTTPException, status

        my_profile = await self._require_seeker_profile(requesting_user)

        if my_profile.id == target_seeker_id:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST, detail="Cannot add yourself as contact"
            )

        # Check target exists
        target = await self._repo.get_by_id(target_seeker_id)
        if target is None:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Seeker not found")

        # Already exists?
        existing = await self._db.execute(
            select(Contact).where(
                or_(
                    and_(Contact.seeker_id == my_profile.id, Contact.contact_id == target_seeker_id),
                    and_(Contact.seeker_id == target_seeker_id, Contact.contact_id == my_profile.id),
                )
            )
        )
        if existing.scalar_one_or_none() is not None:
            raise HTTPException(
                status_code=status.HTTP_409_CONFLICT, detail="Contact request already exists"
            )

        contact = Contact(seeker_id=my_profile.id, contact_id=target_seeker_id)
        self._db.add(contact)
        await self._db.commit()
        await self._db.refresh(contact)

        return ContactResponse(
            seeker_id=contact.seeker_id,
            contact_id=contact.contact_id,
            status=contact.status.value,
            created_at=contact.created_at,
            profile=SeekerBrief(
                id=target.id,
                user_id=target.user_id,
                full_name=target.full_name,
                display_name=target.user.display_name if target.user else "",
            ),
        )

    async def respond_to_contact(
        self,
        responding_user: User,
        requester_seeker_id: uuid.UUID,
        action: ContactActionRequest,
    ) -> ContactResponse:
        from fastapi import HTTPException, status

        my_profile = await self._require_seeker_profile(responding_user)

        # The contact record was created with seeker_id=requester, contact_id=me
        result = await self._db.execute(
            select(Contact).where(
                and_(
                    Contact.seeker_id == requester_seeker_id,
                    Contact.contact_id == my_profile.id,
                    Contact.status == ContactStatus.pending,
                )
            )
        )
        contact = result.scalar_one_or_none()
        if contact is None:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Pending contact request not found",
            )

        if action.accept:
            contact.status = ContactStatus.accepted
            await self._db.commit()
            await self._db.refresh(contact)
        else:
            await self._db.delete(contact)
            await self._db.commit()
            return ContactResponse(
                seeker_id=requester_seeker_id,
                contact_id=my_profile.id,
                status="rejected",
                created_at=contact.created_at,
            )

        requester = await self._repo.get_by_id(requester_seeker_id)
        return ContactResponse(
            seeker_id=contact.seeker_id,
            contact_id=contact.contact_id,
            status=contact.status.value,
            created_at=contact.created_at,
            profile=SeekerBrief(
                id=requester.id,  # type: ignore[union-attr]
                user_id=requester.user_id,  # type: ignore[union-attr]
                full_name=requester.full_name,  # type: ignore[union-attr]
                display_name=requester.user.display_name if requester and requester.user else "",
            ),
        )

    async def get_my_contacts(self, user: User) -> list[ContactResponse]:
        my_profile = await self._require_seeker_profile(user)

        # Contacts where I'm either side
        result = await self._db.execute(
            select(Contact)
            .where(
                or_(
                    Contact.seeker_id == my_profile.id,
                    Contact.contact_id == my_profile.id,
                )
            )
            .options(
                selectinload(Contact.seeker).selectinload(SeekerProfile.user),
                selectinload(Contact.contact_seeker).selectinload(SeekerProfile.user),
            )
            .order_by(Contact.created_at.desc())
        )
        contacts = list(result.scalars().all())

        out = []
        for c in contacts:
            # The "other" person from my perspective
            if c.seeker_id == my_profile.id:
                other = c.contact_seeker
            else:
                other = c.seeker

            profile_brief = None
            if other:
                profile_brief = SeekerBrief(
                    id=other.id,
                    user_id=other.user_id,
                    full_name=other.full_name,
                    display_name=other.user.display_name if other.user else "",
                    university=other.university,
                    skills=other.skills or [],
                )
            out.append(
                ContactResponse(
                    seeker_id=c.seeker_id,
                    contact_id=c.contact_id,
                    status=c.status.value,
                    created_at=c.created_at,
                    profile=profile_brief,
                )
            )
        return out

    async def get_incoming_requests(self, user: User) -> list[ContactResponse]:
        my_profile = await self._require_seeker_profile(user)

        result = await self._db.execute(
            select(Contact)
            .where(
                Contact.contact_id == my_profile.id,
                Contact.status == ContactStatus.pending,
            )
            .options(
                selectinload(Contact.seeker).selectinload(SeekerProfile.user),
            )
            .order_by(Contact.created_at.desc())
        )
        contacts = list(result.scalars().all())

        out = []
        for c in contacts:
            other = c.seeker
            profile_brief = None
            if other:
                profile_brief = SeekerBrief(
                    id=other.id,
                    user_id=other.user_id,
                    full_name=other.full_name,
                    display_name=other.user.display_name if other.user else "",
                    university=other.university,
                    skills=other.skills or [],
                )
            out.append(ContactResponse(
                seeker_id=c.seeker_id,
                contact_id=c.contact_id,
                status=c.status.value,
                created_at=c.created_at,
                profile=profile_brief,
            ))
        return out

    async def get_sent_requests(self, user: User) -> list[ContactResponse]:
        my_profile = await self._require_seeker_profile(user)

        result = await self._db.execute(
            select(Contact)
            .where(
                Contact.seeker_id == my_profile.id,
                Contact.status == ContactStatus.pending,
            )
            .options(
                selectinload(Contact.contact_seeker).selectinload(SeekerProfile.user),
            )
            .order_by(Contact.created_at.desc())
        )
        contacts = list(result.scalars().all())

        out = []
        for c in contacts:
            other = c.contact_seeker
            profile_brief = None
            if other:
                profile_brief = SeekerBrief(
                    id=other.id,
                    user_id=other.user_id,
                    full_name=other.full_name,
                    display_name=other.user.display_name if other.user else "",
                    university=other.university,
                    skills=other.skills or [],
                )
            out.append(ContactResponse(
                seeker_id=c.seeker_id,
                contact_id=c.contact_id,
                status=c.status.value,
                created_at=c.created_at,
                profile=profile_brief,
            ))
        return out

    async def get_accepted_contacts(self, user: User) -> list[ContactResponse]:
        my_profile = await self._require_seeker_profile(user)

        result = await self._db.execute(
            select(Contact)
            .where(
                or_(
                    Contact.seeker_id == my_profile.id,
                    Contact.contact_id == my_profile.id,
                ),
                Contact.status == ContactStatus.accepted,
            )
            .options(
                selectinload(Contact.seeker).selectinload(SeekerProfile.user),
                selectinload(Contact.contact_seeker).selectinload(SeekerProfile.user),
            )
            .order_by(Contact.created_at.desc())
        )
        contacts = list(result.scalars().all())

        out = []
        for c in contacts:
            other = c.contact_seeker if c.seeker_id == my_profile.id else c.seeker
            profile_brief = None
            if other:
                profile_brief = SeekerBrief(
                    id=other.id,
                    user_id=other.user_id,
                    full_name=other.full_name,
                    display_name=other.user.display_name if other.user else "",
                    university=other.university,
                    skills=other.skills or [],
                )
            out.append(ContactResponse(
                seeker_id=c.seeker_id,
                contact_id=c.contact_id,
                status=c.status.value,
                created_at=c.created_at,
                profile=profile_brief,
            ))
        return out

    async def remove_contact(self, user: User, other_seeker_id: uuid.UUID) -> None:
        from fastapi import HTTPException, status

        my_profile = await self._require_seeker_profile(user)

        result = await self._db.execute(
            select(Contact).where(
                or_(
                    and_(Contact.seeker_id == my_profile.id, Contact.contact_id == other_seeker_id),
                    and_(Contact.seeker_id == other_seeker_id, Contact.contact_id == my_profile.id),
                )
            )
        )
        contact = result.scalar_one_or_none()
        if contact is None:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Contact not found")
        await self._db.delete(contact)
        await self._db.commit()

    async def search_seekers(
        self, user: User, q: str
    ) -> list[SeekerSearchResult]:
        my_profile = await self._require_seeker_profile(user)

        q_lower = f"%{q.lower()}%"
        result = await self._db.execute(
            select(SeekerProfile)
            .join(User, SeekerProfile.user_id == User.id)
            .where(
                SeekerProfile.id != my_profile.id,
                or_(
                    SeekerProfile.full_name.ilike(q_lower),
                    User.display_name.ilike(q_lower),
                ),
            )
            .options(selectinload(SeekerProfile.user))
            .limit(20)
        )
        profiles = list(result.scalars().all())

        # Get my existing contacts to mark them
        existing_result = await self._db.execute(
            select(Contact).where(
                or_(
                    Contact.seeker_id == my_profile.id,
                    Contact.contact_id == my_profile.id,
                )
            )
        )
        existing = list(existing_result.scalars().all())
        contact_ids: set[uuid.UUID] = set()
        sent_ids: set[uuid.UUID] = set()
        for c in existing:
            if c.status == ContactStatus.accepted:
                other_id = c.contact_id if c.seeker_id == my_profile.id else c.seeker_id
                contact_ids.add(other_id)
            elif c.status == ContactStatus.pending and c.seeker_id == my_profile.id:
                sent_ids.add(c.contact_id)

        out = []
        for p in profiles:
            out.append(SeekerSearchResult(
                id=p.id,
                user_id=p.user_id,
                full_name=p.full_name,
                display_name=p.user.display_name if p.user else "",
                university=p.university,
                skills=p.skills or [],
                is_contact=p.id in contact_ids,
                request_sent=p.id in sent_ids,
            ))
        return out

    async def send_recommendation(
        self, user: User, to_seeker_id: uuid.UUID, data: RecommendRequest
    ) -> RecommendationResponse:
        from fastapi import HTTPException, status
        from app.models.recommendation import Recommendation

        my_profile = await self._require_seeker_profile(user)

        # Must be an accepted contact
        result = await self._db.execute(
            select(Contact).where(
                or_(
                    and_(Contact.seeker_id == my_profile.id, Contact.contact_id == to_seeker_id),
                    and_(Contact.seeker_id == to_seeker_id, Contact.contact_id == my_profile.id),
                ),
                Contact.status == ContactStatus.accepted,
            )
        )
        if result.scalar_one_or_none() is None:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Can only recommend to accepted contacts",
            )

        opp = await self._db.get(Opportunity, data.opportunity_id)
        if opp is None:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Opportunity not found")

        rec = Recommendation(
            from_seeker_id=my_profile.id,
            to_seeker_id=to_seeker_id,
            opportunity_id=data.opportunity_id,
            message=data.message,
        )
        self._db.add(rec)
        await self._db.commit()
        await self._db.refresh(rec)

        return RecommendationResponse(
            id=rec.id,
            from_seeker_id=rec.from_seeker_id,
            to_seeker_id=rec.to_seeker_id,
            opportunity_id=rec.opportunity_id,
            message=rec.message,
            is_read=rec.is_read,
            created_at=rec.created_at,
            opportunity_title=opp.title,
        )

    async def get_my_recommendations(self, user: User) -> list[RecommendationResponse]:
        from app.models.recommendation import Recommendation

        my_profile = await self._require_seeker_profile(user)

        result = await self._db.execute(
            select(Recommendation)
            .where(Recommendation.to_seeker_id == my_profile.id)
            .options(
                selectinload(Recommendation.from_seeker).selectinload(SeekerProfile.user),
                selectinload(Recommendation.opportunity),
            )
            .order_by(Recommendation.created_at.desc())
        )
        recs = list(result.scalars().all())

        # Mark as read
        for r in recs:
            if not r.is_read:
                r.is_read = True
        await self._db.commit()

        out = []
        for r in recs:
            from_brief = None
            if r.from_seeker:
                s = r.from_seeker
                from_brief = SeekerBrief(
                    id=s.id,
                    user_id=s.user_id,
                    full_name=s.full_name,
                    display_name=s.user.display_name if s.user else "",
                    university=s.university,
                    skills=s.skills or [],
                )
            out.append(RecommendationResponse(
                id=r.id,
                from_seeker_id=r.from_seeker_id,
                to_seeker_id=r.to_seeker_id,
                opportunity_id=r.opportunity_id,
                message=r.message,
                is_read=r.is_read,
                created_at=r.created_at,
                from_seeker=from_brief,
                opportunity_title=r.opportunity.title if r.opportunity else None,
            ))
        return out

    async def count_unread_recommendations(self, user: User) -> int:
        from app.models.recommendation import Recommendation

        my_profile = await self._require_seeker_profile(user)
        result = await self._db.execute(
            select(Recommendation)
            .where(
                Recommendation.to_seeker_id == my_profile.id,
                Recommendation.is_read.is_(False),
            )
        )
        return len(list(result.scalars().all()))

    async def count_pending_requests(self, user: User) -> int:
        my_profile = await self._require_seeker_profile(user)
        result = await self._db.execute(
            select(Contact).where(
                Contact.contact_id == my_profile.id,
                Contact.status == ContactStatus.pending,
            )
        )
        return len(list(result.scalars().all()))
