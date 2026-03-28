"""
EmailService — stubs only. All sending is disabled to avoid SMTP timeouts.
"""

import logging

logger = logging.getLogger(__name__)


async def _send(*args, **kwargs) -> None:
    logger.info("[EMAIL STUB] Email sending disabled")


async def send_verification_email(to: str, token: str) -> None:
    logger.info("[EMAIL STUB] Verification email to %s", to)


async def send_employer_verification_result(
    to: str, company_name: str, approved: bool, comment: str | None = None
) -> None:
    logger.info("[EMAIL STUB] Verification result to %s: approved=%s", to, approved)


async def send_application_status_change(
    to: str, opportunity_title: str, status: str
) -> None:
    logger.info("[EMAIL STUB] Status change to %s: %s", to, status)


async def send_curator_welcome(to: str, display_name: str) -> None:
    logger.info("[EMAIL STUB] Curator welcome to %s (%s)", to, display_name)


async def send_opportunity_moderation_result(
    to: str, opportunity_title: str, approved: bool, comment: str | None = None
) -> None:
    logger.info("[EMAIL STUB] Moderation result to %s: approved=%s", to, approved)
