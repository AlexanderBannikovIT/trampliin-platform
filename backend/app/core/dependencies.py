import uuid
from collections.abc import Callable

from fastapi import Cookie, Depends, HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.database import get_db
from app.core.security import decode_token
from app.models.user import User, UserRole
from app.repositories.user_repository import UserRepository


# ── Token extraction ──────────────────────────────────────────────────────────

async def get_current_user(
    access_token: str | None = Cookie(default=None),
    db: AsyncSession = Depends(get_db),
) -> User:
    credentials_exc = HTTPException(
        status_code=status.HTTP_401_UNAUTHORIZED,
        detail="Not authenticated",
        headers={"WWW-Authenticate": "Bearer"},
    )
    if not access_token:
        raise credentials_exc

    payload = decode_token(access_token)
    if not payload or payload.get("type") != "access":
        raise credentials_exc

    try:
        user_id = uuid.UUID(payload["sub"])
    except (KeyError, ValueError):
        raise credentials_exc

    user = await UserRepository(db).get_by_id(user_id)
    if user is None:
        raise credentials_exc
    return user


async def get_current_active_user(
    user: User = Depends(get_current_user),
) -> User:
    if not user.is_active:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Account is inactive. Please verify your email.",
        )
    return user


# ── Role guard factory ────────────────────────────────────────────────────────

def require_role(*roles: UserRole) -> Callable:
    """
    Usage:
        @router.get("/admin")
        async def admin_only(user=Depends(require_role(UserRole.admin))):
    """
    async def _check(user: User = Depends(get_current_active_user)) -> User:
        if user.role not in roles:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail=f"Required role: {[r.value for r in roles]}",
            )
        return user

    return _check


# ── Convenience aliases ───────────────────────────────────────────────────────

require_seeker = require_role(UserRole.seeker)
require_employer = require_role(UserRole.employer)
require_curator = require_role(UserRole.curator, UserRole.admin)
require_admin = require_role(UserRole.admin)
