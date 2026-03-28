"""
Seed script — creates the admin user and loads initial tags.

Run with:
    python -m app.core.seed
"""

import asyncio
import logging
from datetime import datetime, timezone

from geoalchemy2.shape import from_shape
from shapely.geometry import Point
from sqlalchemy import func, select

from app.core.config import settings
from app.core.database import AsyncSessionLocal
from app.core.security import hash_password
from app.models.employer_profile import EmployerProfile, VerificationStatus
from app.models.opportunity import Opportunity, OpportunityFormat, OpportunityStatus, OpportunityType
from app.models.tag import Tag, TagCategory
from app.models.user import User, UserRole

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

# ── Seed data ─────────────────────────────────────────────────────────────────

SEED_TAGS: list[tuple[str, TagCategory]] = [
    # Languages
    ("Python", TagCategory.language),
    ("JavaScript", TagCategory.language),
    ("TypeScript", TagCategory.language),
    ("Java", TagCategory.language),
    ("Go", TagCategory.language),
    ("Kotlin", TagCategory.language),
    ("Swift", TagCategory.language),
    ("C++", TagCategory.language),
    ("C#", TagCategory.language),
    ("Rust", TagCategory.language),
    ("PHP", TagCategory.language),
    ("Ruby", TagCategory.language),
    # Frameworks & tools
    ("React", TagCategory.framework),
    ("Next.js", TagCategory.framework),
    ("Vue", TagCategory.framework),
    ("FastAPI", TagCategory.framework),
    ("Django", TagCategory.framework),
    ("Spring", TagCategory.framework),
    ("Node.js", TagCategory.framework),
    ("Docker", TagCategory.framework),
    ("Kubernetes", TagCategory.framework),
    ("PostgreSQL", TagCategory.framework),
    ("MongoDB", TagCategory.framework),
    ("Redis", TagCategory.framework),
    ("Git", TagCategory.framework),
    ("Linux", TagCategory.framework),
    # Level
    ("Intern", TagCategory.level),
    ("Junior", TagCategory.level),
    ("Middle", TagCategory.level),
    ("Senior", TagCategory.level),
    # Employment
    ("Полная", TagCategory.employment),
    ("Частичная", TagCategory.employment),
    ("Проектная", TagCategory.employment),
    # Direction
    ("Backend", TagCategory.direction),
    ("Frontend", TagCategory.direction),
    ("Fullstack", TagCategory.direction),
    ("DevOps", TagCategory.direction),
    ("ML/AI", TagCategory.direction),
    ("Data", TagCategory.direction),
    ("Mobile", TagCategory.direction),
    ("QA", TagCategory.direction),
    ("Design", TagCategory.direction),
    ("Product", TagCategory.direction),
]


DEMO_EMPLOYERS = [
    {
        "email": "technolab@demo.ru",
        "display_name": "ТехноЛаб",
        "profile": {
            "company_name": "ТехноЛаб",
            "inn": "7701234567",
            "sphere": "Разработка ПО",
            "description": "Ведущая IT-компания в сфере B2B SaaS решений",
            "website": "https://technolab.ru",
            "corporate_email": "hr@technolab.ru",
        },
    },
    {
        "email": "datacore@demo.ru",
        "display_name": "DataCore",
        "profile": {
            "company_name": "DataCore Analytics",
            "inn": "7702345678",
            "sphere": "Data & Analytics",
            "description": "Компания специализируется на больших данных и ML",
            "website": "https://datacore.ru",
            "corporate_email": "jobs@datacore.ru",
        },
    },
    {
        "email": "webstudio@demo.ru",
        "display_name": "WebStudio",
        "profile": {
            "company_name": "WebStudio Pro",
            "inn": "7703456789",
            "sphere": "Веб-разработка",
            "description": "Студия полного цикла веб-разработки",
            "website": "https://webstudio.pro",
            "corporate_email": "career@webstudio.pro",
        },
    },
]

