"""Tests for /api/v1/curator/* endpoints."""

import pytest
from httpx import AsyncClient
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.employer_profile import EmployerProfile, VerificationStatus
from app.models.opportunity import Opportunity
from app.models.tag import Tag
from app.models.user import User


# ── Access control ─────────────────────────────────────────────────────────────

async def test_queue_requires_auth(client: AsyncClient):
    resp = await client.get("/api/v1/curator/queue")
    assert resp.status_code == 401


async def test_queue_seeker_forbidden(client: AsyncClient, seeker_user: User):
    await client.post("/api/v1/auth/login", json={"email": "seeker@test.com", "password": "password123"})
    resp = await client.get("/api/v1/curator/queue")
    assert resp.status_code == 403


async def test_queue_employer_forbidden(client: AsyncClient, employer_user: User):
    await client.post("/api/v1/auth/login", json={"email": "employer@company.com", "password": "password123"})
    resp = await client.get("/api/v1/curator/queue")
    assert resp.status_code == 403


# ── Queue contents ─────────────────────────────────────────────────────────────

async def test_queue_returns_structure(client: AsyncClient, curator_user: User):
    await client.post("/api/v1/auth/login", json={"email": "curator@trampliin.ru", "password": "password123"})
    resp = await client.get("/api/v1/curator/queue")
    assert resp.status_code == 200
    body = resp.json()
    assert "verification" in body
    assert "moderation" in body
    assert "tags" in body


async def test_queue_contains_pending_employer(
    client: AsyncClient,
    curator_user: User,
    unverified_employer_user: User,
):
    await client.post("/api/v1/auth/login", json={"email": "curator@trampliin.ru", "password": "password123"})
    resp = await client.get("/api/v1/curator/queue")
    assert resp.status_code == 200
    ver_ids = [e["user_id"] for e in resp.json()["verification"]]
    assert str(unverified_employer_user.id) in ver_ids


async def test_queue_contains_moderation_opportunity(
    client: AsyncClient,
    curator_user: User,
    moderation_opportunity: Opportunity,
):
    await client.post("/api/v1/auth/login", json={"email": "curator@trampliin.ru", "password": "password123"})
    resp = await client.get("/api/v1/curator/queue")
    assert resp.status_code == 200
    mod_ids = [o["id"] for o in resp.json()["moderation"]]
    assert str(moderation_opportunity.id) in mod_ids


# ── Employer verification ──────────────────────────────────────────────────────

async def test_verify_employer_approve(
    client: AsyncClient,
    curator_user: User,
    unverified_employer_user: User,
    db: AsyncSession,
):
    import sqlalchemy as sa

    await client.post("/api/v1/auth/login", json={"email": "curator@trampliin.ru", "password": "password123"})

    result = await db.execute(
        sa.select(EmployerProfile).where(EmployerProfile.user_id == unverified_employer_user.id)
    )
    profile = result.scalar_one()

    resp = await client.patch(
        f"/api/v1/curator/employers/{profile.id}/verify",
        json={"status": "verified"},
    )
    assert resp.status_code == 200
    assert resp.json()["verification_status"] == "verified"


async def test_verify_employer_reject_with_comment(
    client: AsyncClient,
    curator_user: User,
    unverified_employer_user: User,
    db: AsyncSession,
):
    import sqlalchemy as sa

    await client.post("/api/v1/auth/login", json={"email": "curator@trampliin.ru", "password": "password123"})

    result = await db.execute(
        sa.select(EmployerProfile).where(EmployerProfile.user_id == unverified_employer_user.id)
    )
    profile = result.scalar_one()

    resp = await client.patch(
        f"/api/v1/curator/employers/{profile.id}/verify",
        json={"status": "rejected", "comment": "ИНН не соответствует ЕГРЮЛ"},
    )
    assert resp.status_code == 200
    assert resp.json()["verification_status"] == "rejected"


async def test_verify_employer_invalid_status(
    client: AsyncClient,
    curator_user: User,
    unverified_employer_user: User,
    db: AsyncSession,
):
    import sqlalchemy as sa

    await client.post("/api/v1/auth/login", json={"email": "curator@trampliin.ru", "password": "password123"})
    result = await db.execute(
        sa.select(EmployerProfile).where(EmployerProfile.user_id == unverified_employer_user.id)
    )
    profile = result.scalar_one()

    resp = await client.patch(
        f"/api/v1/curator/employers/{profile.id}/verify",
        json={"status": "pending"},  # invalid
    )
    assert resp.status_code == 422


