async def test_me_requires_a_cookie(client):
    resp = await client.get("/api/me")
    assert resp.status_code == 401


async def test_me_rejects_a_team_outside_the_allowlist(client, cookie_for_team):
    client.cookies.set("mw_sso", cookie_for_team(9999))
    resp = await client.get("/api/me")
    assert resp.status_code == 403


async def test_me_rejects_a_garbage_cookie(client):
    client.cookies.set("mw_sso", "not-a-real-token")
    resp = await client.get("/api/me")
    assert resp.status_code == 401


async def test_me_returns_the_identity_for_an_allowed_team(client, cookie_for_team):
    client.cookies.set("mw_sso", cookie_for_team(4423, name="Bea Scout", member_code="c0001"))
    resp = await client.get("/api/me")
    assert resp.status_code == 200
    body = resp.json()
    assert body["teamNumber"] == 4423
    assert body["name"] == "Bea Scout"
    assert body["memberCode"] == "c0001"


async def test_login_redirects_to_legion_authorize(client):
    resp = await client.get("/api/auth/login", follow_redirects=False)
    assert resp.status_code == 303
    location = resp.headers["location"]
    assert location.startswith("https://legion.test/sso/authorize?app=colosseum")
    assert "return_to=" in location


async def test_tba_routes_require_auth(client):
    resp = await client.get("/api/tba/events?year=2025")
    assert resp.status_code == 401
