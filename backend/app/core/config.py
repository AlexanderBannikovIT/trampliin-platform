from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(
        env_file=".env",
        env_file_encoding="utf-8",
        extra="ignore",
    )

    # Database
    DATABASE_URL: str = "postgresql+asyncpg://trampliin:changeme@localhost:5432/trampliin"

    # Redis
    REDIS_URL: str = "redis://localhost:6379/0"

    # JWT
    SECRET_KEY: str = "changeme_very_long_secret_at_least_32_chars"
    ALGORITHM: str = "HS256"
    ACCESS_TOKEN_EXPIRE_MINUTES: int = 15
    REFRESH_TOKEN_EXPIRE_DAYS: int = 30

    # SMTP
    SMTP_HOST: str = ""
    SMTP_PORT: int = 587
    SMTP_USER: str = ""
    SMTP_PASSWORD: str = ""

    # S3 / MinIO
    S3_ENDPOINT: str = "http://localhost:9000"
    S3_BUCKET: str = "trampliin"
    S3_ACCESS_KEY: str = "minioadmin"
    S3_SECRET_KEY: str = "minioadmin"

    # CORS
    CORS_ORIGINS: list[str] = ["http://localhost:3000"]

    # App
    APP_TITLE: str = "Трамплин API"
    APP_VERSION: str = "1.0.0"
    APP_BASE_URL: str = "http://localhost:8000"
    FRONTEND_URL: str = "http://localhost:3000"
    APP_ENV: str = "development"  # "production" enables Secure cookie flag
    DEBUG: bool = True

    # Admin seed credentials
    ADMIN_EMAIL: str = "admin@trampliin.ru"
    ADMIN_PASSWORD: str = "changeme_admin_password"
    ADMIN_DISPLAY_NAME: str = "Администратор"

    # Blocked email domains for employer registration
    PERSONAL_EMAIL_DOMAINS: list[str] = [
        "gmail.com", "mail.ru", "yandex.ru", "inbox.ru",
        "bk.ru", "list.ru", "rambler.ru", "outlook.com",
        "hotmail.com",
    ]


settings = Settings()
