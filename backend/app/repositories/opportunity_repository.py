"""
OpportunityRepository — all DB access for the opportunities domain.

Search algorithm (from CONTEXT.md):
  1. filter status=active, expires_at > now()
  2. geo: ST_DWithin for office/hybrid, city ILIKE for remote
  3. FTS: search_vector @@ plainto_tsquery('russian', q)
  4. tags: JOIN opportunity_tags
  5. cursor-based pagination on published_at DESC
  6. separate COUNT(*) for total_count
"""

import base64
import uuid
from datetime import UTC, datetime

from geoalchemy2.shape import to_shape
from geoalchemy2.types import Geography
from sqlalchemy import cast, delete, func, or_, and_, select, text
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.models.opportunity import Opportunity, OpportunityFormat, OpportunityStatus, OpportunityType
from app.models.tag import Tag, opportunity_tags
from app.schemas.opportunity import SearchParams

_PAGE_SIZE = 20


# ── cursor helpers ─────────────────────────────────────────────────────────────

def encode_cursor(dt: datetime) -> str:
    return base64.urlsafe_b64encode(dt.isoformat().encode()).decode()


def decode_cursor(cursor: str) -> datetime:
    raw = base64.urlsafe_b64decode(cursor.encode()).decode()
    return datetime.fromisoformat(raw)


# ── geo helpers ────────────────────────────────────────────────────────────────

def extract_latlon(opp: Opportunity) -> tuple[float | None, float | None]:
    if opp.geo_point is None:
        return None, None
    try:
        pt = to_shape(opp.geo_point)
        return pt.y, pt.x  # lat = Y, lng = X
    except Exception:
        return None, None


def build_geo_json(items: list[Opportunity]) -> dict:
    features = []
    for opp in items:
        lat, lng = extract_latlon(opp)
        if lat is None or lng is None:
            continue
        features.append({
            "type": "Feature",
            "geometry": {"type": "Point", "coordinates": [lng, lat]},
            "properties": {
                "id": str(opp.id),
                "title": opp.title,
                "type": opp.type.value,
                "format": opp.format.value,
                "salary_min": float(opp.salary_min) if opp.salary_min else None,
                "salary_max": float(opp.salary_max) if opp.salary_max else None,
                "tags": [t.name for t in opp.tags][:3],
            },
        })
    return {"type": "FeatureCollection", "features": features}


# ── repository ─────────────────────────────────────────────────────────────────

