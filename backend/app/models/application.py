import enum
import uuid
from datetime import datetime
from typing import TYPE_CHECKING

from sqlalchemy import DateTime, Enum, ForeignKey, Index, UniqueConstraint, func, text
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.models.base import Base

if TYPE_CHECKING:
    from app.models.seeker_profile import SeekerProfile
    from app.models.opportunity import Opportunity


class ApplicationStatus(str, enum.Enum):
    submitted = "submitted"
    reviewed = "reviewed"
    accepted = "accepted"
    rejected = "rejected"
    reserve = "reserve"


class Application(Base):
    __tablename__ = "applications"
    __table_args__ = (
        UniqueConstraint("seeker_id", "opportunity_id", name="uq_application_seeker_opportunity"),
        Index("ix_app_seeker", "seeker_id"),
        Index("ix_app_opportunity", "opportunity_id"),
    )

    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        primary_key=True,
        server_default=text("gen_random_uuid()"),
    )
    seeker_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("seeker_profiles.id", ondelete="CASCADE"),
        nullable=False,
    )
    opportunity_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("opportunities.id", ondelete="CASCADE"),
        nullable=False,
    )
    status: Mapped[ApplicationStatus] = mapped_column(
        Enum(ApplicationStatus, name="applicationstatus"),
        server_default=text("'submitted'"),
    )
    applied_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now()
    )

    seeker: Mapped["SeekerProfile"] = relationship(
        "SeekerProfile", back_populates="applications"
    )
    opportunity: Mapped["Opportunity"] = relationship(
        "Opportunity", back_populates="applications"
    )

    def __repr__(self) -> str:
        return (
            f"<Application id={self.id} seeker_id={self.seeker_id} "
            f"opportunity_id={self.opportunity_id} status={self.status.value}>"
        )
