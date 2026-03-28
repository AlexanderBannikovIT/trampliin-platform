import uuid as _uuid

from fastapi import APIRouter, Cookie, Depends, HTTPException, Query, status
from pydantic import BaseModel
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.database import get_db
from app.core.dependencies import get_current_active_user, require_curator
from app.core.security import decode_token as _decode_token
from app.models.tag import Tag
from app.models.user import User, UserRole
from app.repositories.user_repository import UserRepository as _UserRepository
from app.schemas.curator import TagResponse

router = APIRouter(prefix="/tags", tags=["tags"])


class TagSuggestRequest(BaseModel):
    name: str
    category: str | None = None


async def _optional_current_user(
    access_token: str | None = Cookie(default=None),
    db: AsyncSession = Depends(get_db),
) -> User | None:
    """Returns the active User if a valid access cookie is present, else None."""
    if not access_token:
        return None
    payload = _decode_token(access_token)
    if not payload or payload.get("type") != "access":
        return None
    try:
        user_id = _uuid.UUID(payload["sub"])
    except (KeyError, ValueError):
        return None
    user = await _UserRepository(db).get_by_id(user_id)
    if user is None or not user.is_active:
        return None
    return user


@router.get("", response_model=list[TagResponse])
async def list_tags(
    include_inactive: bool = Query(default=False),
    db: AsyncSession = Depends(get_db),
    current_user: User | None = Depends(_optional_current_user),
) -> list[TagResponse]:
    # Only curator/admin may request inactive tags; guests/seekers/employers always see active only
    can_see_inactive = (
        include_inactive
        and current_user is not None
        and current_user.role in (UserRole.curator, UserRole.admin)
    )

    if can_see_inactive:
        result = await db.execute(select(Tag).order_by(Tag.name))
    else:
        result = await db.execute(
            select(Tag).where(Tag.is_active == True).order_by(Tag.name)  # noqa: E712
        )
    tags = list(result.scalars().all())
    return [TagResponse(id=t.id, name=t.name, category=t.category, is_active=t.is_active) for t in tags]


@router.get("/all", response_model=dict)
async def list_all_tags(db: AsyncSession = Depends(get_db)) -> dict:
    """Return all active tags grouped by category, for use in multiselects."""
    result = await db.execute(
        select(Tag).where(Tag.is_active == True).order_by(Tag.category, Tag.name)  # noqa: E712
    )
    tags = list(result.scalars().all())
    items = [{"id": str(t.id), "name": t.name, "category": t.category} for t in tags]
    return {"items": items, "total": len(items)}


class TagAdminCreateRequest(BaseModel):
    name: str
    category: str | None = None


@router.post("/admin", status_code=status.HTTP_201_CREATED, response_model=TagResponse)
async def admin_create_tag(
    body: TagAdminCreateRequest,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_curator),
) -> TagResponse:
    existing = await db.execute(select(Tag).where(Tag.name.ilike(body.name.strip())))
    if existing.scalar_one_or_none() is not None:
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail="Tag already exists")
    tag = Tag(
        name=body.name.strip(),
        category=body.category or None,
        created_by=current_user.id,
        is_active=True,
    )
    db.add(tag)
    await db.commit()
    await db.refresh(tag)
    return TagResponse(id=tag.id, name=tag.name, category=tag.category, is_active=tag.is_active)


@router.post("", status_code=status.HTTP_201_CREATED, response_model=TagResponse)
async def suggest_tag(
    body: TagSuggestRequest,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_active_user),
) -> TagResponse:
    # Check for duplicate name (case-insensitive)
    existing = await db.execute(
        select(Tag).where(Tag.name.ilike(body.name.strip()))
    )
    if existing.scalar_one_or_none() is not None:
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail="Tag already exists")

    tag = Tag(
        name=body.name.strip(),
        category=body.category,
        created_by=current_user.id,
        is_active=False,  # pending curator approval
    )
    db.add(tag)
    await db.flush()
    await db.commit()
    await db.refresh(tag)
    return TagResponse(id=tag.id, name=tag.name, category=tag.category, is_active=tag.is_active)
