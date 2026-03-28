"""Tests for application submission and status management."""

import pytest
from httpx import AsyncClient
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.opportunity import Opportunity
from app.models.user import User


# ── Submit application ────────────────────────────────────────────────────────

async def test_apply_as_seeker(
    client: AsyncClient, seeker_user: User, active_opportunity: Opportunity
):
    await client.post("/api/v1/auth/login", json={"email": "seeker@test.com", "password": "password123"})
    resp = await client.post("/api/v1/applications", json={"opportunity_id": str(active_opportunity.id)})
    assert resp.status_code == 201
    body = resp.json()
    assert body["opportunity_id"] == str(active_opportunity.id)
    assert body["status"] == "submitted"


async def test_apply_duplicate(
    client: AsyncClient, seeker_user: User, active_opportunity: Opportunity
):
    await client.post("/api/v1/auth/login", json={"email": "seeker@test.com", "password": "password123"})
    await client.post("/api/v1/applications", json={"opportunity_id": str(active_opportunity.id)})
    resp = await client.post("/api/v1/applications", json={"opportunity_id": str(active_opportunity.id)})
    assert resp.status_code == 409


async def test_apply_to_inactive_opportunity(
    client: AsyncClient, seeker_user: User, moderation_opportunity: Opportunity
):
    await client.post("/api/v1/auth/login", json={"email": "seeker@test.com", "password": "password123"})
    resp = await client.post("/api/v1/applications", json={"opportunity_id": str(moderation_opportunity.id)})
    assert resp.status_code == 404


async def test_apply_as_employer(
    client: AsyncClient, employer_user: User, active_opportunity: Opportunity
):
    await client.post("/api/v1/auth/login", json={"email": "employer@company.com", "password": "password123"})
    resp = await client.post("/api/v1/applications", json={"opportunity_id": str(active_opportunity.id)})
    assert resp.status_code == 403


async def test_apply_unauthenticated(client: AsyncClient, active_opportunity: Opportunity):
    resp = await client.post("/api/v1/applications", json={"opportunity_id": str(active_opportunity.id)})
    assert resp.status_code == 401


# ── My applications ───────────────────────────────────────────────────────────

async def test_get_my_applications_empty(client: AsyncClient, seeker_user: User):
    await client.post("/api/v1/auth/login", json={"email": "seeker@test.com", "password": "password123"})
    resp = await client.get("/api/v1/applications/my")
    assert resp.status_code == 200
    assert resp.json() == []


async def test_get_my_applications_after_apply(
    client: AsyncClient, seeker_user: User, active_opportunity: Opportunity
):
    await client.post("/api/v1/auth/login", json={"email": "seeker@test.com", "password": "password123"})
    await client.post("/api/v1/applications", json={"opportunity_id": str(active_opportunity.id)})
    resp = await client.get("/api/v1/applications/my")
    assert resp.status_code == 200
    assert len(resp.json()) == 1
    assert resp.json()[0]["opportunity_id"] == str(active_opportunity.id)


# ── Employer: view & update status ────────────────────────────────────────────

async def _apply(client: AsyncClient, seeker_email: str, opp_id: str) -> str:
    """Helper: login as seeker, apply, return app id."""
    await client.post("/api/v1/auth/login", json={"email": seeker_email, "password": "password123"})
    resp = await client.post("/api/v1/applications", json={"opportunity_id": opp_id})
    assert resp.status_code == 201
    return resp.json()["id"]


async def test_employer_views_applications(
    client: AsyncClient,
    seeker_user: User,
    employer_user: User,
    active_opportunity: Opportunity,
):
    await _apply(client, "seeker@test.com", str(active_opportunity.id))
    await client.post("/api/v1/auth/login", json={"email": "employer@company.com", "password": "password123"})
    resp = await client.get(f"/api/v1/employer/opportunities/{active_opportunity.id}/applications")
    assert resp.status_code == 200
    assert len(resp.json()) == 1


async def test_employer_updates_application_status(
    client: AsyncClient,
    seeker_user: User,
    employer_user: User,
    active_opportunity: Opportunity,
):
    app_id = await _apply(client, "seeker@test.com", str(active_opportunity.id))
    await client.post("/api/v1/auth/login", json={"email": "employer@company.com", "password": "password123"})
    resp = await client.patch(f"/api/v1/employer/applications/{app_id}", json={"status": "accepted"})
    assert resp.status_code == 200
    assert resp.json()["status"] == "accepted"


async def test_employer_cannot_update_other_employers_application(
    client: AsyncClient,
    db: AsyncSession,
    seeker_user: User,
    employer_user: User,
    active_opportunity: Opportunity,
):
    from tests.conftest import _make_user
    from app.models.user import UserRole
    from app.models.employer_profile import EmployerProfile, VerificationStatus

    app_id = await _apply(client, "seeker@test.com", str(active_opportunity.id))

    other = await _make_user(db, email="other2@corp.com", role=UserRole.employer)
    db.add(EmployerProfile(
        user_id=other.id, company_name="Other Corp",
        verification_status=VerificationStatus.verified,
    ))
    await db.flush()

    await client.post("/api/v1/auth/login", json={"email": "other2@corp.com", "password": "password123"})
    resp = await client.patch(f"/api/v1/employer/applications/{app_id}", json={"status": "rejected"})
    assert resp.status_code in (403, 404)


async def test_seeker_cannot_update_application_status(
    client: AsyncClient,
    seeker_user: User,
    employer_user: User,
    active_opportunity: Opportunity,
):
    app_id = await _apply(client, "seeker@test.com", str(active_opportunity.id))
    # Still logged in as seeker
    resp = await client.patch(f"/api/v1/employer/applications/{app_id}", json={"status": "accepted"})
    assert resp.status_code == 403
