# Трамплин — Project Context

> Этот файл читается Claude в VS Code автоматически (CLAUDE.md) или вручную как контекст.
> Обновляй его по мере принятия новых архитектурных решений.

---

## О проекте

**Трамплин** — карьерная платформа для студентов, выпускников и работодателей в IT.
Централизованное взаимодействие: вакансии, стажировки, менторские программы, карьерные мероприятия.

---

## Стек

| Слой | Технология |
|------|-----------|
| Фронтенд | React + Next.js 14 (App Router, SSR) |
| Стили | Tailwind CSS |
| Карта | Яндекс Карты JS API v3 |
| Бэкенд | Python 3.12 + FastAPI |
| ORM | SQLAlchemy 2.0 (async) |
| Миграции | Alembic |
| БД | PostgreSQL 16 + PostGIS |
| Кэш / сессии | Redis 7 |
| Хранилище медиа | S3-совместимое (MinIO локально) |
| Аутентификация | JWT в httpOnly cookie (access 15 мин, refresh 30 дней) |
| Контейнеризация | Docker + Docker Compose |

---

## Структура монорепо

```
tramplин/
├── backend/
│   ├── app/
│   │   ├── api/          # роутеры FastAPI (v1/)
│   │   ├── core/         # config, security, dependencies
│   │   ├── models/       # SQLAlchemy модели
│   │   ├── schemas/      # Pydantic схемы (request/response)
│   │   ├── services/     # бизнес-логика
│   │   ├── repositories/ # слой работы с БД
│   │   └── main.py
│   ├── alembic/
│   ├── tests/
│   ├── Dockerfile
│   └── requirements.txt
├── frontend/
│   ├── src/
│   │   ├── app/          # Next.js App Router страницы
│   │   ├── components/   # переиспользуемые компоненты
│   │   ├── lib/          # api-клиент, утилиты
│   │   ├── hooks/        # кастомные хуки
│   │   └── types/        # TypeScript типы
│   ├── public/
│   ├── Dockerfile
│   └── package.json
├── docker-compose.yml
├── docker-compose.dev.yml
└── CONTEXT.md
```

---

## Роли пользователей

| Роль | Описание |
|------|----------|
| `guest` | Неавторизованный. Просмотр карты/списка, фильтры, избранное в localStorage |
| `seeker` | Соискатель. Профиль, резюме, отклики, контакты, приватность |
| `employer` | Работодатель. Карточки вакансий, отклики, поиск кандидатов. Требует верификации |
| `curator` | Куратор. Модерация, верификация компаний, управление тегами |
| `admin` | Администратор (суперкуратор). Создаёт других кураторов. Один по умолчанию |

---

## Схема БД (ключевые таблицы)

### users
```sql
id          UUID PRIMARY KEY DEFAULT gen_random_uuid()
email       VARCHAR(255) UNIQUE NOT NULL
display_name VARCHAR(100) NOT NULL
password_hash VARCHAR(255) NOT NULL
role        ENUM('guest','seeker','employer','curator','admin') NOT NULL
is_active   BOOLEAN DEFAULT false  -- активируется после подтверждения email
created_at  TIMESTAMP DEFAULT now()
```

### seeker_profiles
```sql
id              UUID PRIMARY KEY
user_id         UUID FK → users.id UNIQUE
full_name       VARCHAR(200)
university      VARCHAR(200)
graduation_year SMALLINT
bio             TEXT
skills          JSONB  -- ['Python', 'FastAPI', ...]
links           JSONB  -- {github: '', linkedin: ''}
privacy         ENUM('private','contacts','public') DEFAULT 'contacts'
```

### employer_profiles
```sql
id                  UUID PRIMARY KEY
user_id             UUID FK → users.id UNIQUE
company_name        VARCHAR(200) NOT NULL
inn                 VARCHAR(12)
sphere              VARCHAR(200)
description         TEXT
website             VARCHAR(500)
corporate_email     VARCHAR(255)  -- домен ≠ gmail/mail/yandex
verification_status ENUM('pending','verified','rejected') DEFAULT 'pending'
verified_at         TIMESTAMP
verified_by         UUID FK → users.id  -- куратор
```

