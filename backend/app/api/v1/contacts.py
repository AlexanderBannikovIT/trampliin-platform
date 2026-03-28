from uuid import UUID

from fastapi import APIRouter, Depends, status
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.database import get_db
from app.core.dependencies import require_role
from app.models.user import User, UserRole
from app.schemas.seeker import (
    ContactActionRequest,
    ContactResponse,
    RecommendRequest,
    RecommendationResponse,
)
from app.services.seeker_service import SeekerService

router = APIRouter(prefix="/contacts", tags=["contacts"])


def _svc(db: AsyncSession) -> SeekerService:
    return SeekerService(db)


@router.get(
    "",
    response_model=list[ContactResponse],
    summary="List all contacts (pending + accepted)",
)
async def list_contacts(
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_role(UserRole.seeker)),
) -> list[ContactResponse]:
    return await _svc(db).get_my_contacts(current_user)


@router.get(
    "/requests",
    response_model=list[ContactResponse],
    summary="Incoming pending contact requests",
)
async def list_incoming_requests(
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_role(UserRole.seeker)),
) -> list[ContactResponse]:
    return await _svc(db).get_incoming_requests(current_user)


@router.get(
    "/sent",
    response_model=list[ContactResponse],
    summary="Sent pending contact requests",
)
async def list_sent_requests(
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_role(UserRole.seeker)),
) -> list[ContactResponse]:
    return await _svc(db).get_sent_requests(current_user)


@router.get(
    "/accepted",
    response_model=list[ContactResponse],
    summary="Accepted contacts only",
)
async def list_accepted_contacts(
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_role(UserRole.seeker)),
) -> list[ContactResponse]:
    return await _svc(db).get_accepted_contacts(current_user)


@router.get(
    "/recommendations",
    response_model=list[RecommendationResponse],
    summary="Get recommendations received (marks as read)",
)
async def list_recommendations(
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_role(UserRole.seeker)),
) -> list[RecommendationResponse]:
    return await _svc(db).get_my_recommendations(current_user)


@router.get(
    "/badges",
    summary="Get badge counts for contacts section",
)
async def get_badges(
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_role(UserRole.seeker)),
) -> dict:
    svc = _svc(db)
    pending = await svc.count_pending_requests(current_user)
    unread_recs = await svc.count_unread_recommendations(current_user)
    return {"pending_requests": pending, "unread_recommendations": unread_recs}


@router.post(
    "/{seeker_id}",
    response_model=ContactResponse,
    status_code=status.HTTP_201_CREATED,
    summary="Send a contact request to another seeker",
)
async def request_contact(
    seeker_id: UUID,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_role(UserRole.seeker)),
) -> ContactResponse:
    return await _svc(db).add_contact(current_user, seeker_id)


@router.patch(
    "/{seeker_id}",
    response_model=ContactResponse,
    summary="Accept or reject an incoming contact request",
)
async def respond_to_contact(
    seeker_id: UUID,
    body: ContactActionRequest,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_role(UserRole.seeker)),
) -> ContactResponse:
    return await _svc(db).respond_to_contact(current_user, seeker_id, body)


@router.delete(
    "/{seeker_id}",
    status_code=status.HTTP_204_NO_CONTENT,
    summary="Remove a contact or cancel a request",
)
async def remove_contact(
    seeker_id: UUID,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_role(UserRole.seeker)),
) -> None:
    await _svc(db).remove_contact(current_user, seeker_id)


@router.post(
    "/{seeker_id}/recommend",
    response_model=RecommendationResponse,
    status_code=status.HTTP_201_CREATED,
    summary="Recommend an opportunity to a contact",
)
async def send_recommendation(
    seeker_id: UUID,
    body: RecommendRequest,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_role(UserRole.seeker)),
) -> RecommendationResponse:
    return await _svc(db).send_recommendation(current_user, seeker_id, body)
