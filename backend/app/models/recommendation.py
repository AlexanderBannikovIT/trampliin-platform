import uuid
from datetime import datetime
from typing import TYPE_CHECKING

from sqlalchemy import Boolean, DateTime, ForeignKey, Text, func, text
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.models.base import Base

if TYPE_CHECKING:
    from app.models.seeker_profile import SeekerProfile
    from app.models.opportunity import Opportunity


class Recommendation(Base):
    __tablename__ = "recommendations"

    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        primary_key=True,
        server_default=text("gen_random_uuid()"),
    )
    from_seeker_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("seeker_profiles.id", ondelete="CASCADE"),
        nullable=False,
    )
    to_seeker_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("seeker_profiles.id", ondelete="CASCADE"),
        nullable=False,
    )
    opportunity_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("opportunities.id", ondelete="CASCADE"),
        nullable=False,
    )
    message: Mapped[str | None] = mapped_column(Text)
    is_read: Mapped[bool] = mapped_column(Boolean, server_default=text("false"))
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now()
    )

    from_seeker: Mapped["SeekerProfile"] = relationship(
        "SeekerProfile", foreign_keys=[from_seeker_id]
    )
    to_seeker: Mapped["SeekerProfile"] = relationship(
        "SeekerProfile", foreign_keys=[to_seeker_id]
    )
    opportunity: Mapped["Opportunity"] = relationship(
        "Opportunity", foreign_keys=[opportunity_id]
    )

    def __repr__(self) -> str:
        return (
            f"<Recommendation id={self.id} "
            f"from={self.from_seeker_id} to={self.to_seeker_id}>"
        )