### opportunities
```sql
id           UUID PRIMARY KEY
employer_id  UUID FK → employer_profiles.id
title        VARCHAR(300) NOT NULL
description  TEXT
type         ENUM('vacancy','internship','mentorship','event') NOT NULL
format       ENUM('office','hybrid','remote') NOT NULL
city         VARCHAR(200)
address      VARCHAR(500)          -- для офлайн
geo_point    GEOMETRY(Point,4326)  -- PostGIS, для офлайн
salary_min   NUMERIC(12,2)
salary_max   NUMERIC(12,2)
published_at TIMESTAMP DEFAULT now()
expires_at   TIMESTAMP             -- дедлайн или дата события
status       ENUM('draft','moderation','active','closed') DEFAULT 'draft'
search_vector TSVECTOR             -- для pg FTS, обновляется триггером
```

### tags
```sql
id         UUID PRIMARY KEY
name       VARCHAR(100) UNIQUE NOT NULL
category   ENUM('language','framework','level','employment','direction')
created_by UUID FK → users.id
is_active  BOOLEAN DEFAULT true
```

### opportunity_tags
```sql
opportunity_id UUID FK → opportunities.id
tag_id         UUID FK → tags.id
PRIMARY KEY (opportunity_id, tag_id)
```

### applications
```sql
id             UUID PRIMARY KEY
seeker_id      UUID FK → seeker_profiles.id
opportunity_id UUID FK → opportunities.id
status         ENUM('submitted','reviewed','accepted','rejected','reserve') DEFAULT 'submitted'
applied_at     TIMESTAMP DEFAULT now()
UNIQUE (seeker_id, opportunity_id)
```

### contacts (профессиональные контакты соискателей)
```sql
seeker_id   UUID FK → seeker_profiles.id
contact_id  UUID FK → seeker_profiles.id
status      ENUM('pending','accepted') DEFAULT 'pending'
created_at  TIMESTAMP DEFAULT now()
PRIMARY KEY (seeker_id, contact_id)
```

### favorites
```sql
user_id        UUID FK → users.id
opportunity_id UUID FK → opportunities.id
created_at     TIMESTAMP DEFAULT now()
PRIMARY KEY (user_id, opportunity_id)
```

---

## API — ключевые эндпоинты

```
POST   /api/v1/auth/register          — регистрация (role: seeker | employer)
POST   /api/v1/auth/login             — вход, устанавливает httpOnly cookie
POST   /api/v1/auth/logout            — очистка cookie
POST   /api/v1/auth/refresh           — обновление access token
GET    /api/v1/auth/verify-email/{token}

GET    /api/v1/opportunities          — список/карта (публичный, с фильтрами)
GET    /api/v1/opportunities/{id}     — карточка возможности
POST   /api/v1/opportunities          — создание (employer)
PATCH  /api/v1/opportunities/{id}     — редактирование (employer | curator)
DELETE /api/v1/opportunities/{id}     — удаление (employer | curator)

POST   /api/v1/applications           — откликнуться (seeker)
PATCH  /api/v1/applications/{id}      — изменить статус (employer)
GET    /api/v1/applications/my        — мои отклики (seeker)

GET    /api/v1/profile/seeker         — мой профиль (seeker)
PATCH  /api/v1/profile/seeker         — обновить профиль
GET    /api/v1/profile/employer       — профиль компании (employer)
PATCH  /api/v1/profile/employer       — обновить профиль

GET    /api/v1/tags                   — список тегов (публичный)
POST   /api/v1/tags                   — предложить тег (employer)
PATCH  /api/v1/tags/{id}              — одобрить/отклонить (curator)

GET    /api/v1/curator/queue          — очереди верификации и модерации (curator)
PATCH  /api/v1/curator/employers/{id} — верифицировать компанию
PATCH  /api/v1/curator/opportunities/{id} — модерировать карточку

GET    /api/v1/contacts               — мои контакты (seeker)
POST   /api/v1/contacts/{id}          — запрос контакта
PATCH  /api/v1/contacts/{id}          — принять/отклонить

GET    /api/v1/favorites              — избранное (auth)
POST   /api/v1/favorites/{opp_id}     — добавить
DELETE /api/v1/favorites/{opp_id}     — убрать
```

---

## Алгоритм поиска и фильтрации

1. Принять параметры: `q`, `type`, `format`, `salary_min`, `salary_max`, `tags[]`, `lat`, `lng`, `radius_km`, `city`, `sort`, `cursor`
2. Фильтр по статусу `active` и `expires_at > now()`
3. Геофильтр:
   - офлайн/гибрид: `ST_DWithin(geo_point, ST_MakePoint(lng,lat)::geography, radius_km*1000)`
   - удалённо: `city ILIKE %city%`
