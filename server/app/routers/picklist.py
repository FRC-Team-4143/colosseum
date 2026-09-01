"""A workspace's alliance-selection pick list for an event. Per-workspace (4143 and 4423
keep their own) and per-event; a simple ordered list of teams with a note and an optional
picked / do-not-pick tag. Workspace comes from the SSO cookie; the event is an explicit
query param so a list survives the workspace switching events."""
from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import get_db
from app.models import PickListEntry
from app.services.sso import require_member, workspace_of

router = APIRouter(prefix="/api/picklist", dependencies=[Depends(require_member)])

TAGS = {"", "picked", "dnp"}


def serialize(entry: PickListEntry) -> dict:
    return {"team": entry.team, "position": entry.position, "note": entry.note, "tag": entry.tag}


async def _entries(db: AsyncSession, workspace: int, event: str) -> list[PickListEntry]:
    return list(
        (
            await db.execute(
                select(PickListEntry)
                .where(PickListEntry.workspace == workspace, PickListEntry.event_key == event)
                .order_by(PickListEntry.position)
            )
        ).scalars().all()
    )


class AddBody(BaseModel):
    event: str
    team: int


class PatchBody(BaseModel):
    note: str | None = None
    tag: str | None = None


class ReorderBody(BaseModel):
    teams: list[int]


@router.get("")
async def get_list(event: str, identity: dict = Depends(require_member), db: AsyncSession = Depends(get_db)):
    rows = await _entries(db, workspace_of(identity), event)
    return {"entries": [serialize(row) for row in rows]}


@router.post("/entries")
async def add_entry(body: AddBody, identity: dict = Depends(require_member), db: AsyncSession = Depends(get_db)):
    workspace = workspace_of(identity)
    rows = await _entries(db, workspace, body.event)
    if any(row.team == body.team for row in rows):
        return {"entries": [serialize(row) for row in rows]}
    db.add(PickListEntry(workspace=workspace, event_key=body.event, team=body.team, position=len(rows)))
    await db.commit()
    return {"entries": [serialize(row) for row in await _entries(db, workspace, body.event)]}


@router.patch("/entries/{team}")
async def patch_entry(
    team: int,
    event: str,
    body: PatchBody,
    identity: dict = Depends(require_member),
    db: AsyncSession = Depends(get_db),
):
    workspace = workspace_of(identity)
    row = (
        await db.execute(
            select(PickListEntry).where(
                PickListEntry.workspace == workspace,
                PickListEntry.event_key == event,
                PickListEntry.team == team,
            )
        )
    ).scalars().first()
    if row is None:
        raise HTTPException(status_code=404, detail="Not on the pick list")
    if body.note is not None:
        row.note = body.note
    if body.tag is not None:
        if body.tag not in TAGS:
            raise HTTPException(status_code=422, detail="Bad tag")
        row.tag = body.tag
    await db.commit()
    return {"entries": [serialize(r) for r in await _entries(db, workspace, event)]}


@router.delete("/entries/{team}")
async def delete_entry(
    team: int, event: str, identity: dict = Depends(require_member), db: AsyncSession = Depends(get_db)
):
    workspace = workspace_of(identity)
    rows = await _entries(db, workspace, event)
    kept = [row for row in rows if row.team != team]
    for row in rows:
        if row.team == team:
            await db.delete(row)
    for index, row in enumerate(kept):
        row.position = index
    await db.commit()
    return {"entries": [serialize(row) for row in await _entries(db, workspace, event)]}


@router.post("/reorder")
async def reorder(
    event: str,
    body: ReorderBody,
    identity: dict = Depends(require_member),
    db: AsyncSession = Depends(get_db),
):
    workspace = workspace_of(identity)
    rows = await _entries(db, workspace, event)
    order = {team: index for index, team in enumerate(body.teams)}
    for row in rows:
        if row.team in order:
            row.position = order[row.team]
    await db.commit()
    return {"entries": [serialize(row) for row in await _entries(db, workspace, event)]}
