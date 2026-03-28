"""Tests for /api/v1/auth/* endpoints."""

import pytest
from httpx import AsyncClient
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.redis import get_redis
from app.models.user import User, UserRole
from tests.conftest import _make_user


# ── Registration ───────────────────────────────────────────────────────────────

async def test_register_seeker(client: AsyncClient):
    resp = await client.post("/api/v1/auth/register", json={
        "email": "new_seeker@test.com",
        "display_name": "New Seeker",
        "password": "secret123",
        "role": "seeker",
    })
    assert resp.status_code == 201
    body = resp.json()
    assert body["user"]["email"] == "new_seeker@test.com"
    assert body["user"]["role"] == "seeker"


async def test_register_employer(client: AsyncClient):
    resp = await client.post("/api/v1/auth/register", json={
        "email": "cto@startup.io",
        "display_name": "CTO",
        "password": "secret123",
        "role": "employer",
        "company_name": "Startup IO",
        "corporate_email": "hr@startup.io",
    })
    assert resp.status_code == 201


async def test_register_duplicate_email(client: AsyncClient, seeker_user: User):
    resp = await client.post("/api/v1/auth/register", json={
        "email": "seeker@test.com",  # same as seeker_user fixture
        "display_name": "Dup",
        "password": "secret123",
        "role": "seeker",
    })
    assert resp.status_code == 409


async def test_register_employer_personal_email(client: AsyncClient):
    resp = await client.post("/api/v1/auth/register", json={
        "email": "boss@gmail.com",
        "display_name": "Boss",
        "password": "secret123",
        "role": "employer",
        "company_name": "My Company",
        "corporate_email": "boss@gmail.com",  # personal domain
    })
    assert resp.status_code == 422


# ── Login ──────────────────────────────────────────────────────────────────────

async def test_login_unverified(client: AsyncClient, db: AsyncSession):
    """Inactive user cannot log in."""
    await _make_user(db, email="inactive@test.com", role=UserRole.seeker, is_active=False)
    resp = await client.post("/api/v1/auth/login", json={
        "email": "inactive@test.com",
        "password": "password123",
    })
    assert resp.status_code == 403


async def test_login_wrong_password(client: AsyncClient, seeker_user: User):
    resp = await client.post("/api/v1/auth/login", json={
        "email": "seeker@test.com",
        "password": "wrongpassword",
    })
    assert resp.status_code == 401


async def test_login_success(client: AsyncClient, seeker_user: User):
    resp = await client.post("/api/v1/auth/login", json={
        "email": "seeker@test.com",
        "password": "password123",
    })
    assert resp.status_code == 200
    # Cookies are set
    assert "access_token" in resp.cookies
    assert "refresh_token" in resp.cookies


# ── Email verification ────────────────────────────────────────────────────────

async def test_verify_email_invalid_token(client: AsyncClient):
    resp = await client.get("/api/v1/auth/verify-email/not-a-real-token")
    assert resp.status_code == 400


async def test_verify_email_success(client: AsyncClient, fake_redis, db: AsyncSession):
    """
    Register a new user (which stores a verify token in fake_redis),
    then verify with that token.
    """
    resp = await client.post("/api/v1/auth/register", json={
        "email": "toverify@test.com",
        "display_name": "To Verify",
        "password": "secret123",
        "role": "seeker",
    })
    assert resp.status_code == 201

    # Find the verify token stored in fake_redis
    keys = await fake_redis.keys("email_verify:*")
    assert keys, "No verification token found in fake_redis"
    token = keys[0].split("email_verify:")[-1]

    verify_resp = await client.get(f"/api/v1/auth/verify-email/{token}")
    assert verify_resp.status_code == 200

    # Should now be able to log in
    login_resp = await client.post("/api/v1/auth/login", json={
        "email": "toverify@test.com",
        "password": "secret123",
    })
    assert login_resp.status_code == 200


# ── Refresh & logout ───────────────────────────────────────────────────────────

async def test_refresh_tokens(client: AsyncClient, seeker_user: User):
    await client.post("/api/v1/auth/login", json={"email": "seeker@test.com", "password": "password123"})
    resp = await client.post("/api/v1/auth/refresh")
    assert resp.status_code == 200
    assert "access_token" in resp.cookies


async def test_logout(client: AsyncClient, seeker_user: User):
    await client.post("/api/v1/auth/login", json={"email": "seeker@test.com", "password": "password123"})
    resp = await client.post("/api/v1/auth/logout")
    assert resp.status_code == 200
    # Cookies cleared
    assert resp.cookies.get("access_token", "") == ""


# ── /me ────────────────────────────────────────────────────────────────────────

async def test_me_unauthenticated(client: AsyncClient):
    resp = await client.get("/api/v1/auth/me")
    assert resp.status_code == 401


async def test_me_authenticated(client: AsyncClient, seeker_user: User):
    await client.post("/api/v1/auth/login", json={"email": "seeker@test.com", "password": "password123"})
    resp = await client.get("/api/v1/auth/me")
    assert resp.status_code == 200
    assert resp.json()["email"] == "seeker@test.com"
    assert resp.json()["role"] == "seeker"
