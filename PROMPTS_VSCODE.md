# Промпты для Claude в VS Code — Трамплин

Используй эти промпты последовательно. Перед каждым убедись, что открыт CONTEXT.md
и нужные файлы проекта. Копируй промпт целиком в чат Claude в VS Code.

---

## 🔧 ПРОМПТ 0 — Инициализация проекта

```
Прочитай CONTEXT.md в корне проекта. Это контекст платформы «Трамплин».

Создай структуру монорепо:

1. Корень: docker-compose.yml (сервисы: backend, frontend, postgres, redis, minio)
   - postgres: image postgres:16, с переменными из .env, volume для данных
   - redis: image redis:7-alpine
   - minio: image minio/minio, для медиафайлов
   - backend: build ./backend, порт 8000, depends_on postgres, redis
   - frontend: build ./frontend, порт 3000, depends_on backend

2. backend/: инициализируй FastAPI проект
   - requirements.txt со всеми зависимостями:
     fastapi, uvicorn[standard], sqlalchemy[asyncio], asyncpg, alembic,
     pydantic[email], pydantic-settings, python-jose[cryptography],
     passlib[bcrypt], redis, aiosmtplib, boto3, geoalchemy2, shapely,
     python-multipart
   - app/main.py: FastAPI app с CORS, роутерами, lifespan
   - app/core/config.py: Settings через pydantic-settings из .env
   - app/core/database.py: async engine + AsyncSession + get_db dependency
   - Dockerfile (python:3.12-slim, без root)

3. frontend/: инициализируй Next.js 14 проект
   - App Router, TypeScript, Tailwind CSS
   - package.json с зависимостями: next, react, typescript, tailwindcss,
     @yandex/ymaps3-types, axios, zustand, react-hook-form, zod
   - Dockerfile (node:20-alpine, multi-stage build)

4. .env.example в корне с переменными из CONTEXT.md
5. .gitignore

Создай все файлы с реальным содержимым, не заглушками.
```

---

## 🗄️ ПРОМПТ 1 — Модели БД

```
Прочитай CONTEXT.md. Создай SQLAlchemy 2.0 модели (async) в backend/app/models/.

Требования:
- Base = DeclarativeBase() в base.py
- Отдельный файл для каждой модели: user.py, seeker_profile.py,
  employer_profile.py, opportunity.py, tag.py, application.py,
  contact.py, favorite.py
- Все UUID генерируются на уровне БД (server_default=text("gen_random_uuid()"))
- Enum-поля через Python Enum + SQLAlchemy Enum type
- geo_point в opportunities через GeoAlchemy2 (Geometry("POINT", srid=4326))
- search_vector через Column(TSVECTOR) — будет обновляться триггером
- Все FK с правильными ondelete (CASCADE или SET NULL)
- __repr__ для каждой модели
- __init__.py в models/ экспортирует все модели

После моделей создай:
- alembic/env.py настроенный для async + автогенерации (target_metadata = Base.metadata)
- Первую миграцию: alembic revision --autogenerate -m "initial"
  (только покажи команды, не выполняй)
- backend/app/core/database.py: async_engine, AsyncSessionLocal, get_db dependency
```

---

## 🔐 ПРОМПТ 2 — Аутентификация

```
Прочитай CONTEXT.md и текущие файлы в backend/app/.

Реализуй полную систему аутентификации:

1. backend/app/core/security.py
   - hash_password(password) → str  (bcrypt)
   - verify_password(plain, hashed) → bool
   - create_access_token(data, expires_delta) → str  (JWT)
   - create_refresh_token(data) → str
   - decode_token(token) → payload | None

2. backend/app/core/dependencies.py
   - get_current_user: извлекает JWT из cookie "access_token", возвращает User
   - get_current_active_user: проверяет is_active
   - require_role(*roles): фабрика зависимостей для проверки роли

3. backend/app/repositories/user_repository.py
   - get_by_email, get_by_id, create, update, exists_by_email

4. backend/app/services/auth_service.py
   - register(data) → User  (хеширует пароль, отправляет email верификации)
   - login(email, password) → (access_token, refresh_token)
   - verify_email(token) → bool
   - refresh_tokens(refresh_token) → (new_access, new_refresh)
   - logout(refresh_token)  (инвалидирует в Redis)

5. backend/app/api/v1/auth.py — роутер /api/v1/auth
   - POST /register — тело: email, display_name, password, role (seeker|employer)
     Для employer дополнительно: company_name, inn, corporate_email
   - POST /login — устанавливает httpOnly cookies, SameSite=Lax, Secure в prod
   - POST /logout — очищает cookies
   - POST /refresh — ротация токенов
   - GET /verify-email/{token}

6. backend/app/schemas/ — Pydantic v2 схемы для всех запросов и ответов auth

Все токены в httpOnly cookie, никаких токенов в теле ответа.
Redis используй для хранения hash refresh-токена (ключ: user_id, TTL 30 дней).
```

