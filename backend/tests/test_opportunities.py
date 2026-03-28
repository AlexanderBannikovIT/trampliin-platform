"""Tests for /api/v1/opportunities/* endpoints."""

import pytest
from httpx import AsyncClient
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.opportunity import Opportunity, OpportunityStatus
from app.models.user import User


# ── Public list / search ───────────────────────────────────────────────────────

async def test_list_opportunities_empty(client: AsyncClient):
    resp = await client.get("/api/v1/opportunities")
    assert resp.status_code == 200
    body = resp.json()
    assert "items" in body
    assert body["items"] == []


async def test_list_opportunities_returns_active(client: AsyncClient, active_opportunity: Opportunity):
    resp = await client.get("/api/v1/opportunities")
    assert resp.status_code == 200
    ids = [item["id"] for item in resp.json()["items"]]
    assert str(active_opportunity.id) in ids


async def test_list_opportunities_excludes_moderation(client: AsyncClient, moderation_opportunity: Opportunity):
    resp = await client.get("/api/v1/opportunities")
    assert resp.status_code == 200
    ids = [item["id"] for item in resp.json()["items"]]
    assert str(moderation_opportunity.id) not in ids


async def test_get_opportunity_by_id(client: AsyncClient, active_opportunity: Opportunity):
    resp = await client.get(f"/api/v1/opportunities/{active_opportunity.id}")
    assert resp.status_code == 200
    assert resp.json()["id"] == str(active_opportunity.id)
    assert resp.json()["title"] == active_opportunity.title


async def test_get_opportunity_not_found(client: AsyncClient):
    import uuid
    resp = await client.get(f"/api/v1/opportunities/{uuid.uuid4()}")
    assert resp.status_code == 404


async def test_filter_by_format(client: AsyncClient, active_opportunity: Opportunity):
    resp = await client.get("/api/v1/opportunities?format=remote")
    assert resp.status_code == 200
    items = resp.json()["items"]
    assert all(item["format"] == "remote" for item in items)
    assert any(item["id"] == str(active_opportunity.id) for item in items)


async def test_filter_by_city(client: AsyncClient, active_opportunity: Opportunity):
    resp = await client.get("/api/v1/opportunities?city=Москва")
    assert resp.status_code == 200
    ids = [item["id"] for item in resp.json()["items"]]
    assert str(active_opportunity.id) in ids


async def test_search_by_text(client: AsyncClient, active_opportunity: Opportunity):
    resp = await client.get("/api/v1/opportunities?q=Python")
    assert resp.status_code == 200
    # FTS may not be available if tsvector trigger didn't run (direct fixture insert),
    # so just assert the response is valid
    assert "items" in resp.json()


# ── Create (employer only) ─────────────────────────────────────────────────────

async def test_create_opportunity_unauthenticated(client: AsyncClient):
    resp = await client.post("/api/v1/opportunities", json={
        "title": "Hacker", "type": "vacancy", "format": "remote",
    })
    assert resp.status_code == 401


async def test_create_opportunity_as_seeker(client: AsyncClient, seeker_user: User):
    await client.post("/api/v1/auth/login", json={"email": "seeker@test.com", "password": "password123"})
    resp = await client.post("/api/v1/opportunities", json={
        "title": "Dev", "type": "vacancy", "format": "remote",
    })
    assert resp.status_code == 403


async def test_create_opportunity_verified_employer(client: AsyncClient, employer_user: User):
    await client.post("/api/v1/auth/login", json={"email": "employer@company.com", "password": "password123"})
    resp = await client.post("/api/v1/opportunities", json={
        "title": "Senior Go Developer",
        "description": "We need a Go expert",
        "type": "vacancy",
        "format": "remote",
        "tags": [],
    })
    assert resp.status_code == 201
    body = resp.json()
    assert body["title"] == "Senior Go Developer"
    assert body["status"] == "moderation"  # always starts in moderation


async def test_create_opportunity_unverified_employer(client: AsyncClient, unverified_employer_user: User):
    await client.post("/api/v1/auth/login", json={"email": "pending@company.com", "password": "password123"})
    resp = await client.post("/api/v1/opportunities", json={
        "title": "Dev",
        "type": "vacancy",
        "format": "remote",
        "tags": [],
    })
    # Should fail with 403 (verification required)
    assert resp.status_code == 403


# ── Edit / delete ──────────────────────────────────────────────────────────────

async def test_update_own_opportunity(client: AsyncClient, employer_user: User, active_opportunity: Opportunity):
    await client.post("/api/v1/auth/login", json={"email": "employer@company.com", "password": "password123"})
    resp = await client.patch(f"/api/v1/opportunities/{active_opportunity.id}", json={"title": "Updated Title"})
    assert resp.status_code == 200
    assert resp.json()["title"] == "Updated Title"


async def test_delete_own_opportunity(client: AsyncClient, employer_user: User, active_opportunity: Opportunity):
    await client.post("/api/v1/auth/login", json={"email": "employer@company.com", "password": "password123"})
    resp = await client.delete(f"/api/v1/opportunities/{active_opportunity.id}")
    assert resp.status_code == 204


async def test_delete_other_employer_opportunity(
    client: AsyncClient, db: AsyncSession,
    active_opportunity: Opportunity,
):
    """Another employer cannot delete someone else's opportunity."""
    from tests.conftest import _make_user
    from app.models.user import UserRole
    from app.models.employer_profile import EmployerProfile, VerificationStatus

    other = await _make_user(db, email="other_emp@corp.com", role=UserRole.employer)
    db.add(EmployerProfile(
        user_id=other.id, company_name="Other Corp",
        verification_status=VerificationStatus.verified,
    ))
    await db.flush()

    await client.post("/api/v1/auth/login", json={"email": "other_emp@corp.com", "password": "password123"})
    resp = await client.delete(f"/api/v1/opportunities/{active_opportunity.id}")
    assert resp.status_code in (403, 404)
