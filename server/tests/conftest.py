"""
Test fixtures — a fresh in-memory SQLite database per test (a real DB, never mocked), an
httpx client wired to it, an mw_sso cookie minter, and a fake TBA HTTP client so no
outbound request ever leaves the process.
"""
import httpx
import pytest
import pytest_asyncio
from httpx import ASGITransport, AsyncClient
from itsdangerous import URLSafeTimedSerializer
from sqlalchemy.ext.asyncio import AsyncSession, async_sessionmaker, create_async_engine
from sqlalchemy.pool import StaticPool

from app.config import settings
from app.database import Base, get_db
from app.main import app
from app.services import tba as tba_service


# ── Settings isolation ─────────────────────────────────────────────────────────────

@pytest.fixture(autouse=True)
def _isolate_settings_from_dotenv():
    """The suite must not depend on whatever is in the developer's `.env`. Reset every
    setting to its class default before each test and restore afterwards; `sso_secret`
    gets a fixed test value (a blank signing key would make every cookie indistinguishable),
    and `legion_base_url` a fixed value so the authorize-URL assertion is stable. The
    import-time signer in sso.py is rebuilt to match. Copied from the sibling apps."""
    from app.config import Settings

    defaults = Settings(
        _env_file=None,
        sso_secret="test-sso-secret",
        legion_base_url="https://legion.test",
    )
    original = {name: getattr(settings, name) for name in Settings.model_fields}
    for name in Settings.model_fields:
        setattr(settings, name, getattr(defaults, name))
    _rebuild_signers()
    yield
    for name, value in original.items():
        setattr(settings, name, value)
    _rebuild_signers()


def _rebuild_signers() -> None:
    from app.services import sso as sso_service

    sso_service._sso_signer = URLSafeTimedSerializer(settings.sso_secret, salt="mw-sso")


# ── Database ───────────────────────────────────────────────────────────────────────

@pytest_asyncio.fixture
async def engine():
    eng = create_async_engine(
        "sqlite+aiosqlite:///:memory:",
        connect_args={"check_same_thread": False},
        poolclass=StaticPool,
    )
    async with eng.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)
    yield eng
    await eng.dispose()


@pytest_asyncio.fixture
async def session_factory(engine):
    return async_sessionmaker(engine, class_=AsyncSession, expire_on_commit=False)


@pytest_asyncio.fixture
async def db(session_factory):
    async with session_factory() as session:
        yield session


@pytest_asyncio.fixture
async def client(session_factory):
    async def _get_db():
        async with session_factory() as s:
            yield s

    app.dependency_overrides[get_db] = _get_db
    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as c:
        yield c
    app.dependency_overrides.clear()


# ── SSO cookie ─────────────────────────────────────────────────────────────────────

def make_sso_cookie(
    *, member_code="m0000001", name="Test Member", role="student",
    groups=None, slack_user_id=None, team_number=4143,
) -> str:
    signer = URLSafeTimedSerializer(settings.sso_secret, salt="mw-sso")
    return signer.dumps({
        "member_code": member_code,
        "username": name.lower().replace(" ", "."),
        "name": name,
        "role": role,
        "team_number": team_number,
        "groups": groups or [],
        "slack_user_id": slack_user_id,
    })


@pytest.fixture
def cookie_for_team():
    def _make(team_number: int, **kwargs) -> str:
        return make_sso_cookie(team_number=team_number, **kwargs)

    return _make


# ── Fake TBA HTTP ──────────────────────────────────────────────────────────────────

class _FakeResponse:
    def __init__(self, data):
        self._data = data

    def raise_for_status(self):
        pass

    def json(self):
        return self._data


class _FakeTbaClient:
    """Swapped in for httpx.AsyncClient inside app.services.tba during tests. Class-level
    config so a test can set `stub_tba.responses[...]` / `stub_tba.fail` before the call."""
    calls: list[str] = []
    responses: dict[str, object] = {}
    fail: bool = False

    def __init__(self, *args, **kwargs):
        pass

    async def __aenter__(self):
        return self

    async def __aexit__(self, *exc):
        return False

    async def get(self, path):
        _FakeTbaClient.calls.append(path)
        if _FakeTbaClient.fail:
            raise httpx.ConnectError("stub failure", request=httpx.Request("GET", path))
        return _FakeResponse(_FakeTbaClient.responses.get(path, {}))


@pytest.fixture(autouse=True)
def stub_tba(monkeypatch):
    _FakeTbaClient.calls = []
    _FakeTbaClient.responses = {}
    _FakeTbaClient.fail = False
    monkeypatch.setattr(tba_service.httpx, "AsyncClient", _FakeTbaClient)
    return _FakeTbaClient
