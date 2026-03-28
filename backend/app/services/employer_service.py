"""
EmployerService — business logic for the employer dashboard.
"""

import logging
import uuid
from io import BytesIO

import boto3
from botocore.exceptions import BotoCoreError, ClientError
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.config import settings
from app.models.application import ApplicationStatus
from app.models.employer_profile import EmployerProfile
from app.models.user import User, UserRole
from app.repositories.employer_repository import EmployerRepository
from app.schemas.employer import (
    ApplicationForEmployer,
    ApplicationStatusUpdate,
    EmployerProfileResponse,
    EmployerProfileUpdate,
    EmployerStats,
    OpportunityWithStats,
    SeekerBriefForEmployer,
)

logger = logging.getLogger(__name__)


def _profile_to_response(profile: EmployerProfile) -> EmployerProfileResponse:
    return EmployerProfileResponse(
        id=profile.id,
        user_id=profile.user_id,
        company_name=profile.company_name,
        inn=profile.inn,
        sphere=profile.sphere,
        description=profile.description,
        website=profile.website,
        corporate_email=profile.corporate_email,
        logo_url=profile.logo_url,
        verification_status=profile.verification_status.value,
        verified_at=profile.verified_at,
        display_name=profile.user.display_name if profile.user else "",
    )


class EmployerService:
    def __init__(self, session: AsyncSession) -> None:
        self._db = session
        self._repo = EmployerRepository(session)

    # ── profile ───────────────────────────────────────────────────────────────

    async def _require_employer_profile(self, user: User) -> EmployerProfile:
        from fastapi import HTTPException, status

        if user.role != UserRole.employer:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN, detail="Employers only"
            )
        profile = await self._repo.get_by_user_id(user.id)
        if profile is None:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND, detail="Employer profile not found"
            )
        return profile

    async def get_my_profile(self, user: User) -> EmployerProfileResponse:
        profile = await self._require_employer_profile(user)
        return _profile_to_response(profile)

    async def update_my_profile(
        self, user: User, data: EmployerProfileUpdate
    ) -> EmployerProfileResponse:
        profile = await self._require_employer_profile(user)
        updates = data.model_dump(exclude_unset=True)
        await self._repo.update(profile, **updates)
        await self._db.commit()
        profile = await self._repo.get_by_user_id(user.id)
        return _profile_to_response(profile)  # type: ignore[arg-type]

    async def upload_logo(self, user: User, file_content: bytes, content_type: str) -> str:
        """Upload logo to MinIO/S3 (with local-storage fallback) and return the public URL."""
        import io
        import os

        profile = await self._require_employer_profile(user)

        ext = "jpg" if content_type == "image/jpeg" else content_type.split("/")[-1]
        key = f"logos/{profile.id}.{ext}"
        logo_url: str | None = None

        # ── try MinIO first ───────────────────────────────────────────────────
        try:
            s3 = boto3.client(
                "s3",
                endpoint_url=settings.S3_ENDPOINT,
                aws_access_key_id=settings.S3_ACCESS_KEY,
                aws_secret_access_key=settings.S3_SECRET_KEY,
            )
            # ensure bucket exists with public-read policy
            try:
                s3.head_bucket(Bucket=settings.S3_BUCKET)
            except ClientError:
                s3.create_bucket(Bucket=settings.S3_BUCKET)
                policy = (
                    '{"Version":"2012-10-17","Statement":[{"Effect":"Allow",'
                    '"Principal":"*","Action":"s3:GetObject",'
                    f'"Resource":"arn:aws:s3:::{settings.S3_BUCKET}/*"}}]}}'
                )
                s3.put_bucket_policy(Bucket=settings.S3_BUCKET, Policy=policy)

            s3.put_object(
                Bucket=settings.S3_BUCKET,
                Key=key,
                Body=io.BytesIO(file_content),
                ContentType=content_type,
            )
            logo_url = f"{settings.S3_ENDPOINT}/{settings.S3_BUCKET}/{key}"
            logger.info("Logo uploaded to S3: %s", logo_url)
        except (BotoCoreError, ClientError, Exception) as exc:
            logger.warning("S3 upload failed, falling back to local storage: %s", exc)

        # ── local fallback ────────────────────────────────────────────────────
        if logo_url is None:
            upload_dir = "/app/uploads/logos"
            os.makedirs(upload_dir, exist_ok=True)
            filename = f"{profile.id}.{ext}"
            with open(f"{upload_dir}/{filename}", "wb") as fh:
                fh.write(file_content)
            logo_url = f"/uploads/logos/{filename}"
            logger.info("Logo saved locally: %s", logo_url)

        await self._repo.update(profile, logo_url=logo_url)
        await self._db.commit()
        return logo_url

    # ── opportunities ─────────────────────────────────────────────────────────

    async def get_my_opportunities(
        self, user: User, status: str | None = None, type_filter: str | None = None
    ) -> list[OpportunityWithStats]:
        profile = await self._require_employer_profile(user)
        rows = await self._repo.get_opportunities(profile.id, status, type_filter)
        return [
            OpportunityWithStats(
                id=opp.id,
                title=opp.title,
                type=opp.type.value,
                format=opp.format.value,
                city=opp.city,
                status=opp.status.value,
                published_at=opp.published_at,
                expires_at=opp.expires_at,
                salary_min=float(opp.salary_min) if opp.salary_min is not None else None,
                salary_max=float(opp.salary_max) if opp.salary_max is not None else None,
                application_count=count,
            )
            for opp, count in rows
        ]

    async def get_stats(self, user: User) -> EmployerStats:
        profile = await self._require_employer_profile(user)
        data = await self._repo.get_stats(profile.id)
        return EmployerStats(**data)

    # ── applications ──────────────────────────────────────────────────────────

    async def get_applications_for_opportunity(
        self, user: User, opportunity_id: uuid.UUID
    ) -> list[ApplicationForEmployer]:
        from fastapi import HTTPException, status

        profile = await self._require_employer_profile(user)
        applications = await self._repo.get_applications(opportunity_id, profile.id)
        if not applications:
            # Could be no apps or no ownership — check ownership separately
            from sqlalchemy import select
            from app.models.opportunity import Opportunity
            res = await self._db.execute(
                select(Opportunity.id).where(
                    Opportunity.id == opportunity_id,
                    Opportunity.employer_id == profile.id,
                )
            )
            if res.scalar_one_or_none() is None:
                raise HTTPException(
                    status_code=status.HTTP_404_NOT_FOUND,
                    detail="Opportunity not found or not yours",
                )

        out = []
        for app in applications:
            seeker_brief = None
            if app.seeker:
                s = app.seeker
                seeker_brief = SeekerBriefForEmployer(
                    id=s.id,
                    user_id=s.user_id,
                    full_name=s.full_name,
                    display_name=s.user.display_name if s.user else "",
                    skills=s.skills or [],
                    university=s.university,
                )
            out.append(
                ApplicationForEmployer(
                    id=app.id,
                    seeker_id=app.seeker_id,
                    opportunity_id=app.opportunity_id,
                    status=app.status.value,
                    applied_at=app.applied_at,
                    seeker=seeker_brief,
                )
            )
        return out

    async def update_application_status(
        self, user: User, app_id: uuid.UUID, data: ApplicationStatusUpdate
    ) -> ApplicationForEmployer:
        from fastapi import HTTPException, status
        from sqlalchemy import select
        from app.models.opportunity import Opportunity

        profile = await self._require_employer_profile(user)

        app = await self._repo.get_application_by_id(app_id)
        if app is None:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Application not found")

        # Verify the application belongs to one of this employer's opportunities
        res = await self._db.execute(
            select(Opportunity.id).where(
                Opportunity.id == app.opportunity_id,
                Opportunity.employer_id == profile.id,
            )
        )
        if res.scalar_one_or_none() is None:
            raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Not your application")

        app.status = ApplicationStatus(data.status)
        await self._db.flush()
        await self._db.commit()
        await self._db.refresh(app)

        return ApplicationForEmployer(
            id=app.id,
            seeker_id=app.seeker_id,
            opportunity_id=app.opportunity_id,
            status=app.status.value,
            applied_at=app.applied_at,
        )
