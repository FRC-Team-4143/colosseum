"""Manual scouting records. Shared across both workspaces — keyed by (event, match, team),
not by team_number — so 4143 and 4423 at one event pool their scouting. One row per
(event, match, team); last write wins, attributed to the SSO identity."""
import json

from fastapi import APIRouter, Depends
from pydantic import BaseModel
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import get_db
from app.models import ScoutEntry
from app.services.sso import require_member

router = APIRouter(prefix="/api/scouting", dependencies=[Depends(require_member)])


class EntryBody(BaseModel):
    values: dict


def serialize(entry: ScoutEntry) -> dict:
    return {
        "matchKey": entry.match_key,
        "team": entry.team,
        "values": json.loads(entry.values_json),
        "scoutName": entry.scout_name,
        "updatedAt": entry.updated_at.isoformat(),
    }


@router.get("/{event_key}")
async def list_for_event(event_key: str, db: AsyncSession = Depends(get_db)):
    rows = (
        await db.execute(select(ScoutEntry).where(ScoutEntry.event_key == event_key))
    ).scalars().all()
    return {"entries": [serialize(row) for row in rows]}


@router.get("/{event_key}/{match_key}/{team}")
async def get_entry(event_key: str, match_key: str, team: int, db: AsyncSession = Depends(get_db)):
    row = (
        await db.execute(
            select(ScoutEntry).where(
                ScoutEntry.event_key == event_key,
                ScoutEntry.match_key == match_key,
                ScoutEntry.team == team,
            )
        )
    ).scalars().first()
    return serialize(row) if row else {"matchKey": match_key, "team": team, "values": None}


@router.put("/{event_key}/{match_key}/{team}")
async def upsert_entry(
    event_key: str,
    match_key: str,
    team: int,
    body: EntryBody,
    identity: dict = Depends(require_member),
    db: AsyncSession = Depends(get_db),
):
    row = (
        await db.execute(
            select(ScoutEntry).where(
                ScoutEntry.event_key == event_key,
                ScoutEntry.match_key == match_key,
                ScoutEntry.team == team,
            )
        )
    ).scalars().first()
    if row is None:
        row = ScoutEntry(event_key=event_key, match_key=match_key, team=team)
        db.add(row)
    row.values_json = json.dumps(body.values)
    row.scout_name = identity.get("name") or ""
    row.scout_member_code = identity.get("member_code") or ""
    await db.commit()
    return serialize(row)