# employer_key → (type, format, city, address, lng, lat, salary_min, salary_max, description, tag_names)
DEMO_OPPORTUNITIES = [
    # idx 0 — ТехноЛаб
    ("technolab@demo.ru", "Junior Python-разработчик", "vacancy", "office",
     "Москва", "ул. Льва Толстого, 16", 37.587, 55.733,
     80000, 120000,
     "Ищем Junior Python разработчика для работы над backend-сервисами. Требования: Python 3.10+, FastAPI или Django, PostgreSQL, Git.",
     ["Python", "FastAPI", "PostgreSQL", "Junior", "Полная"]),
    # idx 1 — ТехноЛаб
    ("technolab@demo.ru", "Frontend Developer (React)", "vacancy", "hybrid",
     "Москва", "Пресненская наб., 8с1", 37.539, 55.749,
     120000, 180000,
     "Разработка пользовательских интерфейсов для SaaS платформы. Требования: React, TypeScript, Next.js, REST API.",
     ["React", "TypeScript", "Next.js", "Middle", "Полная"]),
    # idx 2 — ТехноЛаб
    ("technolab@demo.ru", "Стажировка — Data Analyst", "internship", "office",
     "Москва", "ул. Академика Янгеля, 2", 37.616, 55.608,
     40000, 60000,
     "Стажировка для студентов 3-4 курсов. Анализ данных, построение дашбордов, работа с SQL и Python.",
     ["Python", "PostgreSQL", "Data", "Intern", "Частичная"]),
    # idx 3 — DataCore
    ("datacore@demo.ru", "DevOps Engineer", "vacancy", "remote",
     "Санкт-Петербург", None, 30.315, 59.939,
     180000, 250000,
     "Удалённая работа. Поддержка и развитие инфраструктуры на Kubernetes. Требования: Docker, K8s, CI/CD, Linux.",
     ["Docker", "Kubernetes", "Linux", "Middle", "Полная"]),
    # idx 4 — DataCore
    ("datacore@demo.ru", "ML Engineer — стажировка", "internship", "hybrid",
     "Москва", "ул. Вавилова, 40", 37.570, 55.700,
     50000, 80000,
     "Работа с моделями машинного обучения, обучение и деплой. Требования: Python, PyTorch или TensorFlow, базовый ML.",
     ["Python", "ML/AI", "Intern", "Частичная"]),
    # idx 5 — WebStudio
    ("webstudio@demo.ru", "Backend разработчик (Go)", "vacancy", "office",
     "Москва", "Большой Саввинский пер., 12", 37.558, 55.736,
     200000, 300000,
     "Разработка высоконагруженных сервисов на Go. Требования: Go 1.20+, PostgreSQL, Redis, gRPC.",
     ["Go", "PostgreSQL", "Redis", "Senior", "Полная"]),
    # idx 6 — ТехноЛаб
    ("technolab@demo.ru", "Хакатон по искусственному интеллекту", "event", "office",
     "Москва", "Сколково, ул. Нобелевская, 1", 37.357, 55.698,
     None, None,
     "48-часовой хакатон для студентов и выпускников. Призовой фонд 500 000 руб. Темы: компьютерное зрение, NLP, рекомендательные системы.",
     ["Python", "ML/AI", "Data"]),
    # idx 7 — DataCore
    ("datacore@demo.ru", "Менторская программа — iOS разработка", "mentorship", "remote",
     "Екатеринбург", None, 60.597, 56.838,
     None, None,
     "3-месячная менторская программа для начинающих iOS разработчиков. Еженедельные встречи с ментором, code review, помощь с трудоустройством.",
     ["Swift", "Mobile", "Junior"]),
    # idx 8 — WebStudio
    ("webstudio@demo.ru", "QA Engineer (автоматизация)", "vacancy", "hybrid",
     "Санкт-Петербург", "Невский пр., 28", 30.327, 59.935,
     100000, 150000,
     "Автоматизация тестирования веб и мобильных приложений. Требования: Python, Selenium/Playwright, pytest.",
     ["Python", "QA", "Middle", "Полная"]),
    # idx 9 — DataCore
    ("datacore@demo.ru", "День открытых дверей — DataCore", "event", "office",
     "Москва", "Пресненская наб., 12", 37.535, 55.748,
     None, None,
     "Узнайте как устроена работа в DataCore Analytics. Экскурсия по офису, встречи с командами, возможность попасть на стажировку.",
     ["Python", "Data", "ML/AI"]),
]


