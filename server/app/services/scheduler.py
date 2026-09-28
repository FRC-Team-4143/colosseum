"""APScheduler jobs: hourly Legion roster sync, and daily pruning of stale TBA cache rows.
Every job body is wrapped so a single failure logs and moves on rather than crashing the
scheduler — the same convention the sibling apps use."""
import logging
from datetime import datetime, timedelta

from apscheduler.schedulers.asyncio import AsyncIOScheduler
from apscheduler.triggers.cron import CronTrigger
from sqlalchemy import delete

from app.config import settings
from app.database import AsyncSessionLocal
from app.models import TbaCache
from app.services.legion_sync import LegionSyncError, sync_roster

log = logging.getLogger(__name__)

# Cache rows past this age are pruned even if nothing has re-requested them recently.
STALE_CACHE_AGE = timedelta(days=7)


async def job_legion_sync() -> None:
    if not settings.legion_base_url or not settings.legion_api_key:
        return
    try:
        async with AsyncSessionLocal() as db:
            summary = await sync_roster(db)
            log.info("Legion sync: %s", summary)
    except LegionSyncError as error:
        log.warning("Legion sync skipped: %s", error)
    except Exception:
        log.exception("Legion sync job failed")


async def job_prune_tba_cache() -> None:
    try:
        cutoff = datetime.utcnow() - STALE_CACHE_AGE
        async with AsyncSessionLocal() as db:
            await db.execute(delete(TbaCache).where(TbaCache.fetched_at < cutoff))
            await db.commit()
    except Exception:
        log.exception("TBA cache prune job failed")


def create_scheduler() -> AsyncIOScheduler:
    scheduler = AsyncIOScheduler(timezone=settings.timezone)
    scheduler.add_job(
        job_legion_sync, CronTrigger(minute=0, timezone=settings.timezone),
        id="legion_sync", replace_existing=True,
    )
    scheduler.add_job(
        job_prune_tba_cache, CronTrigger(hour=3, minute=0, timezone=settings.timezone),
        id="prune_tba_cache", replace_existing=True,
    )
    return scheduler
