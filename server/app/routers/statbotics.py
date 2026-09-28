"""Optional Statbotics EPA. Always safe to call — returns `{}` when the integration is
off or Statbotics is unreachable (see services/statbotics.py)."""
from fastapi import APIRouter, Depends
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import get_db
from app.services import statbotics
from app.services.sso import require_member

router = APIRouter(prefix="/api/statbotics", dependencies=[Depends(require_member)])


@router.get("/event/{event_key}")
async def event_epa(event_key: str, db: AsyncSession = Depends(get_db)):
    return await statbotics.event_epa(db, event_key)
