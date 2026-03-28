# Этот файл устарел. Модели перенесены в seeker_profile.py и employer_profile.py.
# Оставлен для обратной совместимости импортов — можно удалить.
from app.models.seeker_profile import SeekerProfile, PrivacyLevel
from app.models.employer_profile import EmployerProfile, VerificationStatus

__all__ = ["SeekerProfile", "PrivacyLevel", "EmployerProfile", "VerificationStatus"]
