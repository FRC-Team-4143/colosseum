def packet(board_id: str, name: str = "Quals 1", match_key: str | None = None):
    p = [name, "1", "2", "3", "4", "5", "6", board_id, [], None, match_key, None, None]
    return p


async def test_boards_are_isolated_per_workspace(client, cookie_for_team):
    client.cookies.set("mw_sso", cookie_for_team(4143))
    await client.post("/api/whiteboards", json={"packet": packet("b1")})
    assert [b["id"] for b in (await client.get("/api/whiteboards")).json()["boards"]] == ["b1"]

    client.cookies.set("mw_sso", cookie_for_team(4423))
    assert (await client.get("/api/whiteboards")).json()["boards"] == []
    await client.post("/api/whiteboards", json={"packet": packet("b2")})

    client.cookies.set("mw_sso", cookie_for_team(4143))
    assert [b["id"] for b in (await client.get("/api/whiteboards")).json()["boards"]] == ["b1"]


async def test_post_is_idempotent_by_id(client, cookie_for_team):
    client.cookies.set("mw_sso", cookie_for_team(4143))
    await client.post("/api/whiteboards", json={"packet": packet("b1", "A")})
    await client.post("/api/whiteboards", json={"packet": packet("b1", "A renamed")})
    boards = (await client.get("/api/whiteboards")).json()["boards"]
    assert len(boards) == 1 and boards[0]["packet"][0] == "A renamed"


async def test_put_stale_expected_updated_at_conflicts(client, cookie_for_team):
    client.cookies.set("mw_sso", cookie_for_team(4143))
    created = (await client.post("/api/whiteboards", json={"packet": packet("b1")})).json()

    # A fresh PUT with the right timestamp succeeds.
    ok = await client.put(
        "/api/whiteboards/b1",
        json={"packet": packet("b1", "edit 1"), "expectedUpdatedAt": created["updatedAt"]},
    )
    assert ok.status_code == 200

    # PUT with the now-stale timestamp is a 409 that carries the current copy.
    stale = await client.put(
        "/api/whiteboards/b1",
        json={"packet": packet("b1", "edit 2"), "expectedUpdatedAt": created["updatedAt"]},
    )
    assert stale.status_code == 409
    assert stale.json()["detail"]["current"]["packet"][0] == "edit 1"

    # No guard -> last write wins.
    forced = await client.put("/api/whiteboards/b1", json={"packet": packet("b1", "edit 2")})
    assert forced.status_code == 200 and forced.json()["packet"][0] == "edit 2"


async def test_delete(client, cookie_for_team):
    client.cookies.set("mw_sso", cookie_for_team(4143))
    await client.post("/api/whiteboards", json={"packet": packet("b1")})
    assert (await client.request("DELETE", "/api/whiteboards/b1")).status_code == 204
    assert (await client.get("/api/whiteboards")).json()["boards"] == []


async def test_requires_auth(client):
    assert (await client.get("/api/whiteboards")).status_code == 401
