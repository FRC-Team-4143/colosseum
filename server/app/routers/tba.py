"""Thin, cached pass-throughs of The Blue Alliance v3. Year-specific bodies (insights,
coprs, score breakdowns in matches) are returned raw — the frontend renders them
generically rather than this router trying to model every game's schema."""
from fastapi import APIRouter, Depends
from sqlalchemy.ext.asyncio import AsyncSession

from app.config import settings
from app.database import get_db
from app.services import tba
from app.services.sso import require_member

router = APIRouter(prefix="/api/tba", dependencies=[Depends(require_member)])


@router.get("/events")
async def events(year: int, db: AsyncSession = Depends(get_db)):
    return await tba.get(db, f"/events/{year}", ttl=settings.tba_ttl_slow)


@router.get("/event/{event_key}")
async def event(event_key: str, db: AsyncSession = Depends(get_db)):
    return await tba.get(db, f"/event/{event_key}", ttl=settings.tba_ttl_slow)


@router.get("/event/{event_key}/matches")
async def matches(event_key: str, db: AsyncSession = Depends(get_db)):
    return await tba.get(db, f"/event/{event_key}/matches", ttl=settings.tba_ttl_fast)


@router.get("/event/{event_key}/teams")
async def teams(event_key: str, db: AsyncSession = Depends(get_db)):
    return await tba.get(db, f"/event/{event_key}/teams/simple", ttl=settings.tba_ttl_slow)


@router.get("/event/{event_key}/rankings")
async def rankings(event_key: str, db: AsyncSession = Depends(get_db)):
    return await tba.get(db, f"/event/{event_key}/rankings", ttl=settings.tba_ttl_fast)


@router.get("/event/{event_key}/oprs")
async def oprs(event_key: str, db: AsyncSession = Depends(get_db)):
    return await tba.get(db, f"/event/{event_key}/oprs", ttl=settings.tba_ttl_fast)


@router.get("/event/{event_key}/coprs")
async def coprs(event_key: str, db: AsyncSession = Depends(get_db)):
    return await tba.get(db, f"/event/{event_key}/coprs", ttl=settings.tba_ttl_fast)


@router.get("/event/{event_key}/insights")
async def insights(event_key: str, db: AsyncSession = Depends(get_db)):
    return await tba.get(db, f"/event/{event_key}/insights", ttl=settings.tba_ttl_fast)
