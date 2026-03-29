import uuid as _uuid

from fastapi import APIRouter, Depends, status
from sqlalchemy import delete, select
from sqlalchemy.dialects.postgresql import insert
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.database import get_db
from app.core.dependencies import get_current_active_user
from app.models.favorite import Favorite
from app.models.user import User

router = APIRouter(prefix="/favorites", tags=["favorites"])


@router.get("")
async def list_favorites(
    current_user: User = Depends(get_current_active_user),
    db: AsyncSession = Depends(get_db),
) -> dict:
    result = await db.execute(
        select(Favorite.opportunity_id).where(Favorite.user_id == current_user.id)
    )
    rows = result.scalars().all()
    return {"items": [{"opportunity_id": str(opp_id)} for opp_id in rows]}


@router.post("/{opportunity_id}", status_code=status.HTTP_201_CREATED)
async def add_favorite(
    opportunity_id: _uuid.UUID,
    current_user: User = Depends(get_current_active_user),
    db: AsyncSession = Depends(get_db),
) -> dict:
    stmt = (
        insert(Favorite)
        .values(user_id=current_user.id, opportunity_id=opportunity_id)
        .on_conflict_do_nothing()
    )
    await db.execute(stmt)
    await db.commit()
    return {"status": "ok"}


@router.delete("/{opportunity_id}", status_code=status.HTTP_200_OK)
async def remove_favorite(
    opportunity_id: _uuid.UUID,
    current_user: User = Depends(get_current_active_user),
    db: AsyncSession = Depends(get_db),
) -> dict:
    await db.execute(
        delete(Favorite).where(
            Favorite.user_id == current_user.id,
            Favorite.opportunity_id == opportunity_id,
        )
    )
    await db.commit()
    return {"status": "ok"}
