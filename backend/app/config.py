"""Runtime settings.

Validates that production deployments don't ship with placeholder secrets,
wildcard CORS combined with credentials, or other obvious misconfigurations.
"""
from __future__ import annotations

import re
from functools import lru_cache

from pydantic import field_validator, model_validator
from pydantic_settings import BaseSettings, SettingsConfigDict


# Tokens that look like example/template values rather than real secrets.
# Anything matching these in production is treated as a fatal misconfiguration.
_PLACEHOLDER_PATTERNS: tuple[re.Pattern[str], ...] = (
    re.compile(r"change[-_ ]?me", re.IGNORECASE),
    re.compile(r"your[-_ ]?(super[-_ ]?)?secret", re.IGNORECASE),
    re.compile(r"^xxx+$", re.IGNORECASE),
    re.compile(r"^placeholder", re.IGNORECASE),
    re.compile(r"^example\.com", re.IGNORECASE),
)

_PLACEHOLDER_LITERALS = {
    "user:pass@host",
    "your-app.vercel.app",
    "public_xxxxxxxxxxxx",
    "private_xxxxxxxxxxxx",
    "https://ik.imagekit.io/your_id",
}


def _is_placeholder(value: str) -> bool:
    if not value:
        return True
    if any(literal in value for literal in _PLACEHOLDER_LITERALS):
        return True
    return any(p.search(value) for p in _PLACEHOLDER_PATTERNS)


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=".env", case_sensitive=True, extra="ignore")

    # If unset, treated as production (Render, etc.). Set ENVIRONMENT=development
    # locally to allow weaker config (placeholder secrets, wildcard CORS, etc).
    ENVIRONMENT: str = "production"

    DATABASE_URL: str
    SYNC_DATABASE_URL: str
    REDIS_URL: str = "redis://redis:6379/0"

    JWT_SECRET: str
    JWT_ALGORITHM: str = "HS256"
    ACCESS_TOKEN_EXPIRE_MINUTES: int = 15
    REFRESH_TOKEN_EXPIRE_DAYS: int = 7

    IMAGEKIT_PUBLIC_KEY: str
    IMAGEKIT_PRIVATE_KEY: str
    IMAGEKIT_URL_ENDPOINT: str

    CORS_ORIGINS: str = "http://localhost:3000"
    CORS_ALLOW_CREDENTIALS: bool = True
    RATE_LIMIT_DEFAULT: str = "60/minute"

    @property
    def is_production(self) -> bool:
        return self.ENVIRONMENT.lower() in {"production", "prod", "live"}

    @property
    def cors_origins_list(self) -> list[str]:
        return [o.strip() for o in self.CORS_ORIGINS.split(",") if o.strip()]

    @field_validator("JWT_SECRET")
    @classmethod
    def _validate_jwt_secret(cls, v: str) -> str:
        if len(v) < 32:
            raise ValueError("JWT_SECRET must be at least 32 chars (use `openssl rand -hex 32`).")
        return v

    @model_validator(mode="after")
    def _validate_no_placeholders_in_production(self) -> "Settings":
        if not self.is_production:
            return self

        secret_fields = {
            "DATABASE_URL": self.DATABASE_URL,
            "SYNC_DATABASE_URL": self.SYNC_DATABASE_URL,
            "REDIS_URL": self.REDIS_URL,
            "JWT_SECRET": self.JWT_SECRET,
            "IMAGEKIT_PUBLIC_KEY": self.IMAGEKIT_PUBLIC_KEY,
            "IMAGEKIT_PRIVATE_KEY": self.IMAGEKIT_PRIVATE_KEY,
            "IMAGEKIT_URL_ENDPOINT": self.IMAGEKIT_URL_ENDPOINT,
        }
        bad = [name for name, value in secret_fields.items() if _is_placeholder(value)]
        if bad:
            raise ValueError(
                "Refusing to start: these env vars contain placeholder/example values "
                f"in production: {', '.join(bad)}. Set real secrets via your deploy "
                "platform (Render/EAS/etc) or run with ENVIRONMENT=development locally."
            )
        return self

    @model_validator(mode="after")
    def _validate_cors(self) -> "Settings":
        origins = self.cors_origins_list
        has_wildcard = "*" in origins or self.CORS_ORIGINS.strip() == "*"

        if has_wildcard and self.CORS_ALLOW_CREDENTIALS:
            raise ValueError(
                "CORS_ORIGINS='*' cannot be combined with CORS_ALLOW_CREDENTIALS=true: "
                "browsers reject `Access-Control-Allow-Origin: *` for credentialed "
                "requests. Either provide an explicit comma-separated allowlist of "
                "origins, or set CORS_ALLOW_CREDENTIALS=false."
            )
        if self.is_production and has_wildcard:
            raise ValueError(
                "CORS_ORIGINS='*' is not allowed in production. Provide an explicit "
                "comma-separated list of trusted origins (e.g. https://app.example.com)."
            )
        if self.is_production and not origins:
            raise ValueError(
                "CORS_ORIGINS must be set to at least one origin in production."
            )
        return self


@lru_cache
def get_settings() -> Settings:
    return Settings()


# Allow tests / scripts to construct Settings without populating env. Production
# import path always validates because ENVIRONMENT defaults to 'production'.
settings = get_settings()


__all__ = ["Settings", "get_settings", "settings"]
