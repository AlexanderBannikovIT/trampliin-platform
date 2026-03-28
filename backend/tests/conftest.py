"""
Shared pytest fixtures.

Requirements:
  - A running PostgreSQL with PostGIS at TEST_DATABASE_URL
    (default: postgresql+asyncpg://trampliin:changeme@localhost:5432/trampliin_test)
  - The test database must already exist (CREATE DATABASE trampliin_test;)

Schema is created/dropped automatically by the session-scoped `test_engine` fixture.
Each test function gets a fresh transactional session that is rolled back on teardown.
"""

import os
import uuid

import pytest_asyncio
import sqlalchemy as sa
from fakeredis.aioredis import FakeRedis
from httpx import ASGITransport, AsyncClient
from sqlalchemy.ext.asyncio import AsyncSession, create_async_engine

from app.core.database import get_db
from app.core.redis import get_redis
from app.core.security import hash_password
from app.main import app
import app.models  # noqa: F401 — side-effect: registers all ORM classes with Base.metadata
from app.models.base import Base
from app.models.employer_profile import EmployerProfile, VerificationStatus
from app.models.opportunity import (
    Opportunity,
    OpportunityFormat,
    OpportunityStatus,
    OpportunityType,
)
from app.models.seeker_profile import SeekerProfile
from app.models.user import User, UserRole

TEST_DB_URL = os.getenv(
    "TEST_DATABASE_URL",
    "postgresql+asyncpg://trampliin:changeme@localhost:5432/trampliin_test",
)

# ── Engine (session-scoped — tables created once per test run) ────────────────

@pytest_asyncio.fixture(scope="session")
async def test_engine():
    engine = create_async_engine(TEST_DB_URL, echo=False)
    async with engine.begin() as conn:
        await conn.execute(sa.text("CREATE EXTENSION IF NOT EXISTS postgis"))
        await conn.run_sync(Base.metadata.drop_all)
        await conn.run_sync(Base.metadata.create_all)
    yield engine
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.drop_all)
    await engine.dispose()


# ── Per-test transactional session (rolled back after each test) ───────────────

@pytest_asyncio.fixture
async def db(test_engine):
    """
    Each test runs inside a connection-level transaction that is rolled back,
    so no data leaks between tests.
    """
    conn = await test_engine.connect()
    await conn.begin()
    session = AsyncSession(
        bind=conn,
        expire_on_commit=False,
        join_transaction_mode="create_savepoint",
    )
    yield session
    await session.close()
    await conn.rollback()
    await conn.close()


# ── Fake Redis ─────────────────────────────────────────────────────────────────

@pytest_asyncio.fixture
def fake_redis():
    return FakeRedis(decode_responses=True)


# ── HTTP client with overridden dependencies ───────────────────────────────────

@pytest_asyncio.fixture
async def client(db, fake_redis):
    async def _override_db():
        yield db

    async def _override_redis():
        return fake_redis

    app.dependency_overrides[get_db] = _override_db
    app.dependency_overrides[get_redis] = _override_redis

    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as c:
        yield c

    app.dependency_overrides.clear()


# ── User factories ─────────────────────────────────────────────────────────────

async def _make_user(
    db: AsyncSession,
    *,
    email: str,
    role: UserRole,
    display_name: str = "Test User",
    is_active: bool = True,
    password: str = "password123",
) -> User:
    user = User(
        email=email,
        display_name=display_name,
        password_hash=hash_password(password),
        role=role,
        is_active=is_active,
    )
    db.add(user)
    await db.flush()
    await db.refresh(user)
    return user


@pytest_asyncio.fixture
async def seeker_user(db: AsyncSession) -> User:
    user = await _make_user(db, email="seeker@test.com", role=UserRole.seeker, display_name="Seeker User")
    db.add(SeekerProfile(user_id=user.id))
    await db.flush()
    return user


@pytest_asyncio.fixture
async def seeker2_user(db: AsyncSession) -> User:
    user = await _make_user(db, email="seeker2@test.com", role=UserRole.seeker, display_name="Seeker Two")
    db.add(SeekerProfile(user_id=user.id))
    await db.flush()
    return user


@pytest_asyncio.fixture
async def employer_user(db: AsyncSession) -> User:
    user = await _make_user(db, email="employer@company.com", role=UserRole.employer, display_name="Employer User")
    profile = EmployerProfile(
        user_id=user.id,
        company_name="Test Company",
        corporate_email="hr@company.com",
        verification_status=VerificationStatus.verified,
    )
    db.add(profile)
    await db.flush()
    await db.refresh(user)
    return user


@pytest_asyncio.fixture
async def unverified_employer_user(db: AsyncSession) -> User:
    user = await _make_user(db, email="pending@company.com", role=UserRole.employer, display_name="Pending Employer")
    profile = EmployerProfile(
        user_id=user.id,
        company_name="Pending Company",
        corporate_email="hr@pending.com",
        verification_status=VerificationStatus.pending,
    )
    db.add(profile)
    await db.flush()
    return user


@pytest_asyncio.fixture
async def curator_user(db: AsyncSession) -> User:
    return await _make_user(db, email="curator@trampliin.ru", role=UserRole.curator, display_name="Curator")


@pytest_asyncio.fixture
async def admin_user(db: AsyncSession) -> User:
    return await _make_user(db, email="admin@trampliin.ru", role=UserRole.admin, display_name="Admin")


# ── Opportunity factory ────────────────────────────────────────────────────────

@pytest_asyncio.fixture
async def active_opportunity(db: AsyncSession, employer_user: User) -> Opportunity:
    """An active opportunity owned by employer_user."""
    result = await db.execute(
        sa.select(EmployerProfile).where(EmployerProfile.user_id == employer_user.id)
    )
    emp_profile = result.scalar_one()
    opp = Opportunity(
        employer_id=emp_profile.id,
        title="Python Backend Developer",
        type=OpportunityType.vacancy,
        format=OpportunityFormat.remote,
        status=OpportunityStatus.active,
        city="Москва",
    )
    db.add(opp)
    await db.flush()
    await db.refresh(opp)
    return opp


@pytest_asyncio.fixture
async def moderation_opportunity(db: AsyncSession, employer_user: User) -> Opportunity:
    """An opportunity in moderation queue."""
    result = await db.execute(
        sa.select(EmployerProfile).where(EmployerProfile.user_id == employer_user.id)
    )
    emp_profile = result.scalar_one()
    opp = Opportunity(
        employer_id=emp_profile.id,
        title="Frontend Developer",
        type=OpportunityType.internship,
        format=OpportunityFormat.hybrid,
        status=OpportunityStatus.moderation,
        city="Санкт-Петербург",
    )
    db.add(opp)
    await db.flush()
    await db.refresh(opp)
    return opp


# ── Login helpers ──────────────────────────────────────────────────────────────

async def login_as(client: AsyncClient, email: str, password: str = "password123") -> None:
    """Log in and store cookies on the client."""
    resp = await client.post("/api/v1/auth/login", json={"email": email, "password": password})
    assert resp.status_code == 200, resp.text