# ── Opportunity moderation ─────────────────────────────────────────────────────

async def test_moderate_opportunity_approve(
    client: AsyncClient,
    curator_user: User,
    moderation_opportunity: Opportunity,
):
    await client.post("/api/v1/auth/login", json={"email": "curator@trampliin.ru", "password": "password123"})
    resp = await client.patch(
        f"/api/v1/curator/opportunities/{moderation_opportunity.id}/moderate",
        json={"status": "active"},
    )
    assert resp.status_code == 200
    assert resp.json()["status"] == "active"


async def test_moderate_opportunity_reject(
    client: AsyncClient,
    curator_user: User,
    moderation_opportunity: Opportunity,
):
    await client.post("/api/v1/auth/login", json={"email": "curator@trampliin.ru", "password": "password123"})
    resp = await client.patch(
        f"/api/v1/curator/opportunities/{moderation_opportunity.id}/moderate",
        json={"status": "draft", "comment": "Не заполнено описание"},
    )
    assert resp.status_code == 200
    body = resp.json()
    assert body["status"] == "draft"
    assert body["moderation_comment"] == "Не заполнено описание"


# ── Tags moderation ────────────────────────────────────────────────────────────

async def test_pending_tags_empty(client: AsyncClient, curator_user: User):
    await client.post("/api/v1/auth/login", json={"email": "curator@trampliin.ru", "password": "password123"})
    resp = await client.get("/api/v1/curator/tags/pending")
    assert resp.status_code == 200
    assert isinstance(resp.json(), list)


async def test_approve_pending_tag(
    client: AsyncClient,
    curator_user: User,
    db: AsyncSession,
):
    tag = Tag(name="GraphQL", is_active=False)
    db.add(tag)
    await db.flush()

    await client.post("/api/v1/auth/login", json={"email": "curator@trampliin.ru", "password": "password123"})

    # Appears in pending list
    resp = await client.get("/api/v1/curator/tags/pending")
    ids = [t["id"] for t in resp.json()]
    assert str(tag.id) in ids

    # Approve it
    resp = await client.patch(f"/api/v1/curator/tags/{tag.id}", json={"action": "approve"})
    assert resp.status_code == 200
    assert resp.json()["action"] == "approved"


async def test_reject_pending_tag(
    client: AsyncClient,
    curator_user: User,
    db: AsyncSession,
):
    tag = Tag(name="BadTag", is_active=False)
    db.add(tag)
    await db.flush()

    await client.post("/api/v1/auth/login", json={"email": "curator@trampliin.ru", "password": "password123"})
    resp = await client.patch(f"/api/v1/curator/tags/{tag.id}", json={"action": "reject"})
    assert resp.status_code == 200
    assert resp.json()["action"] == "rejected"


# ── Users management ───────────────────────────────────────────────────────────

async def test_list_users(client: AsyncClient, curator_user: User, seeker_user: User):
    await client.post("/api/v1/auth/login", json={"email": "curator@trampliin.ru", "password": "password123"})
    resp = await client.get("/api/v1/curator/users")
    assert resp.status_code == 200
    emails = [u["email"] for u in resp.json()]
    assert "seeker@test.com" in emails


async def test_update_user_role(client: AsyncClient, curator_user: User, seeker_user: User):
    await client.post("/api/v1/auth/login", json={"email": "curator@trampliin.ru", "password": "password123"})
    resp = await client.patch(
        f"/api/v1/curator/users/{seeker_user.id}",
        json={"is_active": False},
    )
    assert resp.status_code == 200
    assert resp.json()["is_active"] is False


async def test_create_curator_requires_admin(client: AsyncClient, curator_user: User):
    await client.post("/api/v1/auth/login", json={"email": "curator@trampliin.ru", "password": "password123"})
    resp = await client.post("/api/v1/curator/curators", json={
        "email": "new_cur@trampliin.ru",
        "display_name": "New Curator",
        "password": "secret123",
    })
    assert resp.status_code == 403


async def test_create_curator_as_admin(client: AsyncClient, admin_user: User):
    await client.post("/api/v1/auth/login", json={"email": "admin@trampliin.ru", "password": "password123"})
    resp = await client.post("/api/v1/curator/curators", json={
        "email": "brand_new_cur@trampliin.ru",
        "display_name": "New Curator",
        "password": "secret123",
    })
    assert resp.status_code == 201
    assert resp.json()["role"] == "curator"
