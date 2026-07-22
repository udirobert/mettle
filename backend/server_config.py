"""Configuration guards for the standalone Mettle agent server."""

from __future__ import annotations

import os
from collections.abc import Mapping


def allowed_origins(environment: Mapping[str, str] | None = None) -> list[str]:
    """Return browser origins, requiring an explicit allowlist in production."""
    env = os.environ if environment is None else environment
    configured = env.get("CORS_ALLOWED_ORIGINS", "")
    origins = [origin.strip() for origin in configured.split(",") if origin.strip()]
    if origins:
        return origins

    if env.get("METTLE_ENV", "development").lower() == "production":
        raise RuntimeError(
            "CORS_ALLOWED_ORIGINS must be set when METTLE_ENV=production."
        )

    return ["http://localhost:3000", "http://127.0.0.1:3000"]
