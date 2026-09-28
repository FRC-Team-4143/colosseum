"""Identity + Legion SSO entry/exit. `/api/me` is the SPA's boot-time probe: 401 means
"go sign in", 403 means "signed in, but not on 4143 or 4423"."""
from fastapi import APIRouter, Depends, Request
from fastapi.responses import RedirectResponse

from app.services.sso import logout_url, make_authorize_url, require_member, workspace_of

router = APIRouter()


@router.get("/api/me")
async def me(identity: dict = Depends(require_member)):
    return {
        "memberCode": identity.get("member_code"),
        "name": identity.get("name"),
        "teamNumber": workspace_of(identity),
        "groups": identity.get("groups") or [],
    }


@router.get("/api/auth/login")
async def login(request: Request, return_to: str = "/"):
    return RedirectResponse(make_authorize_url(request, return_to=return_to), status_code=303)


@router.get("/api/auth/logout")
async def logout(request: Request):
    return RedirectResponse(logout_url(request), status_code=303)
