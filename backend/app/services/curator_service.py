"""
CuratorService — business logic for curator and admin dashboards.
"""

import uuid

from fastapi import HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.config import settings
from app.core.security import hash_password
from app.models.employer_profile import VerificationStatus
from app.models.opportunity import OpportunityStatus
from app.models.user import User, UserRole
from app.repositories.curator_repository import CuratorRepository
from app.repositories.user_repository import UserRepository
from app.schemas.curator import (
    CreateCuratorRequest,
    CuratorQueue,
    EmployerInQueue,
    ModerateOpportunityRequest,
    ModerateOpportunityResponse,
    OpportunityInQueue,
    TagModerateRequest,
    TagResponse,
    UserListItem,
    UserUpdateRequest,
    VerifyEmployerRequest,
    VerifyEmployerResponse,
)
from app.services import email_service


def _is_suspicious_email(email: str) -> bool:
    domain = email.split("@")[-1].lower() if "@" in email else ""
    return domain in settings.PERSONAL_EMAIL_DOMAINS


class CuratorService:
    def __init__(self, session: AsyncSession) -> None:
        self._db = session
        self._repo = CuratorRepository(session)

    # ── Queue ──────────────────────────────────────────────────────────────────

    async def get_queue(self) -> CuratorQueue:
        employers = await self._repo.get_pending_employers()
        opportunities = await self._repo.get_pending_opportunities()
        pending_tags = await self._repo.get_pending_tags()

        employer_items = []
        for p in employers:
            suspicious = _is_suspicious_email(p.corporate_email or "") or not p.inn
            employer_items.append(
                EmployerInQueue(
                    id=p.id,
                    user_id=p.user_id,
                    company_name=p.company_name,
                    inn=p.inn,
                    sphere=p.sphere,
                    website=p.website,
                    corporate_email=p.corporate_email,
                    logo_url=p.logo_url,
                    verification_status=p.verification_status.value,
                    display_name=p.user.display_name if p.user else "",
                    email=p.user.email if p.user else "",
                    created_at=p.user.created_at if p.user else p.verified_at,
                    is_suspicious=suspicious,
                )
            )

        opp_items = []
        for opp in opportunities:
            opp_items.append(
                OpportunityInQueue(
                    id=opp.id,
                    employer_id=opp.employer_id,
                    company_name=opp.employer.company_name if opp.employer else "",
                    title=opp.title,
                    type=opp.type.value,
                    format=opp.format.value,
                    city=opp.city,
                    salary_min=float(opp.salary_min) if opp.salary_min is not None else None,
                    salary_max=float(opp.salary_max) if opp.salary_max is not None else None,
                    published_at=opp.published_at,
                    expires_at=opp.expires_at,
                    status=opp.status.value,
                    moderation_comment=opp.moderation_comment,
                )
            )

        tag_items = [
            {"id": str(t.id), "name": t.name, "category": t.category}
            for t in pending_tags
        ]

        return CuratorQueue(
            verification=employer_items,
            moderation=opp_items,
            tags=tag_items,
        )

    # ── Employer verification ──────────────────────────────────────────────────

    async def verify_employer(
        self, employer_id: uuid.UUID, data: VerifyEmployerRequest, curator: User
    ) -> VerifyEmployerResponse:
        profile = await self._repo.get_employer_by_id(employer_id)
        if profile is None:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Employer not found")

        if data.status not in ("verified", "rejected"):
            raise HTTPException(status_code=status.HTTP_422_UNPROCESSABLE_ENTITY, detail="Invalid status")

        new_status = VerificationStatus(data.status)
        profile = await self._repo.verify_employer(profile, new_status, curator.id)
        await self._db.commit()

        # Send email notification
        if profile.user:
            await email_service.send_employer_verification_result(
                to=profile.user.email,
                company_name=profile.company_name,
                approved=new_status == VerificationStatus.verified,
                comment=data.comment,
            )

        return VerifyEmployerResponse(
            id=profile.id,
            verification_status=profile.verification_status.value,
            verified_at=profile.verified_at,
        )

    # ── Opportunity moderation ─────────────────────────────────────────────────

    async def moderate_opportunity(
        self, opp_id: uuid.UUID, data: ModerateOpportunityRequest, curator: User
    ) -> ModerateOpportunityResponse:
        opp = await self._repo.get_opportunity_by_id(opp_id)
        if opp is None:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Opportunity not found")

        if data.status not in ("active", "draft"):
            raise HTTPException(status_code=status.HTTP_422_UNPROCESSABLE_ENTITY, detail="Invalid status")

        new_status = OpportunityStatus(data.status)
        comment = data.comment if new_status == OpportunityStatus.draft else None
        opp = await self._repo.moderate_opportunity(opp, new_status, comment)
        await self._db.commit()

        # Notify employer
        if opp.employer and opp.employer.user:
            await email_service.send_opportunity_moderation_result(
                to=opp.employer.user.email,
                opportunity_title=opp.title,
                approved=new_status == OpportunityStatus.active,
                comment=comment,
            )

        return ModerateOpportunityResponse(
            id=opp.id,
            status=opp.status.value,
            moderation_comment=opp.moderation_comment,
        )

    # ── Users management ──────────────────────────────────────────────────────

    async def list_users(
        self, role: str | None = None, is_active: bool | None = None, limit: int = 100, offset: int = 0
    ) -> list[UserListItem]:
        users = await self._repo.get_users(role=role, is_active=is_active, limit=limit, offset=offset)
        return [
            UserListItem(
                id=u.id,
                email=u.email,
                display_name=u.display_name,
                role=u.role.value,
                is_active=u.is_active,
                created_at=u.created_at,
            )
            for u in users
        ]

    async def update_user(
        self, user_id: uuid.UUID, data: UserUpdateRequest, current_user: User
    ) -> UserListItem:
        user = await self._repo.get_user_by_id(user_id)
        if user is None:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="User not found")

        updates: dict = {}
        if data.role is not None:
            try:
                updates["role"] = UserRole(data.role)
            except ValueError:
                raise HTTPException(status_code=status.HTTP_422_UNPROCESSABLE_ENTITY, detail="Invalid role")
        if data.is_active is not None:
            updates["is_active"] = data.is_active

        if updates:
            user = await self._repo.update_user(user, **updates)
            await self._db.commit()

        return UserListItem(
            id=user.id,
            email=user.email,
            display_name=user.display_name,
            role=user.role.value,
            is_active=user.is_active,
            created_at=user.created_at,
        )

    async def list_curators(
        self, is_active: bool | None = None, limit: int = 100, offset: int = 0
    ) -> list[UserListItem]:
        curators = await self._repo.get_users(
            role="curator", is_active=is_active, limit=limit, offset=offset
        )
        admins = await self._repo.get_users(
            role="admin", is_active=is_active, limit=limit, offset=offset
        )
        users = sorted(admins + curators, key=lambda u: u.created_at, reverse=True)
        return [
            UserListItem(
                id=u.id,
                email=u.email,
                display_name=u.display_name,
                role=u.role.value,
                is_active=u.is_active,
                created_at=u.created_at,
            )
            for u in users
        ]

    async def update_curator(
        self, curator_id: uuid.UUID, data: UserUpdateRequest, current_user: User
    ) -> UserListItem:
        user = await self._repo.get_user_by_id(curator_id)
        if user is None:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Curator not found")
        if user.role != UserRole.curator:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST, detail="User is not a curator"
            )

        updates: dict = {}
        if data.role is not None:
            try:
                updates["role"] = UserRole(data.role)
            except ValueError:
                raise HTTPException(
                    status_code=status.HTTP_422_UNPROCESSABLE_ENTITY, detail="Invalid role"
                )
        if data.is_active is not None:
            updates["is_active"] = data.is_active

        if updates:
            user = await self._repo.update_user(user, **updates)
            await self._db.commit()

        return UserListItem(
            id=user.id,
            email=user.email,
            display_name=user.display_name,
            role=user.role.value,
            is_active=user.is_active,
            created_at=user.created_at,
        )

    async def create_curator(
        self, data: CreateCuratorRequest, current_user: User
    ) -> UserListItem:
        if current_user.role != UserRole.admin:
            raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Admin only")

        user_repo = UserRepository(self._db)
        if await user_repo.exists_by_email(data.email):
            raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail="Email already registered")

        new_user = await user_repo.create(
            email=data.email,
            display_name=data.display_name,
            password_hash=hash_password(data.password),
            role=UserRole.curator,
        )
        # Curators are activated immediately (no email verification needed)
        new_user = await user_repo.update(new_user, is_active=True)
        await self._db.commit()

        # Send welcome email (non-blocking)
        try:
            await email_service.send_curator_welcome(
                to=new_user.email,
                display_name=new_user.display_name,
            )
        except Exception:
            pass

        return UserListItem(
            id=new_user.id,
            email=new_user.email,
            display_name=new_user.display_name,
            role=new_user.role.value,
            is_active=new_user.is_active,
            created_at=new_user.created_at,
        )

    # ── Tags management ────────────────────────────────────────────────────────

    async def get_pending_tags(self) -> list[TagResponse]:
        tags = await self._repo.get_pending_tags()
        return [TagResponse(id=t.id, name=t.name, category=t.category, is_active=t.is_active) for t in tags]

    async def restore_tag(self, tag_id: uuid.UUID) -> TagResponse:
        tag = await self._repo.get_tag_by_id(tag_id)
        if tag is None:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Tag not found")
        if tag.is_active:
            raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail="Tag is already active")
        await self._repo.approve_tag(tag)
        await self._db.commit()
        return TagResponse(id=tag.id, name=tag.name, category=tag.category, is_active=tag.is_active)

    async def moderate_tag(self, tag_id: uuid.UUID, data: TagModerateRequest) -> dict:
        tag = await self._repo.get_tag_by_id(tag_id)
        if tag is None:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Tag not found")

        if data.action == "approve":
            await self._repo.approve_tag(tag)
            await self._db.commit()
            return {"id": str(tag.id), "name": tag.name, "action": "approved"}
        elif data.action == "reject":
            await self._repo.delete_tag(tag)
            await self._db.commit()
            return {"id": str(tag_id), "action": "rejected"}
        else:
            raise HTTPException(status_code=status.HTTP_422_UNPROCESSABLE_ENTITY, detail="Invalid action")
