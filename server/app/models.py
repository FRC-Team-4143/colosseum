from datetime import datetime
from typing import Optional

from sqlalchemy import Boolean, DateTime, Integer, String, Text
from sqlalchemy.orm import Mapped, mapped_column

from app.database import Base


class AppSetting(Base):
    """Small k/v store for cross-cutting values: the per-workspace current event, the
    Legion roster-sync watermark, and anything else not worth its own table."""
    __tablename__ = "app_settings"
    key: Mapped[str] = mapped_column(String(64), primary_key=True)
    value: Mapped[Optional[str]] = mapped_column(String(255), nullable=True)


class Member(Base):
    """Legion roster mirror. Data flows one way, Legion -> Colosseum, on an hourly pull;
    Colosseum never writes it back. NOT used for authorization — that's the live `mw_sso`
    cookie's `team_number` claim (see services/sso.py). Kept for future features (scout
    attribution lookups, rosters, leaderboards)."""
    __tablename__ = "members"
    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    member_code: Mapped[Optional[str]] = mapped_column(String(8), unique=True, nullable=True, index=True)
    name: Mapped[str] = mapped_column(String(200), nullable=False)
    team_number: Mapped[Optional[int]] = mapped_column(Integer, nullable=True)
    slack_user_id: Mapped[Optional[str]] = mapped_column(String(50), nullable=True)
    group_slugs: Mapped[Optional[str]] = mapped_column(String(500), nullable=True)  # comma-joined Legion slugs
    is_active: Mapped[bool] = mapped_column(Boolean, nullable=False, default=True, server_default="1")
    archived_at: Mapped[Optional[datetime]] = mapped_column(DateTime, nullable=True)


class TbaCache(Base):
    """Cached The Blue Alliance v3 responses, keyed by request path. See services/tba.py —
    a stale row is served rather than failing the request when TBA itself errors."""
    __tablename__ = "tba_cache"
    endpoint: Mapped[str] = mapped_column(String(255), primary_key=True)
    payload: Mapped[str] = mapped_column(Text, nullable=False)
    fetched_at: Mapped[datetime] = mapped_column(DateTime, nullable=False, default=datetime.utcnow)