---

## 🗂️ ПРОМПТ 3 — API возможностей (Opportunities)

```
Прочитай CONTEXT.md и файлы в backend/app/.

Реализуй CRUD для возможностей (вакансии, стажировки, события):

1. backend/app/repositories/opportunity_repository.py
   - search(params: SearchParams) → (items, total, next_cursor)
     Реализуй алгоритм из CONTEXT.md:
     · фильтр status=active, expires_at > now()
     · геофильтр ST_DWithin для офлайн, ILIKE по city для remote
     · FTS через search_vector @@ plainto_tsquery('russian', q)
     · фильтр по тегам через JOIN opportunity_tags
     · cursor-based пагинация по published_at
   - get_by_id, create, update, delete, get_by_employer

2. backend/app/services/opportunity_service.py
   - create_opportunity(employer_id, data) → Opportunity  (статус draft → moderation)
   - update_opportunity(id, data, user) → Opportunity  (активная → снова moderation)
   - search_opportunities(params) → результат с проверкой Redis кэша
   - close_opportunity, delete_opportunity

3. backend/app/api/v1/opportunities.py — роутер /api/v1/opportunities
   - GET / — публичный, параметры: q, type, format, salary_min, salary_max,
     tags (list), lat, lng, radius_km, city, sort (date|salary|relevance), cursor
     Ответ: {items, next_cursor, total_count, geo_json (GeoJSON FeatureCollection)}
   - GET /{id} — публичный
   - POST / — только verified employer
   - PATCH /{id} — employer (свои) или curator
   - DELETE /{id} — employer (свои) или curator

4. Pydantic схемы: OpportunityCreate, OpportunityUpdate, OpportunityResponse,
   OpportunityListResponse, SearchParams

5. SQL-триггер для обновления search_vector (добавь в миграцию):
   tsvector_update_trigger на title + description, язык 'russian'

Кэширование в Redis: ключ = "search:" + md5(sorted query params), TTL = 60 сек.
Инвалидация кэша при создании/изменении/удалении любой opportunity.
```

---

## 🗺️ ПРОМПТ 4 — Главная страница с картой (фронтенд)

```
Прочитай CONTEXT.md и текущую структуру frontend/src/.

Создай главную страницу платформы Трамплин:

1. frontend/src/app/page.tsx — серверный компонент, layout страницы

2. frontend/src/components/map/YandexMap.tsx — Client Component
   - Подключение Яндекс Карты JS API v3 через Script (next/script)
   - Отображение маркеров из GeoJSON
   - Обычные маркеры: серые, маркеры избранных компаний: янтарные (#BA7517)
   - При наведении на маркер: показывает PopupCard
   - При клике на маркер: открывает полную карточку (drawer или modal)
   - Центр карты: Москва по умолчанию, адаптируется под фильтр города

3. frontend/src/components/map/PopupCard.tsx — модульная карточка при наведении
   Содержит: название позиции, компания, тип (badge), зарплата, формат, теги (до 3)

4. frontend/src/components/opportunities/OpportunityCard.tsx
   Полная карточка для режима списка: все поля из CONTEXT.md

5. frontend/src/components/search/SearchFilters.tsx — Client Component
   Фильтры: текстовый поиск, тип (checkbox), формат (checkbox),
   зарплата (range slider), теги (multiselect с поиском)
   При изменении фильтров — debounce 300ms → обновляет URL params → перезапрос

6. frontend/src/components/search/ViewToggle.tsx
   Переключатель карта/список

7. frontend/src/lib/api.ts — типизированный API-клиент (axios)
   - baseURL из NEXT_PUBLIC_API_URL
   - withCredentials: true (для cookie)
   - interceptor: при 401 → рефреш токена → повтор запроса

8. frontend/src/hooks/useOpportunities.ts
   Хук для загрузки вакансий с учётом фильтров и режима отображения

9. frontend/src/store/favoritesStore.ts (zustand)
   Для гостей: хранит избранное в localStorage
   Для авторизованных: синхронизирует с API

TypeScript strict. Tailwind для стилей. Адаптивная вёрстка (mobile-first).
```

