"""Free-text scouting notes about a team at an event. Shared across both workspaces —
keyed by (event, team), not by team_number — so 4143 and 4423 at the same event see the
same notes. Last write wins."""
from fastapi import APIRouter, Depends
from pydantic import BaseModel
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import get_db
from app.models import TeamNote
from app.services.sso import require_member

router = APIRouter(prefix="/api/notes", dependencies=[Depends(require_member)])


class NoteBody(BaseModel):
    body: str = ""


@router.get("/{event_key}/{team}")
async def get_note(event_key: str, team: int, db: AsyncSession = Depends(get_db)):
    row = (
        await db.execute(
            select(TeamNote).where(TeamNote.event_key == event_key, TeamNote.team == team)
        )
    ).scalars().first()
    return {"body": row.body if row else "", "updatedBy": row.updated_by if row else None}


@router.put("/{event_key}/{team}")
async def put_note(
    event_key: str,
    team: int,
    payload: NoteBody,
    identity: dict = Depends(require_member),
    db: AsyncSession = Depends(get_db),
):
    row = (
        await db.execute(
            select(TeamNote).where(TeamNote.event_key == event_key, TeamNote.team == team)
        )
    ).scalars().first()
    if row is None:
        row = TeamNote(event_key=event_key, team=team)
        db.add(row)
    row.body = payload.body
    row.updated_by = identity.get("name") or identity.get("member_code") or ""
    await db.commit()
    return {"body": row.body, "updatedBy": row.updated_by}