async def seed_demo_data() -> None:
    async with AsyncSessionLocal() as db:
        # ── 1. Employers ───────────────────────────────────────────────────────
        profile_by_email: dict[str, EmployerProfile] = {}
        for emp_data in DEMO_EMPLOYERS:
            result = await db.execute(select(User).where(User.email == emp_data["email"]))
            user = result.scalar_one_or_none()
            if user is None:
                user = User(
                    email=emp_data["email"],
                    display_name=emp_data["display_name"],
                    password_hash=hash_password("demo123456"),
                    role=UserRole.employer,
                    is_active=True,
                )
                db.add(user)
                await db.flush()
                logger.info("Created employer: %s", emp_data["email"])

                p = emp_data["profile"]
                profile = EmployerProfile(
                    user_id=user.id,
                    company_name=p["company_name"],
                    inn=p["inn"],
                    sphere=p["sphere"],
                    description=p["description"],
                    website=p["website"],
                    corporate_email=p["corporate_email"],
                    verification_status=VerificationStatus.verified,
                )
                db.add(profile)
                await db.flush()
                profile_by_email[emp_data["email"]] = profile
            else:
                result2 = await db.execute(
                    select(EmployerProfile).where(EmployerProfile.user_id == user.id)
                )
                profile_by_email[emp_data["email"]] = result2.scalar_one()
                logger.info("Employer already exists: %s", emp_data["email"])

        await db.commit()

        # ── 2. Opportunities (only if table empty) ─────────────────────────────
        count_result = await db.execute(select(func.count()).select_from(Opportunity))
        opp_count = count_result.scalar_one()
        if opp_count > 0:
            logger.info("Opportunities already seeded (%d rows), skipping.", opp_count)
            return

        # Load all tags into a name→tag map
        tag_result = await db.execute(select(Tag).where(Tag.is_active == True))  # noqa: E712
        tag_map: dict[str, Tag] = {t.name.lower(): t for t in tag_result.scalars().all()}

        now = datetime.now(timezone.utc)
        for (employer_email, title, opp_type, fmt, city, address, lng, lat,
             salary_min, salary_max, description, tag_names) in DEMO_OPPORTUNITIES:

            profile = profile_by_email.get(employer_email)
            if profile is None:
                logger.warning("Profile not found for %s, skipping opportunity: %s", employer_email, title)
                continue

            opp = Opportunity(
                employer_id=profile.id,
                title=title,
                description=description,
                type=OpportunityType(opp_type),
                format=OpportunityFormat(fmt),
                city=city,
                address=address,
                geo_point=from_shape(Point(lng, lat), srid=4326),
                salary_min=salary_min,
                salary_max=salary_max,
                status=OpportunityStatus.active,
                published_at=now,
            )
            # Attach tags
            for tag_name in tag_names:
                tag = tag_map.get(tag_name.lower())
                if tag:
                    opp.tags.append(tag)
                else:
                    logger.warning("Tag not found: %s", tag_name)

            db.add(opp)

        await db.commit()
        logger.info("Seeded %d demo opportunities.", len(DEMO_OPPORTUNITIES))


async def seed() -> None:
    async with AsyncSessionLocal() as db:
        # ── Admin user ─────────────────────────────────────────────────────────
        result = await db.execute(select(User).where(User.email == settings.ADMIN_EMAIL))
        admin = result.scalar_one_or_none()

        if admin is None:
            admin = User(
                email=settings.ADMIN_EMAIL,
                display_name=settings.ADMIN_DISPLAY_NAME,
                password_hash=hash_password(settings.ADMIN_PASSWORD),
                role=UserRole.admin,
                is_active=True,
            )
            db.add(admin)
            await db.flush()
            logger.info("Created admin user: %s", settings.ADMIN_EMAIL)
        else:
            logger.info("Admin user already exists: %s", settings.ADMIN_EMAIL)

        # ── Tags ───────────────────────────────────────────────────────────────
        existing_result = await db.execute(select(Tag.name))
        existing_names = {row[0].lower() for row in existing_result.all()}

        created = 0
        for name, category in SEED_TAGS:
            if name.lower() not in existing_names:
                tag = Tag(name=name, category=category, is_active=True)
                db.add(tag)
                created += 1

        await db.commit()
        logger.info("Seeded %d new tags (skipped existing)", created)
        logger.info("Seed complete.")

    await seed_demo_data()


if __name__ == "__main__":
    asyncio.run(seed())
