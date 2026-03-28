from uuid import UUID

from fastapi import APIRouter, Depends, status
from pydantic import BaseModel
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.database import get_db
from app.core.dependencies import require_role
from app.models.user import User, UserRole
from app.schemas.seeker import ApplicationResponse
from app.services.seeker_service import SeekerService

router = APIRouter(prefix="/applications", tags=["applications"])


class ApplyRequest(BaseModel):
    opportunity_id: UUID


@router.post("", status_code=status.HTTP_201_CREATED, response_model=ApplicationResponse)
async def apply(
    body: ApplyRequest,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_role(UserRole.seeker)),
) -> ApplicationResponse:
    return await SeekerService(db).apply(current_user, body.opportunity_id)


@router.get("/my", response_model=list[ApplicationResponse])
async def my_applications(
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_role(UserRole.seeker)),
) -> list[ApplicationResponse]:
    return await SeekerService(db).get_applications_history(current_user)