4. Полнотекстовый поиск: `search_vector @@ plainto_tsquery('russian', q)` при наличии `q`
5. Фильтр по тегам: `opportunity_id IN (SELECT ... WHERE tag_id = ANY(tags[]))`
6. Сортировка: по релевантности (`ts_rank`) или дате или зарплате
7. Проверка кэша Redis: ключ `search:{hash(params)}`, TTL 60 сек
8. Пагинация cursor-based: `WHERE published_at < cursor_value LIMIT 20`
9. Ответ: `{items: [...], next_cursor, total_count, geo_json}`

---

## Аутентификация (JWT + httpOnly cookie)

- Access token: JWT, TTL 15 минут, в httpOnly cookie `access_token`
- Refresh token: JWT, TTL 30 дней, в httpOnly cookie `refresh_token`, хранится hash в Redis
- При логине: оба токена устанавливаются как httpOnly, Secure, SameSite=Lax
- Middleware FastAPI: извлекает токен из cookie, валидирует, прокидывает `current_user`
- Ротация refresh: при использовании выдаётся новый, старый инвалидируется в Redis

---

## Верификация работодателей

1. При регистрации: корпоративный email (домен не из списка: gmail, mail, yandex, inbox, bk, list, rambler, outlook, hotmail)
2. Система: отправляет письмо на корпоративный адрес со ссылкой подтверждения
3. После подтверждения email: заявка попадает в очередь куратора (`verification_status = pending`)
4. Куратор видит: название компании, ИНН, корп. email, ссылки на профили
5. Куратор одобряет → `verified`, отклоняет → `rejected` с указанием причины
6. До верификации: профиль заполняется, но кнопка «Опубликовать» заблокирована

---

## Модерация карточек

- Новая карточка от работодателя → статус `moderation`
- Автопроверка: непустые title, description, expires_at > now(), geo_point или city заполнен
- Куратор одобряет → `active` (карточка появляется на карте и в списке)
- Куратор отклоняет → `draft` с комментарием
- При редактировании активной карточки → снова `moderation`

---

## Главная страница

- Два режима: карта (Яндекс Карты JS API v3) и список (лента)
- Маркеры на карте: обычные (серые), избранные компании (янтарные)
- При наведении на маркер: модульная карточка (title, company, type, salary_min–max, формат, теги до 3 шт.)
- Фильтры: тип, формат, зарплата (range), теги (мультиселект), поиск по тексту
- Гости: избранное в localStorage, синхронизируется в БД при регистрации

---

## Соглашения по коду

- Python: snake_case, type hints везде, async/await для всех DB операций
- Pydantic v2 для схем, `model_config = ConfigDict(from_attributes=True)`
- Репозиторий-паттерн: вся работа с БД через `repositories/`, сервисы не импортируют `Session` напрямую
- Next.js: Server Components по умолчанию, Client Components только при необходимости (карта, интерактивные формы)
- TypeScript strict mode
- Все даты в UTC, на фронте конвертируются в локаль пользователя
- Переменные окружения: `.env` в корне, `pydantic-settings` на бэке, `next.config.js` на фронте

---

## Переменные окружения (.env)

```env
# Backend
DATABASE_URL=postgresql+asyncpg://user:pass@localhost:5432/tramplин
REDIS_URL=redis://localhost:6379/0
SECRET_KEY=changeme_very_long_secret
ACCESS_TOKEN_EXPIRE_MINUTES=15
REFRESH_TOKEN_EXPIRE_DAYS=30
SMTP_HOST=smtp.example.com
SMTP_PORT=587
SMTP_USER=noreply@tramplин.ru
SMTP_PASSWORD=
S3_ENDPOINT=http://localhost:9000
S3_BUCKET=tramplин
S3_ACCESS_KEY=
S3_SECRET_KEY=
YANDEX_MAPS_API_KEY=        # только на фронте

# Frontend (NEXT_PUBLIC_ — публичные)
NEXT_PUBLIC_API_URL=http://localhost:8000
NEXT_PUBLIC_YANDEX_MAPS_API_KEY=
```

---

## Стартовые теги (seeds)

**Языки:** Python, JavaScript, TypeScript, Java, Go, Kotlin, Swift, C++, C#, Rust, PHP, Ruby
**Фреймворки/инструменты:** React, Next.js, Vue, FastAPI, Django, Spring, Node.js, Docker, Kubernetes, PostgreSQL, MongoDB, Redis, Git, Linux
**Уровень:** Intern, Junior, Middle, Senior
**Занятость:** Полная, Частичная, Проектная
**Направление:** Backend, Frontend, Fullstack, DevOps, ML/AI, Data, Mobile, QA, Design, Product
