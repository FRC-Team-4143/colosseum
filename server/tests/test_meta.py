async def test_workspace_event_is_isolated_per_team(client, cookie_for_team):
    client.cookies.set("mw_sso", cookie_for_team(4143))
    put = await client.put("/api/workspace/event", json={"eventKey": "2025mokc"})
    assert put.status_code == 200
    assert (await client.get("/api/workspace/event")).json() == {"eventKey": "2025mokc"}

    # 4423 shares the deployment but has its own current event.
    client.cookies.set("mw_sso", cookie_for_team(4423))
    assert (await client.get("/api/workspace/event")).json() == {"eventKey": None}
    await client.put("/api/workspace/event", json={"eventKey": "2025code"})

    client.cookies.set("mw_sso", cookie_for_team(4143))
    assert (await client.get("/api/workspace/event")).json() == {"eventKey": "2025mokc"}


async def test_workspace_event_requires_auth(client):
    assert (await client.get("/api/workspace/event")).status_code == 401
