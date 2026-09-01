"""
The Blue Alliance v3 client, cached in SQLite.

Colosseum holds the read key server-side (never shipped to the browser, unlike the old
client-bundled key) and shares one rate limit across every signed-in device. On an
upstream failure, a cached response is served even if stale, so a brief TBA outage during
an event doesn't blank the schedule; only a cold cache miss with a failed fetch raises.
"""
import json
import logging
from datetime import datetime, timedelta
from typing import Any

import httpx
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.config import settings
from app.models import TbaCache

log = logging.getLogger(__name__)

TBA_API_BASE = "https://www.thebluealliance.com/api/v3"


class TbaError(RuntimeError):
    """Raised when TBA can't be reached and there is no cached response to fall back to."""


async def get(db: AsyncSession, endpoint: str, *, ttl: int) -> Any:
    """Cached GET against TBA. `endpoint` is the request path (e.g. "/event/2025mokc/matches"),
    which doubles as the cache key. Returns parsed JSON."""
    row = (await db.execute(select(TbaCache).where(TbaCache.endpoint == endpoint))).scalars().first()
    fresh = row is not None and datetime.utcnow() - row.fetched_at < timedelta(seconds=ttl)
    if fresh:
        return json.loads(row.payload)

    try:
        async with httpx.AsyncClient(
            base_url=TBA_API_BASE, headers={"X-TBA-Auth-Key": settings.tba_api_key}, timeout=15
        ) as client:
            response = await client.get(endpoint)
            response.raise_for_status()
            data = response.json()
    except httpx.HTTPError as error:
        if row is not None:
            log.warning("TBA request for %s failed (%s); serving stale cache from %s", endpoint, error, row.fetched_at)
            return json.loads(row.payload)
        raise TbaError(f"TBA request for {endpoint} failed: {error}") from error

    payload = json.dumps(data)
    if row is None:
        db.add(TbaCache(endpoint=endpoint, payload=payload, fetched_at=datetime.utcnow()))
    else:
        row.payload = payload
        row.fetched_at = datetime.utcnow()
    await db.commit()
    return data
