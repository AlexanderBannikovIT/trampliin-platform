.PHONY: dev prod migrate seed test lint format shell logs

# ── Local development ──────────────────────────────────────────────────────────

dev:
	docker compose -f docker-compose.dev.yml up --build

dev-down:
	docker compose -f docker-compose.dev.yml down

prod:
	docker compose up --build

# ── Database ───────────────────────────────────────────────────────────────────

migrate:
	docker compose -f docker-compose.dev.yml exec backend alembic upgrade head

migrate-local:
	cd backend && alembic upgrade head

seed:
	docker compose -f docker-compose.dev.yml exec backend python -m app.core.seed

seed-local:
	cd backend && python -m app.core.seed

# ── Tests ──────────────────────────────────────────────────────────────────────

test:
	cd backend && pytest tests/ -v

test-cov:
	cd backend && pytest tests/ -v --tb=short --cov=app --cov-report=term-missing

# ── Lint & format ──────────────────────────────────────────────────────────────

lint:
	cd backend && ruff check app/ tests/

format:
	cd backend && ruff format app/ tests/

lint-fix:
	cd backend && ruff check --fix app/ tests/

# ── Docker utilities ───────────────────────────────────────────────────────────

logs:
	docker compose -f docker-compose.dev.yml logs -f backend

shell:
	docker compose -f docker-compose.dev.yml exec backend bash

psql:
	docker compose -f docker-compose.dev.yml exec postgres psql -U trampliin -d trampliin
