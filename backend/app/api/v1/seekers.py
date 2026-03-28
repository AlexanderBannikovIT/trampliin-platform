from fastapi import APIRouter, Depends, Query
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.database import get_db
from app.core.dependencies import require_role
from app.models.user import User, UserRole
from app.schemas.seeker import SeekerSearchResult
from app.services.seeker_service import SeekerService

router = APIRouter(prefix="/seekers", tags=["seekers"])


@router.get(
    "/search",
    response_model=list[SeekerSearchResult],
    summary="Search for other seekers by name",
)
async def search_seekers(
    q: str = Query(..., min_length=2, description="Search query"),
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_role(UserRole.seeker)),
) -> list[SeekerSearchResult]:
    return await SeekerService(db).search_seekers(current_user, q)
