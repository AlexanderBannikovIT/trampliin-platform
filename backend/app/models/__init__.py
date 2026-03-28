from app.models.base import Base
from app.models.user import User, UserRole
from app.models.seeker_profile import SeekerProfile, PrivacyLevel
from app.models.employer_profile import EmployerProfile, VerificationStatus
from app.models.tag import Tag, TagCategory, opportunity_tags
from app.models.opportunity import Opportunity, OpportunityType, OpportunityFormat, OpportunityStatus
from app.models.application import Application, ApplicationStatus
from app.models.contact import Contact, ContactStatus
from app.models.favorite import Favorite
from app.models.recommendation import Recommendation

__all__ = [
    # Base
    "Base",
    # User
    "User", "UserRole",
    # Seeker
    "SeekerProfile", "PrivacyLevel",
    # Employer
    "EmployerProfile", "VerificationStatus",
    # Tags
    "Tag", "TagCategory", "opportunity_tags",
    # Opportunities
    "Opportunity", "OpportunityType", "OpportunityFormat", "OpportunityStatus",
    # Applications
    "Application", "ApplicationStatus",
    # Contacts
    "Contact", "ContactStatus",
    # Favorites
    "Favorite",
    # Recommendations
    "Recommendation",
]
