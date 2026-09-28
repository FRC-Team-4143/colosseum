"""Strategy whiteboards, stored per workspace (team_number). Everyone on a team sees that
team's boards; never the other team's. The board is an opaque JSON blob — the frontend's
positional match packet — which this router never parses beyond pulling `id` (slot 7) and
`tba_match_key` (slot 10) for indexing. Conflicts are last-write-wins with a staleness
signal: a PUT carrying `expectedUpdatedAt` that no longer matches gets a 409 (plus the
current server copy) so the client can warn before overwriting."""
import json
from datetime import datetime

from fastapi import APIRouter, Depends, HTTPException, Response
from pydantic import BaseModel
from sqlalchemy import delete, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import get_db
from app.models import Whiteboard
from app.services.sso import require_member, workspace_of

router = APIRouter(prefix="/api/whiteboards", dependencies=[Depends(require_member)])


def _packet_fields(packet: list) -> tuple[str, str | None]:
    """(id, tba_match_key) from the positional packet."""
    if not isinstance(packet, list) or len(packet) < 8 or not isinstance(packet[7], str):
        raise HTTPException(status_code=422, detail="Malformed packet")
    match_key = packet[10] if len(packet) > 10 and isinstance(packet[10], str) else None
    return packet[7], match_key


def serialize(board: Whiteboard) -> dict:
    return {
        "id": board.id,
        "packet": json.loads(board.packet_json),
        "updatedAt": board.updated_at.isoformat(),
    }


class SaveBody(BaseModel):
    packet: list
    expectedUpdatedAt: str | None = None


@router.get("")
async def list_boards(identity: dict = Depends(require_member), db: AsyncSession = Depends(get_db)):
    rows = (
        await db.execute(
            select(Whiteboard)
            .where(Whiteboard.workspace == workspace_of(identity))
            .order_by(Whiteboard.updated_at)
        )
    ).scalars().all()
    return {"boards": [serialize(row) for row in rows]}


@router.get("/{board_id}")
async def get_board(board_id: str, identity: dict = Depends(require_member), db: AsyncSession = Depends(get_db)):
    row = await _load(db, workspace_of(identity), board_id)
    if row is None:
        raise HTTPException(status_code=404, detail="No such board")
    return serialize(row)


@router.post("")
async def create_board(
    body: SaveBody, identity: dict = Depends(require_member), db: AsyncSession = Depends(get_db)
):
    """Create, or replace in place if the id already exists in this workspace (so a
    re-import of the same match is idempotent rather than a 409)."""
    workspace = workspace_of(identity)
    board_id, match_key = _packet_fields(body.packet)
    row = await _load(db, workspace, board_id)
    if row is None:
        row = Whiteboard(id=board_id, workspace=workspace)
        db.add(row)
    row.tba_match_key = match_key
    row.packet_json = json.dumps(body.packet)
    row.updated_by = identity.get("name") or ""
    await db.commit()
    await db.refresh(row)
    return serialize(row)


@router.put("/{board_id}")
async def update_board(
    board_id: str,
    body: SaveBody,
    identity: dict = Depends(require_member),
    db: AsyncSession = Depends(get_db),
):
    workspace = workspace_of(identity)
    row = await _load(db, workspace, board_id)
    if row is None:
        raise HTTPException(status_code=404, detail="No such board")
    if body.expectedUpdatedAt is not None and body.expectedUpdatedAt != row.updated_at.isoformat():
        raise HTTPException(
            status_code=409,
            detail={"message": "This board was changed on another device", "current": serialize(row)},
        )
    _, match_key = _packet_fields(body.packet)
    row.tba_match_key = match_key
    row.packet_json = json.dumps(body.packet)
    row.updated_by = identity.get("name") or ""
    row.updated_at = datetime.utcnow()
    await db.commit()
    await db.refresh(row)
    return serialize(row)


@router.delete("/{board_id}", status_code=204)
async def delete_board(board_id: str, identity: dict = Depends(require_member), db: AsyncSession = Depends(get_db)):
    await db.execute(
        delete(Whiteboard).where(
            Whiteboard.workspace == workspace_of(identity), Whiteboard.id == board_id
        )
    )
    await db.commit()
    return Response(status_code=204)


@router.delete("", status_code=204)
async def clear_boards(identity: dict = Depends(require_member), db: AsyncSession = Depends(get_db)):
    await db.execute(delete(Whiteboard).where(Whiteboard.workspace == workspace_of(identity)))
    await db.commit()
    return Response(status_code=204)


async def _load(db: AsyncSession, workspace: int, board_id: str) -> Whiteboard | None:
    return (
        await db.execute(
            select(Whiteboard).where(Whiteboard.workspace == workspace, Whiteboard.id == board_id)
        )
    ).scalars().first()
