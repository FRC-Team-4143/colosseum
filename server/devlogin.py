"""
Throwaway local dev helper — NOT part of the app.

No Legion runs locally, so there is nothing to mint an `mw_sso` cookie. This mints one
signed with Colosseum's own SSO_SECRET and redirects into the app, standing in for a real
Legion sign-in without touching any app code.

    uvicorn devlogin:app --port 8009
    open "http://localhost:8009/login?code=code0001&team=4143"
    open "http://localhost:8009/login?code=code0002&team=4423&name=Bea"

The redirect target is the Vite dev server (5173); change `next`/the host for other setups.
"""
from fastapi import FastAPI
from fastapi.responses import RedirectResponse
from itsdangerous import URLSafeTimedSerializer

from app.config import settings

app = FastAPI()
signer = URLSafeTimedSerializer(settings.sso_secret, salt="mw-sso")


@app.get("/login")
def login(code: str, team: int = 4143, name: str = "Dev User", role: str = "student",
          groups: str = "", host: str = "http://localhost:5173", next: str = "/"):
    token = signer.dumps({
        "member_code": code, "username": "dev", "name": name, "role": role,
        "team_number": team,
        "groups": [g for g in groups.split(",") if g],
        "slack_user_id": None,
    })
    resp = RedirectResponse(f"{host}{next}", status_code=303)
    resp.set_cookie("mw_sso", token, httponly=True, samesite="lax", max_age=43200)
    return resp
