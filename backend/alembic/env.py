import asyncio
import os
from logging.config import fileConfig

from sqlalchemy import pool
from sqlalchemy.engine import Connection
from sqlalchemy.ext.asyncio import async_engine_from_config

from alembic import context

# ── Import Base and all models so Alembic can auto-detect schema changes ──────
from app.models.base import Base
import app.models  # noqa: F401 — side-effect: registers all Table metadata

# ── Alembic config object ─────────────────────────────────────────────────────
config = context.config

if config.config_file_name is not None:
    fileConfig(config.config_file_name)

target_metadata = Base.metadata

# Read DATABASE_URL directly from environment to avoid pydantic reading
# the .env file (which has localhost) instead of the Docker-injected value.
_db_url = os.environ.get("DATABASE_URL")
if not _db_url:
    from app.core.config import settings
    _db_url = settings.DATABASE_URL
config.set_main_option("sqlalchemy.url", _db_url)


# ── Offline mode (generate SQL script without DB connection) ──────────────────
def run_migrations_offline() -> None:
    url = config.get_main_option("sqlalchemy.url")
    context.configure(
        url=url,
        target_metadata=target_metadata,
        literal_binds=True,
        dialect_opts={"paramstyle": "named"},
        # Render server_default values so they appear in generated SQL
        render_as_batch=False,
    )
    with context.begin_transaction():
        context.run_migrations()


# ── Online mode (connect and migrate) ─────────────────────────────────────────
def do_run_migrations(connection: Connection) -> None:
    context.configure(
        connection=connection,
        target_metadata=target_metadata,
        # Compare server_default values during autogenerate
        compare_server_default=True,
    )
    with context.begin_transaction():
        context.run_migrations()


async def run_async_migrations() -> None:
    connectable = async_engine_from_config(
        config.get_section(config.config_ini_section, {}),
        prefix="sqlalchemy.",
        poolclass=pool.NullPool,
    )
    async with connectable.connect() as connection:
        await connection.run_sync(do_run_migrations)
    await connectable.dispose()


def run_migrations_online() -> None:
    asyncio.run(run_async_migrations())


if context.is_offline_mode():
    run_migrations_offline()
else:
    run_migrations_online()
