import enum
import uuid
from typing import TYPE_CHECKING

from sqlalchemy import Enum, ForeignKey, SmallInteger, String, Text, text
from sqlalchemy.dialects.postgresql import JSONB, UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.models.base import Base

if TYPE_CHECKING:
    from app.models.user import User
    from app.models.application import Application
    from app.models.contact import Contact


class PrivacyLevel(str, enum.Enum):
    private = "private"
    contacts = "contacts"
    public = "public"


class SeekerProfile(Base):
    __tablename__ = "seeker_profiles"

    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        primary_key=True,
        server_default=text("gen_random_uuid()"),
    )
    user_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("users.id", ondelete="CASCADE"),
        unique=True,
        nullable=False,
    )
    full_name: Mapped[str | None] = mapped_column(String(200))
    university: Mapped[str | None] = mapped_column(String(200))
    graduation_year: Mapped[int | None] = mapped_column(SmallInteger)
    bio: Mapped[str | None] = mapped_column(Text)
    skills: Mapped[list] = mapped_column(JSONB, server_default=text("'[]'::jsonb"))
    links: Mapped[dict] = mapped_column(JSONB, server_default=text("'{}'::jsonb"))
    privacy: Mapped[PrivacyLevel] = mapped_column(
        Enum(PrivacyLevel, name="privacylevel"),
        server_default=text("'contacts'"),
    )

    user: Mapped["User"] = relationship("User", back_populates="seeker_profile")
    applications: Mapped[list["Application"]] = relationship(
        "Application", back_populates="seeker", cascade="all, delete-orphan"
    )
    sent_contacts: Mapped[list["Contact"]] = relationship(
        "Contact",
        foreign_keys="[Contact.seeker_id]",
        back_populates="seeker",
        cascade="all, delete-orphan",
    )
    received_contacts: Mapped[list["Contact"]] = relationship(
        "Contact",
        foreign_keys="[Contact.contact_id]",
        back_populates="contact_seeker",
        cascade="all, delete-orphan",
    )

    def __repr__(self) -> str:
        return f"<SeekerProfile id={self.id} user_id={self.user_id} full_name={self.full_name!r}>"
