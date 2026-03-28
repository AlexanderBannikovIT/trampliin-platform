import enum
import uuid
from datetime import datetime
from typing import TYPE_CHECKING

from sqlalchemy import DateTime, Enum, ForeignKey, func, text
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.models.base import Base

if TYPE_CHECKING:
    from app.models.seeker_profile import SeekerProfile


class ContactStatus(str, enum.Enum):
    pending = "pending"
    accepted = "accepted"


class Contact(Base):
    __tablename__ = "contacts"

    seeker_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("seeker_profiles.id", ondelete="CASCADE"),
        primary_key=True,
    )
    contact_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("seeker_profiles.id", ondelete="CASCADE"),
        primary_key=True,
    )
    status: Mapped[ContactStatus] = mapped_column(
        Enum(ContactStatus, name="contactstatus"),
        server_default=text("'pending'"),
    )
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now()
    )

    seeker: Mapped["SeekerProfile"] = relationship(
        "SeekerProfile",
        foreign_keys=[seeker_id],
        back_populates="sent_contacts",
    )
    contact_seeker: Mapped["SeekerProfile"] = relationship(
        "SeekerProfile",
        foreign_keys=[contact_id],
        back_populates="received_contacts",
    )

    def __repr__(self) -> str:
        return (
            f"<Contact seeker_id={self.seeker_id} contact_id={self.contact_id} "
            f"status={self.status.value}>"
        )
