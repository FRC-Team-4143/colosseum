from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    # extra="ignore": tolerate leftover keys in a deployed .env instead of failing to boot.
    model_config = SettingsConfigDict(
        env_file=".env", env_file_encoding="utf-8", extra="ignore"
    )

    database_url: str = "sqlite+aiosqlite:///./colosseum.db"

    # The Blue Alliance v3 — held server-side only, never shipped to the browser. Bundling
    # a read-only key client-side (the old web build's approach) just shared its rate
    # limit; centralizing it here also lets every signed-in device share one cache.
    tba_api_key: str = ""
    tba_ttl_fast: int = 120     # seconds — schedule/rankings/oprs/coprs/insights (change during play)
    tba_ttl_slow: int = 86400   # seconds — events list/detail, team list (essentially static)

    statbotics_enabled: bool = False

    # Legion SSO — every /api/* request needs a valid `mw_sso` cookie whose team_number is
    # in allowed_team_numbers. Colosseum only *verifies* the cookie; Legion mints it. There
    # is no separate admin/manager tier here — team_number IS the workspace.
    sso_secret: str = ""
    sso_session_ttl: int = 43200  # 12h; must match Legion's cookie max_age
    legion_base_url: str = ""     # e.g. "https://legion.marswars.org"
    legion_api_key: str = ""      # presented as X-API-Key to Legion's /api/members
    allowed_team_numbers: str = "4143,4423"

    # Public base URL, used to absolutize a relative return_to before handing it to Legion.
    base_url: str = "http://localhost:8005"

    timezone: str = "America/Chicago"

    # Database backups (SQLite only) — mirrors the sibling apps' convention.
    backup_dir: str = "backups"
    backup_keep: int = 14
    backup_time: str = "23:30"
    backup_day: str = "sun"


settings = Settings()
