"""The per-workspace "current event" — the one piece of state that scopes the Schedule,
Teams, and Pick List views. Workspace is always derived server-side from the verified
`mw_sso` cookie's team_number; the client never sends a workspace id."""
from fastapi import APIRouter, Depends
from pydantic import BaseModel
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import get_db
from app.services.app_settings import get_setting, set_setting, workspace_event_key
from app.services.sso import require_member, workspace_of

router = APIRouter(prefix="/api/workspace", dependencies=[Depends(require_member)])


class SetEventBody(BaseModel):
    eventKey: str | None = None


@router.get("/event")
async def get_event(identity: dict = Depends(require_member), db: AsyncSession = Depends(get_db)):
    value = await get_setting(db, workspace_event_key(workspace_of(identity)))
    return {"eventKey": value}


@router.put("/event")
async def set_event(
    body: SetEventBody,
    identity: dict = Depends(require_member),
    db: AsyncSession = Depends(get_db),
):
    await set_setting(db, workspace_event_key(workspace_of(identity)), body.eventKey)
    return {"eventKey": body.eventKey}
