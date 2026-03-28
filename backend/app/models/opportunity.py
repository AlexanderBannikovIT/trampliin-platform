import enum
import uuid
from datetime import datetime
from typing import TYPE_CHECKING

from geoalchemy2 import Geometry
from sqlalchemy import Column, DateTime, Enum, ForeignKey, Index, Numeric, String, Text, func, text
from sqlalchemy.dialects.postgresql import TSVECTOR, UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.models.base import Base

if TYPE_CHECKING:
    from app.models.employer_profile import EmployerProfile
    from app.models.tag import Tag
    from app.models.application import Application
    from app.models.favorite import Favorite


class OpportunityType(str, enum.Enum):
    vacancy = "vacancy"
    internship = "internship"
    mentorship = "mentorship"
    event = "event"


class OpportunityFormat(str, enum.Enum):
    office = "office"
    hybrid = "hybrid"
    remote = "remote"


class OpportunityStatus(str, enum.Enum):
    draft = "draft"
    moderation = "moderation"
    active = "active"
    closed = "closed"


class Opportunity(Base):
    __tablename__ = "opportunities"
    __table_args__ = (
        Index("ix_opp_status", "status"),
        Index("ix_opp_employer", "employer_id"),
        Index("ix_opp_published", "published_at"),
        Index("ix_opp_expires", "expires_at"),
    )

    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        primary_key=True,
        server_default=text("gen_random_uuid()"),
    )
    employer_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("employer_profiles.id", ondelete="CASCADE"),
        nullable=False,
    )
    title: Mapped[str] = mapped_column(String(300), nullable=False)
    description: Mapped[str | None] = mapped_column(Text)
    type: Mapped[OpportunityType] = mapped_column(
        Enum(OpportunityType, name="opportunitytype"), nullable=False
    )
    format: Mapped[OpportunityFormat] = mapped_column(
        Enum(OpportunityFormat, name="opportunityformat"), nullable=False
    )
    city: Mapped[str | None] = mapped_column(String(200))
    address: Mapped[str | None] = mapped_column(String(500))
    # GeoAlchemy2 column — не маппируется через Mapped[], объявляем через Column()
    geo_point = Column(Geometry(geometry_type="POINT", srid=4326), nullable=True)
    salary_min: Mapped[float | None] = mapped_column(Numeric(12, 2))
    salary_max: Mapped[float | None] = mapped_column(Numeric(12, 2))
    published_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now()
    )
    expires_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    status: Mapped[OpportunityStatus] = mapped_column(
        Enum(OpportunityStatus, name="opportunitystatus"),
        server_default=text("'draft'"),
    )
    moderation_comment: Mapped[str | None] = mapped_column(Text)
    # TSVECTOR обновляется триггером (см. миграцию)
    search_vector = Column(TSVECTOR, nullable=True)

    employer: Mapped["EmployerProfile"] = relationship(
        "EmployerProfile", back_populates="opportunities"
    )
    tags: Mapped[list["Tag"]] = relationship(
        "Tag",
        secondary="opportunity_tags",
        back_populates="opportunities",
    )
    applications: Mapped[list["Application"]] = relationship(
        "Application", back_populates="opportunity", cascade="all, delete-orphan"
    )
    favorited_by: Mapped[list["Favorite"]] = relationship(
        "Favorite", back_populates="opportunity", cascade="all, delete-orphan"
    )

    def __repr__(self) -> str:
        return (
            f"<Opportunity id={self.id} title={self.title!r} "
            f"type={self.type.value} status={self.status.value}>"
        )
