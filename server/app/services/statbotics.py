"""
Statbotics EPA — best effort and fail-soft. The user flagged this API as flaky, so every
path here is wrapped: a network error, a schema change, a non-200, an empty result — all
collapse to `{}` and the EPA column simply doesn't render. It never blocks TBA data or
anything else. Off by default (`settings.statbotics_enabled`).

Response is `{ "<team number>": <epa total points> }`. Cached in the same table as TBA
responses so the prune job keeps it tidy.
"""
import json
import logging
from datetime import datetime, timedelta

import httpx
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.config import settings
from app.models import TbaCache

log = logging.getLogger(__name__)

STATBOTICS_BASE = "https://api.statbotics.io/v3"
CACHE_TTL = timedelta(minutes=30)


async def event_epa(db: AsyncSession, event_key: str) -> dict[str, float]:
    if not settings.statbotics_enabled:
        return {}

    cache_key = f"statbotics:event/{event_key}"
    row = (await db.execute(select(TbaCache).where(TbaCache.endpoint == cache_key))).scalars().first()
    if row and datetime.utcnow() - row.fetched_at < CACHE_TTL:
        try:
            return json.loads(row.payload)
        except ValueError:
            pass

    try:
        async with httpx.AsyncClient(base_url=STATBOTICS_BASE, timeout=15) as client:
            response = await client.get("/team_events", params={"event": event_key, "limit": 1000})
            response.raise_for_status()
            records = response.json()
        result: dict[str, float] = {}
        for record in records:
            team = record.get("team")
            epa = (record.get("epa") or {}).get("total_points")
            if isinstance(team, int) and isinstance(epa, (int, float)):
                result[str(team)] = float(epa)
    except Exception as error:  # noqa: BLE001 — anything at all falls back to empty
        log.warning("Statbotics fetch for %s failed: %s", event_key, error)
        if row is not None:
            try:
                return json.loads(row.payload)
            except ValueError:
                return {}
        return {}

    payload = json.dumps(result)
    if row is None:
        db.add(TbaCache(endpoint=cache_key, payload=payload, fetched_at=datetime.utcnow()))
    else:
        row.payload = payload
        row.fetched_at = datetime.utcnow()
    await db.commit()
    return result
