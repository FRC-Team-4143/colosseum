"""
SSO identity — the signed `mw_sso` browser cookie shared across MARS/WARS apps.

Legion mints `mw_sso` once a member approves a Slack push; Colosseum only ever *verifies*
it locally with the shared `sso_secret` (no callback to Legion). Every /api/* route
requires a valid cookie whose `team_number` claim is one of `settings.allowed_team_numbers`
(4143 or 4423) — anyone else gets 403. There is no separate admin/manager tier: the
`team_number` claim IS the workspace (see `workspace_of`).

Claims carried by the cookie (see Legion's `make_sso_token`):
    member_code, username, name, role, team_number, groups (list of slugs), slack_user_id
"""
from typing import Optional
from urllib.parse import quote, urlparse

from fastapi import HTTPException, Request
from itsdangerous import BadSignature, SignatureExpired, URLSafeTimedSerializer

from app.config import settings

SSO_COOKIE = "mw_sso"

_sso_signer = URLSafeTimedSerializer(settings.sso_secret, salt="mw-sso")


def read_sso_token(token: Optional[str]) -> Optional[dict]:
    """The verified claims for a raw cookie value, or None if absent/invalid/expired."""
    if not token:
        return None
    try:
        return _sso_signer.loads(token, max_age=settings.sso_session_ttl)
    except (BadSignature, SignatureExpired, TypeError, ValueError):
        return None


def sso_identity(request: Request) -> Optional[dict]:
    """The verified SSO claims for the current request, or None if absent/invalid."""
    return read_sso_token(request.cookies.get(SSO_COOKIE))


def allowed_team_numbers() -> set[int]:
    return {int(t) for t in settings.allowed_team_numbers.split(",") if t.strip()}


def workspace_of(identity: dict) -> int:
    """The workspace a verified identity belongs to — its team_number. Only call this on
    an identity that already passed `require_member` (so the cast can't fail)."""
    return int(identity["team_number"])


async def require_member(request: Request) -> dict:
    """FastAPI dependency: 401 with no/invalid cookie, 403 for a team_number outside
    `allowed_team_numbers`, otherwise the verified identity dict."""
    identity = sso_identity(request)
    if identity is None:
        raise HTTPException(status_code=401, detail="Sign in required")
    try:
        team_number = int(identity.get("team_number"))
    except (TypeError, ValueError):
        team_number = None
    if team_number not in allowed_team_numbers():
        raise HTTPException(status_code=403, detail="Not authorized for Colosseum")
    return identity


def make_authorize_url(request: Request, *, return_to: Optional[str] = None) -> str:
    """Where to send an unauthenticated caller to sign in: Legion's `/sso/authorize`.

    `return_to` is always a bare Colosseum-relative path, so it must be made absolute here
    before handing it to Legion — otherwise Legion's `/sso/complete` issues a plain
    relative redirect that resolves against *Legion's* own host, not Colosseum's.
    """
    if return_to is not None:
        target = return_to if urlparse(return_to).netloc else f"{settings.base_url}{return_to}"
    else:
        target = str(request.url)
    return f"{settings.legion_base_url}/sso/authorize?app=colosseum&return_to={quote(target, safe='')}"


def logout_url(request: Request, *, return_to: str = "/") -> str:
    """Legion's single-logout endpoint, returning to `return_to` (a Colosseum path)."""
    base = f"{request.url.scheme}://{request.url.netloc}{return_to}"
    return f"{settings.legion_base_url}/sso/logout?return_to={quote(base, safe='')}"
