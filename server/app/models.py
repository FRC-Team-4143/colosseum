from datetime import datetime
from typing import Optional

from sqlalchemy import Boolean, DateTime, Integer, String, Text, UniqueConstraint
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


class PickListEntry(Base):
    """One team on a workspace's pick list for an event. Per-workspace (4143 and 4423 keep
    separate lists) and per-event. `position` is a dense 0-based order; `tag` is
    "" | "picked" | "dnp"."""
    __tablename__ = "pick_list_entries"
    __table_args__ = (UniqueConstraint("workspace", "event_key", "team", name="uq_pick_entry"),)
    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    workspace: Mapped[int] = mapped_column(Integer, nullable=False, index=True)
    event_key: Mapped[str] = mapped_column(String(20), nullable=False, index=True)
    team: Mapped[int] = mapped_column(Integer, nullable=False)
    position: Mapped[int] = mapped_column(Integer, nullable=False, default=0)
    note: Mapped[str] = mapped_column(Text, nullable=False, default="")
    tag: Mapped[str] = mapped_column(String(10), nullable=False, default="")
    updated_at: Mapped[datetime] = mapped_column(
        DateTime, nullable=False, default=datetime.utcnow, onupdate=datetime.utcnow
    )


class ScoutEntry(Base):
    """One manual scouting record for a team in a match. Shared across both workspaces
    (keyed by event + match + team, not by team_number) so 4143 and 4423 at the same
    event pool their scouting; last write wins. `values_json` holds the form values as
    defined by src/lib/scouting/schema.ts."""
    __tablename__ = "scout_entries"
    __table_args__ = (UniqueConstraint("event_key", "match_key", "team", name="uq_scout_entry"),)
    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    event_key: Mapped[str] = mapped_column(String(20), nullable=False, index=True)
    match_key: Mapped[str] = mapped_column(String(40), nullable=False)
    team: Mapped[int] = mapped_column(Integer, nullable=False, index=True)
    scout_name: Mapped[str] = mapped_column(String(120), nullable=False, default="")
    scout_member_code: Mapped[str] = mapped_column(String(8), nullable=False, default="")
    values_json: Mapped[str] = mapped_column(Text, nullable=False, default="{}")
    created_at: Mapped[datetime] = mapped_column(DateTime, nullable=False, default=datetime.utcnow)
    updated_at: Mapped[datetime] = mapped_column(
        DateTime, nullable=False, default=datetime.utcnow, onupdate=datetime.utcnow
    )


class TeamNote(Base):
    """A free-text scouting note about a team at an event. Shared by everyone at that
    event (keyed by event + team, not by workspace); last write wins."""
    __tablename__ = "team_notes"
    __table_args__ = (UniqueConstraint("event_key", "team", name="uq_team_note"),)
    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    event_key: Mapped[str] = mapped_column(String(20), nullable=False, index=True)
    team: Mapped[int] = mapped_column(Integer, nullable=False)
    body: Mapped[str] = mapped_column(Text, nullable=False, default="")
    updated_by: Mapped[str] = mapped_column(String(120), nullable=False, default="")
    updated_at: Mapped[datetime] = mapped_column(
        DateTime, nullable=False, default=datetime.utcnow, onupdate=datetime.utcnow
    )
