# Colosseum

The event scouting hub for **FRC Teams 4143 and 4423 (MARS/WARS)**.

Pick a competition and Colosseum pulls the schedule, every team's stats (rankings,
OPR/DPR/CCWM, component OPRs, optional Statbotics EPA) and live match results from The
Blue Alliance. On top of that: a shared pick list, a shared manual scouting form, and the
per-match strategy whiteboard (auto / teleop / transition / endgame / notes, robot tokens,
freehand, checkboxes) with PNG / PDF / QR export.

It's a SvelteKit single-page app served by a FastAPI backend, deployed as one container
behind Nginx Proxy Manager alongside the sibling apps (Legion, Tempus, Munus, Merces,
Virtus). Sign-in is **Legion SSO**: the signed-in member's `team_number` picks their
workspace (4143 or 4423), and the two workspaces keep separate events, pick lists and
whiteboards while sharing TBA data, scouting records and team notes for a given event.

Whiteboard adapted from the open-source
[Strategy Board](https://github.com/pranavgundu/Strategy-Board) by Pranav Gundu (MIT).
See `LICENSE`.

## Layout

```
src/            SvelteKit SPA (Svelte 5, adapter-static)
  lib/api/      typed clients for the /api/* backend
  lib/stores/   identity, event, picklist, scouting, app (whiteboards)
  lib/whiteboard/  the framework-agnostic canvas engine (unchanged from Strategy Board)
server/         FastAPI backend (async SQLAlchemy + aiosqlite + APScheduler)
  app/services/ sso (verify mw_sso), tba + statbotics (proxy + cache), legion_sync
  app/routers/  auth, tba, workspace event, picklist, scouting, notes, whiteboards
Dockerfile      node build stage -> python:3.11-slim serving the SPA + /api
```

## Run it locally

Two processes: the FastAPI backend on 8005 and the Vite dev server on 5173 (which proxies
`/api` to the backend).

```sh
# backend
cd server
python -m venv .venv && .venv/bin/pip install -r requirements-dev.txt
cp .env.example .env            # add a TBA_API_KEY; SSO_SECRET can be any dev string
.venv/bin/uvicorn app.main:app --reload --port 8005

# frontend (another terminal)
npm ci
npm run dev                     # http://localhost:5173
```

No Legion runs locally, so mint an `mw_sso` cookie with the dev helper (it signs with the
same `SSO_SECRET`):

```sh
cd server && .venv/bin/uvicorn devlogin:app --port 8009
# then open, once:
#   http://localhost:8009/login?code=dev1&team=4143
#   http://localhost:8009/login?code=dev2&team=4423
```

Checks and tests:

```sh
npm run check                   # svelte-check
npm test                        # vitest
cd server && .venv/bin/pytest -q # backend tests (in-memory SQLite)
```

## Configuration

Backend `.env` (`server/.env` locally, `/opt/apps/colosseum/.env` on the droplet — see
`.env.example`):

| var | meaning |
|---|---|
| `TBA_API_KEY` | The Blue Alliance v3 read key (held server-side). |
| `SSO_SECRET` | Must equal Legion's `SSO_SECRET`. Colosseum only verifies the cookie. |
| `LEGION_BASE_URL` / `LEGION_API_KEY` | Legion roster API (hourly mirror; not on the critical path). |
| `ALLOWED_TEAM_NUMBERS` | `4143,4423` — anyone else is 403'd. |
| `STATBOTICS_ENABLED` | `false` by default; the EPA column is fail-soft when on. |
| `BASE_URL` | Public URL, for the SSO return path. |

## Deploying

Colosseum is a service in the `apps-infra` stack, on container port **8005** at
`colosseum.marswars.org`. It is a Legion SSO consumer, so it needs Legion-side setup too.
See **`apps-infra/README.md` → "Adding Colosseum"** for the full runbook; in short:

1. In `legion/.env`: `COLOSSEUM_API_KEY=<generated>`, add `colosseum.marswars.org` to
   `SSO_ALLOWED_RETURN_HOSTS`.
2. In `/opt/apps/colosseum/.env`: `LEGION_API_KEY=<same>`, `SSO_SECRET=<Legion's>`,
   `TBA_API_KEY=<key>`.
3. Confirm **both 4143 and 4423** are in Legion's roster with the right `team_number` —
   with strict SSO, anyone missing can't sign in.
4. `docker-compose.yml` / `deploy.sh` entries + an NPM proxy host to `colosseum:8005`.

Push to `main` runs the Tests workflow, then Deploy SSHes in and runs `/opt/apps/deploy.sh`.
