async def _teams(resp):
    return [e["team"] for e in resp.json()["entries"]]


async def test_add_dedupes_and_appends_in_order(client, cookie_for_team):
    client.cookies.set("mw_sso", cookie_for_team(4143))
    for team in (254, 1678, 254, 973):
        resp = await client.post("/api/picklist/entries", json={"event": "2025x", "team": team})
    assert await _teams(resp) == [254, 1678, 973]
    assert [e["position"] for e in resp.json()["entries"]] == [0, 1, 2]


async def test_reorder_and_remove_keep_positions_dense(client, cookie_for_team):
    client.cookies.set("mw_sso", cookie_for_team(4143))
    for team in (1, 2, 3, 4):
        await client.post("/api/picklist/entries", json={"event": "2025x", "team": team})

    resp = await client.post("/api/picklist/reorder?event=2025x", json={"teams": [3, 1, 4, 2]})
    assert await _teams(resp) == [3, 1, 4, 2]

    resp = await client.request("DELETE", "/api/picklist/entries/1?event=2025x")
    assert await _teams(resp) == [3, 4, 2]
    assert [e["position"] for e in resp.json()["entries"]] == [0, 1, 2]


async def test_note_and_tag_patch(client, cookie_for_team):
    client.cookies.set("mw_sso", cookie_for_team(4143))
    await client.post("/api/picklist/entries", json={"event": "2025x", "team": 254})
    resp = await client.patch("/api/picklist/entries/254?event=2025x", json={"note": "1st pick", "tag": "picked"})
    entry = resp.json()["entries"][0]
    assert entry["note"] == "1st pick" and entry["tag"] == "picked"

    bad = await client.patch("/api/picklist/entries/254?event=2025x", json={"tag": "nope"})
    assert bad.status_code == 422


async def test_lists_are_isolated_per_workspace(client, cookie_for_team):
    client.cookies.set("mw_sso", cookie_for_team(4143))
    await client.post("/api/picklist/entries", json={"event": "2025x", "team": 254})

    client.cookies.set("mw_sso", cookie_for_team(4423))
    assert await _teams(await client.get("/api/picklist?event=2025x")) == []
    await client.post("/api/picklist/entries", json={"event": "2025x", "team": 1678})

    client.cookies.set("mw_sso", cookie_for_team(4143))
    assert await _teams(await client.get("/api/picklist?event=2025x")) == [254]


async def test_requires_auth(client):
    assert (await client.get("/api/picklist?event=2025x")).status_code == 401
