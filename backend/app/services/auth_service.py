"""
Auth service — orchestrates registration, login, token rotation, and logout.

Redis key layout
────────────────
  refresh:{user_id}          → SHA-256(refresh_token)   TTL = REFRESH_TOKEN_EXPIRE_DAYS
  email_verify:{token_uuid}  → str(user_id)              TTL = 86400 s (24 h)
"""

import logging
import uuid
from datetime import timedelta

from redis.asyncio import Redis
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.config import settings
from app.services.email_service import send_verification_email as _email_send_verification
from app.core.security import (
    create_access_token,
    create_refresh_token,
    hash_password,
    hash_refresh_token,
    verify_password,
    decode_token,
)
from app.models.employer_profile import EmployerProfile
from app.models.seeker_profile import SeekerProfile
from app.models.user import User, UserRole
from app.repositories.user_repository import UserRepository
from app.schemas.auth import RegisterRequest

logger = logging.getLogger(__name__)

_REFRESH_TTL_SECONDS = settings.REFRESH_TOKEN_EXPIRE_DAYS * 24 * 3600
_VERIFY_TTL_SECONDS = 24 * 3600


# ── helpers ───────────────────────────────────────────────────────────────────

def _redis_refresh_key(user_id: uuid.UUID) -> str:
    return f"refresh:{user_id}"


def _redis_verify_key(token: str) -> str:
    return f"email_verify:{token}"



# ── public API ────────────────────────────────────────────────────────────────

class AuthService:
    def __init__(self, session: AsyncSession, redis: Redis) -> None:
        self._session = session
        self._redis = redis
        self._users = UserRepository(session)

    async def register(self, data: RegisterRequest) -> User:
        # Duplicate email check
        if await self._users.exists_by_email(data.email):
            from fastapi import HTTPException, status
            raise HTTPException(
                status_code=status.HTTP_409_CONFLICT,
                detail="Email already registered",
            )

        role = UserRole(data.role)
        user = await self._users.create(
            email=data.email,
            display_name=data.display_name,
            password_hash=hash_password(data.password),
            role=role,
        )

        # Create profile skeleton
        if role == UserRole.seeker:
            self._session.add(SeekerProfile(user_id=user.id))
        elif role == UserRole.employer:
            self._session.add(
                EmployerProfile(
                    user_id=user.id,
                    company_name=data.company_name or "",
                    inn=data.inn,
                    corporate_email=str(data.corporate_email) if data.corporate_email else None,
                )
            )

        # Activate immediately — no email gate
        await self._users.update(user, is_active=True)
        await self._session.commit()
        await self._session.refresh(user)

        # Send verification email as a courtesy (fire-and-forget, won't block)
        verify_token = str(uuid.uuid4())
        await self._redis.setex(
            _redis_verify_key(verify_token),
            _VERIFY_TTL_SECONDS,
            str(user.id),
        )
        await _email_send_verification(user.email, verify_token)

        return user

    async def login(self, email: str, password: str) -> tuple[str, str]:
        from fastapi import HTTPException, status

        user = await self._users.get_by_email(email)
        if not user or not verify_password(password, user.password_hash):
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="Invalid credentials",
            )

        sub = str(user.id)
        access_token = create_access_token({"sub": sub})
        refresh_token = create_refresh_token({"sub": sub})

        await self._redis.setex(
            _redis_refresh_key(user.id),
            _REFRESH_TTL_SECONDS,
            hash_refresh_token(refresh_token),
        )

        return access_token, refresh_token

    async def verify_email(self, token: str) -> bool:
        from fastapi import HTTPException, status

        key = _redis_verify_key(token)
        user_id_str: str | None = await self._redis.get(key)
        if not user_id_str:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Verification link is invalid or has expired",
            )

        user = await self._users.get_by_id(uuid.UUID(user_id_str))
        if not user:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="User not found")

        await self._users.update(user, is_active=True)
        await self._session.commit()
        await self._redis.delete(key)
        return True

    async def refresh_tokens(self, refresh_token: str) -> tuple[str, str]:
        from fastapi import HTTPException, status

        payload = decode_token(refresh_token)
        if not payload or payload.get("type") != "refresh":
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="Invalid refresh token",
            )

        user_id = uuid.UUID(payload["sub"])
        stored_hash: str | None = await self._redis.get(_redis_refresh_key(user_id))
        if not stored_hash or stored_hash != hash_refresh_token(refresh_token):
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="Refresh token revoked or expired",
            )

        # Rotate: invalidate old, issue new
        sub = str(user_id)
        new_access = create_access_token({"sub": sub})
        new_refresh = create_refresh_token({"sub": sub})

        await self._redis.setex(
            _redis_refresh_key(user_id),
            _REFRESH_TTL_SECONDS,
            hash_refresh_token(new_refresh),
        )

        return new_access, new_refresh

    async def logout(self, refresh_token: str) -> None:
        payload = decode_token(refresh_token)
        if payload and payload.get("type") == "refresh":
            user_id = uuid.UUID(payload["sub"])
            await self._redis.delete(_redis_refresh_key(user_id))
