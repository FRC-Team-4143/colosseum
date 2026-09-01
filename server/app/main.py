from contextlib import asynccontextmanager
from pathlib import Path

from fastapi import Depends, FastAPI, HTTPException
from fastapi.responses import FileResponse, JSONResponse
from sqlalchemy import text
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import get_db, init_db
from app.routers import auth, meta, notes, picklist, scouting, tba
from app.services.scheduler import create_scheduler

# The built SvelteKit SPA. In the Docker image it sits at /app/static (next to the app
# package), copied from the node build stage. When only the backend is run for local
# development it is absent — `vite dev` serves the SPA on another port — and the catch-all
# below simply 404s, which is harmless since every real route is an /api/* or /health.
STATIC_DIR = (Path(__file__).resolve().parent.parent / "static").resolve()


@asynccontextmanager
async def lifespan(app: FastAPI):
    await init_db()
    scheduler = create_scheduler()
    scheduler.start()
    app.state.scheduler = scheduler
    yield
    scheduler.shutdown()


app = FastAPI(title="Colosseum", lifespan=lifespan)

app.include_router(auth.router)
app.include_router(tba.router)
app.include_router(meta.router)
app.include_router(notes.router)
app.include_router(picklist.router)
app.include_router(scouting.router)


@app.get("/health")
async def health(db: AsyncSession = Depends(get_db)):
    """Unauthenticated liveness probe — Legion's dashboard polls this."""
    try:
        await db.execute(text("SELECT 1"))
    except Exception:  # noqa: BLE001 — any DB error means "not healthy"
        return JSONResponse({"status": "error", "app": "colosseum"}, status_code=503)
    return {"status": "ok", "app": "colosseum"}


# SPA: serve a real file when the path names one, otherwise index.html so client-side
# routing works on a hard refresh. Registered last so every /api/* and /health route
# matches first. Path traversal is blocked by resolving and re-checking containment.
@app.get("/{full_path:path}")
async def spa(full_path: str):
    index = STATIC_DIR / "index.html"
    requested = (STATIC_DIR / full_path).resolve()
    if requested.is_file() and (requested == index or STATIC_DIR in requested.parents):
        return FileResponse(requested)
    if index.is_file():
        return FileResponse(index)
    raise HTTPException(status_code=404, detail="Not found")
