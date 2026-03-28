from fastapi import APIRouter, Cookie, Depends, HTTPException, Response, status
from pydantic import BaseModel, EmailStr
from redis.asyncio import Redis
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.config import settings
from app.core.database import get_db
from app.core.dependencies import get_current_active_user
from app.core.redis import get_redis
from app.models.user import User
from app.repositories.user_repository import UserRepository
from app.schemas.auth import (
    LoginRequest,
    MessageResponse,
    RegisterRequest,
    RegisterResponse,
    UserResponse,
)
from app.services.auth_service import AuthService

router = APIRouter(prefix="/auth", tags=["auth"])

# Cookie parameters shared between login and refresh
_COOKIE_OPTS: dict = {
    "httponly": True,
    "samesite": "lax",
    "secure": settings.APP_ENV == "production",
}


def _set_auth_cookies(response: Response, access_token: str, refresh_token: str) -> None:
    response.set_cookie(
        "access_token",
        access_token,
        max_age=settings.ACCESS_TOKEN_EXPIRE_MINUTES * 60,
        **_COOKIE_OPTS,
    )
    response.set_cookie(
        "refresh_token",
        refresh_token,
        max_age=settings.REFRESH_TOKEN_EXPIRE_DAYS * 24 * 3600,
        **_COOKIE_OPTS,
    )


def _clear_auth_cookies(response: Response) -> None:
    response.delete_cookie("access_token", **_COOKIE_OPTS)
    response.delete_cookie("refresh_token", **_COOKIE_OPTS)


# ── Endpoints ─────────────────────────────────────────────────────────────────

@router.post(
    "/register",
    response_model=RegisterResponse,
    status_code=status.HTTP_201_CREATED,
    summary="Register a new seeker or employer account",
)
async def register(
    body: RegisterRequest,
    db: AsyncSession = Depends(get_db),
    redis: Redis = Depends(get_redis),
) -> RegisterResponse:
    svc = AuthService(db, redis)
    user = await svc.register(body)
    return RegisterResponse(
        detail="Registration successful. Check your email to activate your account.",
        user=UserResponse.model_validate(user),
    )


@router.post(
    "/login",
    response_model=MessageResponse,
    summary="Log in and receive httpOnly auth cookies",
)
async def login(
    body: LoginRequest,
    response: Response,
    db: AsyncSession = Depends(get_db),
    redis: Redis = Depends(get_redis),
) -> MessageResponse:
    svc = AuthService(db, redis)
    access_token, refresh_token = await svc.login(body.email, body.password)
    _set_auth_cookies(response, access_token, refresh_token)
    return MessageResponse(detail="Logged in successfully")


@router.post(
    "/logout",
    response_model=MessageResponse,
    summary="Log out and clear auth cookies",
)
async def logout(
    response: Response,
    refresh_token: str | None = Cookie(default=None),
    redis: Redis = Depends(get_redis),
    db: AsyncSession = Depends(get_db),
) -> MessageResponse:
    if refresh_token:
        svc = AuthService(db, redis)
        await svc.logout(refresh_token)
    _clear_auth_cookies(response)
    return MessageResponse(detail="Logged out successfully")


@router.post(
    "/refresh",
    response_model=MessageResponse,
    summary="Rotate tokens using the refresh cookie",
)
async def refresh(
    response: Response,
    refresh_token: str | None = Cookie(default=None),
    db: AsyncSession = Depends(get_db),
    redis: Redis = Depends(get_redis),
) -> MessageResponse:
    if not refresh_token:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="No refresh token provided",
        )
    svc = AuthService(db, redis)
    new_access, new_refresh = await svc.refresh_tokens(refresh_token)
    _set_auth_cookies(response, new_access, new_refresh)
    return MessageResponse(detail="Tokens refreshed")


@router.get(
    "/verify-email/{token}",
    response_model=MessageResponse,
    summary="Activate account via emailed verification link",
)
async def verify_email(
    token: str,
    db: AsyncSession = Depends(get_db),
    redis: Redis = Depends(get_redis),
) -> MessageResponse:
    svc = AuthService(db, redis)
    await svc.verify_email(token)
    return MessageResponse(detail="Email verified. You can now log in.")


@router.get(
    "/me",
    response_model=UserResponse,
    summary="Return the currently authenticated user",
)
async def me(current_user: User = Depends(get_current_active_user)) -> UserResponse:
    return UserResponse.model_validate(current_user)


class DevActivateRequest(BaseModel):
    email: EmailStr


@router.post(
    "/dev/activate",
    response_model=MessageResponse,
    summary="[DEV ONLY] Activate account by email without token",
)
async def dev_activate(
    body: DevActivateRequest,
    db: AsyncSession = Depends(get_db),
) -> MessageResponse:
    if not settings.DEBUG:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Not found")
    repo = UserRepository(db)
    user = await repo.get_by_email(body.email)
    if not user:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="User not found")
    await repo.update(user, is_active=True)
    await db.commit()
    return MessageResponse(detail=f"User {body.email} activated")