class OpportunityRepository:
    def __init__(self, session: AsyncSession) -> None:
        self._db = session

    # ── read ──────────────────────────────────────────────────────────────────

    async def get_by_id(self, opp_id: uuid.UUID) -> Opportunity | None:
        result = await self._db.execute(
            select(Opportunity)
            .where(Opportunity.id == opp_id)
            .options(
                selectinload(Opportunity.tags),
                selectinload(Opportunity.employer),
            )
        )
        return result.scalar_one_or_none()

    async def get_by_employer(self, employer_id: uuid.UUID) -> list[Opportunity]:
        result = await self._db.execute(
            select(Opportunity)
            .where(Opportunity.employer_id == employer_id)
            .options(selectinload(Opportunity.tags))
            .order_by(Opportunity.published_at.desc())
        )
        return list(result.scalars().all())

    async def search(
        self, params: SearchParams
    ) -> tuple[list[Opportunity], int, str | None]:
        """Return (items, total_count, next_cursor)."""
        filters = self._build_filters(params)
        order = self._build_order(params)

        # Total count (no pagination)
        count_q = select(func.count()).select_from(Opportunity).where(*filters)
        total = (await self._db.execute(count_q)).scalar_one()

        # Items (with pagination, +1 to detect next page)
        items_q = (
            select(Opportunity)
            .where(*filters)
            .options(
                selectinload(Opportunity.tags),
                selectinload(Opportunity.employer),
            )
            .order_by(*order)
            .limit(_PAGE_SIZE + 1)
        )
        rows = list((await self._db.execute(items_q)).scalars().all())

        has_next = len(rows) > _PAGE_SIZE
        items = rows[:_PAGE_SIZE]
        next_cursor = encode_cursor(items[-1].published_at) if has_next and items else None

        return items, total, next_cursor

    # ── write ─────────────────────────────────────────────────────────────────

    async def create(
        self,
        *,
        employer_id: uuid.UUID,
        data: dict,
        tag_ids: list[uuid.UUID],
    ) -> Opportunity:
        opp = Opportunity(
            employer_id=employer_id,
            status=OpportunityStatus.moderation,
            **{k: v for k, v in data.items() if k not in ("tags", "lat", "lng")},
        )
        # Build geo_point from lat/lng
        lat, lng = data.get("lat"), data.get("lng")
        if lat is not None and lng is not None:
            opp.geo_point = f"SRID=4326;POINT({lng} {lat})"

        # Load tags BEFORE flush so opp is still pending (not persistent).
        # Setting opp.tags on a persistent object would trigger a lazy-load
        # of the existing collection to compute the diff → MissingGreenlet.
        if tag_ids:
            tags = list(
                (await self._db.execute(select(Tag).where(Tag.id.in_(tag_ids)))).scalars()
            )
            opp.tags = tags

        self._db.add(opp)
        await self._db.flush()          # single flush: INSERT opp + opportunity_tags
        await self._db.refresh(opp)     # populate server-defaults (id, published_at, status)
        return opp

    async def update(
        self,
        opp: Opportunity,
        *,
        data: dict,
        tag_ids: list[uuid.UUID] | None,
    ) -> Opportunity:
        for key, value in data.items():
            if key in ("tags", "lat", "lng"):
                continue
            setattr(opp, key, value)

        lat, lng = data.get("lat"), data.get("lng")
        if lat is not None and lng is not None:
            opp.geo_point = f"SRID=4326;POINT({lng} {lat})"

        if tag_ids is not None:
            tags = list(
                (await self._db.execute(select(Tag).where(Tag.id.in_(tag_ids)))).scalars()
            )
            opp.tags = tags

        await self._db.flush()
        await self._db.refresh(opp)
        return opp

    async def delete(self, opp: Opportunity) -> None:
        await self._db.delete(opp)
        await self._db.flush()

    # ── private helpers ───────────────────────────────────────────────────────

    def _build_filters(self, params: SearchParams) -> list:
        now = datetime.now(UTC)
        filters: list = [
            Opportunity.status == OpportunityStatus.active,
            or_(Opportunity.expires_at.is_(None), Opportunity.expires_at > now),
        ]

        # Type filter
        if params.type:
            filters.append(Opportunity.type == OpportunityType(params.type))

        # Format filter (explicit — before geo so geo knows format context)
        explicit_format: OpportunityFormat | None = None
        if params.format:
            explicit_format = OpportunityFormat(params.format)
            filters.append(Opportunity.format == explicit_format)

        # Salary filters
        if params.salary_min is not None:
            filters.append(
                or_(
                    Opportunity.salary_max >= params.salary_min,
                    Opportunity.salary_min >= params.salary_min,
                )
            )
        if params.salary_max is not None:
            filters.append(
                or_(
                    Opportunity.salary_min.is_(None),
                    Opportunity.salary_min <= params.salary_max,
                )
            )

        # FTS — search_vector @@ plainto_tsquery('russian', q)
        if params.q:
            tsq = func.plainto_tsquery(text("'russian'"), params.q)
            filters.append(Opportunity.search_vector.op("@@")(tsq))

        # Tag filter — any of the provided tag IDs
        if params.tags:
            tag_uuids = []
            for t in params.tags:
                try:
                    tag_uuids.append(uuid.UUID(t))
                except ValueError:
                    pass
            if tag_uuids:
                filters.append(
                    Opportunity.id.in_(
                        select(opportunity_tags.c.opportunity_id).where(
                            opportunity_tags.c.tag_id.in_(tag_uuids)
                        )
                    )
                )

        # Geo filter
        if params.lat is not None and params.lng is not None:
            radius_m = params.radius_km * 1000
            geo_within = func.ST_DWithin(
                cast(Opportunity.geo_point, Geography),
                cast(func.ST_MakePoint(params.lng, params.lat), Geography),
                radius_m,
            )
            if explicit_format is None:
                # Mix: non-remote within radius OR any remote
                filters.append(
                    or_(
                        and_(
                            Opportunity.format != OpportunityFormat.remote,
                            Opportunity.geo_point.isnot(None),
                            geo_within,
                        ),
                        Opportunity.format == OpportunityFormat.remote,
                    )
                )
            elif explicit_format != OpportunityFormat.remote:
                filters.append(Opportunity.geo_point.isnot(None))
                filters.append(geo_within)
            # format == remote → no geo constraint
        elif params.city:
            filters.append(Opportunity.city.ilike(f"%{params.city}%"))

        # Cursor pagination
        if params.cursor:
            try:
                cursor_dt = decode_cursor(params.cursor)
                filters.append(Opportunity.published_at < cursor_dt)
            except Exception:
                pass  # bad cursor → ignore

        return filters

    def _build_order(self, params: SearchParams) -> list:
        if params.sort == "relevance" and params.q:
            tsq = func.plainto_tsquery(text("'russian'"), params.q)
            return [
                func.ts_rank(Opportunity.search_vector, tsq).desc(),
                Opportunity.published_at.desc(),
            ]
        if params.sort == "salary":
            return [
                Opportunity.salary_min.desc().nulls_last(),
                Opportunity.published_at.desc(),
            ]
        return [Opportunity.published_at.desc()]