---

## 👤 ПРОМПТ 5 — Личный кабинет соискателя

```
Прочитай CONTEXT.md и текущую структуру проекта.

Реализуй личный кабинет соискателя:

BACKEND:
1. backend/app/repositories/seeker_repository.py
   - get_by_user_id, create, update, get_with_privacy_check
2. backend/app/services/seeker_service.py
   - get_profile, update_profile, get_applications_history
   - add_contact, accept_contact, get_contacts
3. backend/app/api/v1/profile.py — роутер /api/v1/profile
   - GET/PATCH /seeker — мой профиль
   - GET /seeker/{id} — чужой профиль (с учётом privacy)
4. backend/app/api/v1/contacts.py
   - GET / — список контактов
   - POST /{seeker_id} — запрос на добавление
   - PATCH /{seeker_id} — принять/отклонить

FRONTEND:
5. frontend/src/app/dashboard/seeker/page.tsx
   Вкладки: Резюме, Отклики, Избранное, Контакты
   (реализуй все 4 вкладки, состояние через URL searchParams)

6. frontend/src/app/dashboard/seeker/components/ResumeTab.tsx
   Форма редактирования: ФИО, вуз, курс, навыки (tags input), bio, ссылки

7. frontend/src/app/dashboard/seeker/components/ApplicationsTab.tsx
   Таблица откликов: компания, позиция, дата, статус (badge с цветом)

8. frontend/src/app/dashboard/seeker/components/ContactsTab.tsx
   Список контактов с кнопкой «Рекомендовать» (открывает модал выбора вакансии)

9. frontend/src/components/ui/PrivacyToggle.tsx
   Переключатель: private | contacts | public

Приватность: если privacy=private — профиль виден только владельцу.
Если contacts — только контактам. Если public — всем авторизованным.
```

---

## 🏢 ПРОМПТ 6 — Личный кабинет работодателя

```
Прочитай CONTEXT.md и текущую структуру проекта.

Реализуй личный кабинет работодателя:

BACKEND:
1. backend/app/repositories/employer_repository.py
2. backend/app/services/employer_service.py
   - get_my_opportunities(employer_id, filters) — с фильтрацией по статусу
   - get_applications_for_opportunity(opp_id, employer_id)
   - update_application_status(app_id, status, employer_id)
3. backend/app/api/v1/employer.py
   - GET /profile — профиль компании
   - PATCH /profile — обновить (name, description, sphere, website, logo)
   - GET /opportunities — мои вакансии (фильтр: status, type)
   - GET /opportunities/{id}/applications — отклики на вакансию
   - PATCH /applications/{id} — изменить статус отклика

FRONTEND:
4. frontend/src/app/dashboard/employer/page.tsx
   Секции: Профиль компании, Статистика (3 числа), Мои возможности, Отклики

5. frontend/src/app/dashboard/employer/components/OpportunityForm.tsx
   Форма создания/редактирования карточки возможности:
   - Все поля из CONTEXT.md (title, description, type, format, city/address,
     salary_min/max, expires_at, теги multiselect, медиа-ссылки)
   - Для офлайн/гибрид: поле адреса с геокодированием через Яндекс Geocoder API
     (автоматически заполняет geo_point)
   - Валидация через react-hook-form + zod

6. frontend/src/app/dashboard/employer/components/ApplicationsList.tsx
   - Таблица откликов с inline-изменением статуса (select: submitted|accepted|rejected|reserve)
   - Кнопка «Просмотреть профиль» — открывает профиль соискателя в drawer
     (с учётом его настроек приватности)

7. frontend/src/app/dashboard/employer/components/CompanyProfile.tsx
   Форма профиля компании с загрузкой логотипа (в S3/MinIO)

Работодатель без верификации видит форму, но при попытке опубликовать
получает сообщение «Ожидает верификации куратором».
```

---

## 🛡️ ПРОМПТ 7 — Кабинет куратора и модерация

```
Прочитай CONTEXT.md и текущую структуру проекта.

Реализуй кабинет куратора:

BACKEND:
1. backend/app/api/v1/curator.py — роутер /api/v1/curator (только curator + admin)
   - GET /queue — все очереди: {verification: [...], moderation: [...], tags: [...]}
   - PATCH /employers/{id}/verify — body: {status: verified|rejected, comment?}
     При одобрении: employer_profile.verification_status = verified
     Отправляет email работодателю с результатом
   - PATCH /opportunities/{id}/moderate — body: {status: active|draft, comment?}
     При отклонении: устанавливает draft + сохраняет комментарий
   - GET /users — список всех пользователей с фильтрами
   - PATCH /users/{id} — изменить role, is_active
   - POST /curators — создать куратора (только admin)
   - GET /tags/pending — теги на одобрении
   - PATCH /tags/{id} — одобрить (is_active=true) / отклонить (удалить)

2. backend/app/services/email_service.py
   - send_verification_email(to, token)
   - send_employer_verification_result(to, approved, comment)
   - send_application_status_change(to, opportunity_title, status)
   Используй aiosmtplib + Jinja2 шаблоны (templates/email/)

FRONTEND:
3. frontend/src/app/dashboard/curator/page.tsx
   Три колонки или вкладки: Верификация компаний | Модерация карточек | Теги

4. frontend/src/app/dashboard/curator/components/VerificationQueue.tsx
   Карточки компаний: название, ИНН, корп. email, ссылки, дата заявки
   Кнопки: Одобрить / Отклонить (с модалом для причины отказа)
   Автоматическая пометка подозрительных (gmail/mail/yandex email или нет ИНН)

5. frontend/src/app/dashboard/curator/components/ModerationQueue.tsx
   Список карточек на модерации: превью карточки, кнопки Одобрить / Отклонить

6. frontend/src/app/dashboard/curator/components/TagsManager.tsx
   Предложенные теги + кнопки одобрить/отклонить
   Таблица всех активных тегов с возможностью деактивации

7. Seed-скрипт backend/app/core/seed.py:
   - Создаёт admin-пользователя (email/пароль из .env: ADMIN_EMAIL, ADMIN_PASSWORD)
   - Загружает стартовый список тегов из CONTEXT.md
   - Запускается через: python -m app.core.seed
```

---

## 🧪 ПРОМПТ 8 — Тесты и Docker Compose

```
Прочитай CONTEXT.md и текущую структуру проекта.

1. backend/tests/ — pytest тесты с httpx AsyncClient:
   - tests/conftest.py: фикстуры (test DB, client, users каждой роли)
   - tests/test_auth.py: регистрация, логин, рефреш, логаут, верификация email
   - tests/test_opportunities.py: CRUD, поиск с фильтрами, геофильтр, кэш
   - tests/test_applications.py: подача отклика, смена статуса, права доступа
   - tests/test_curator.py: верификация работодателя, модерация карточки
   Используй pytest-asyncio, фабрику тестовых данных (factory_boy или простые фикстуры)

2. docker-compose.dev.yml — для локальной разработки:
   - backend с hot-reload (uvicorn --reload, volume ./backend:/app)
   - frontend с hot-reload (volume ./frontend:/app)
   - postgres с healthcheck
   - adminer на порту 8080 (для просмотра БД)
   - redis-commander на порту 8081

3. Makefile в корне с командами:
   - make dev         — запуск docker-compose.dev.yml
   - make migrate     — alembic upgrade head
   - make seed        — python -m app.core.seed
   - make test        — pytest backend/tests/
   - make lint        — ruff check backend/
   - make format      — ruff format backend/
```

