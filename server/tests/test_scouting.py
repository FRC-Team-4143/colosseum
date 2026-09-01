async def test_upsert_is_last_write_wins_and_attributed(client, cookie_for_team):
    client.cookies.set("mw_sso", cookie_for_team(4143, name="Ada", member_code="c001"))
    put = await client.put(
        "/api/scouting/2025x/2025x_qm1/254", json={"values": {"autoScored": 3, "brokeDown": False}}
    )
    assert put.status_code == 200
    assert put.json()["values"] == {"autoScored": 3, "brokeDown": False}
    assert put.json()["scoutName"] == "Ada"

    again = await client.put(
        "/api/scouting/2025x/2025x_qm1/254", json={"values": {"autoScored": 5, "brokeDown": True}}
    )
    assert again.json()["values"]["autoScored"] == 5

    got = await client.get("/api/scouting/2025x/2025x_qm1/254")
    assert got.json()["values"]["autoScored"] == 5


async def test_missing_entry_returns_null_values(client, cookie_for_team):
    client.cookies.set("mw_sso", cookie_for_team(4143))
    got = await client.get("/api/scouting/2025x/2025x_qm9/999")
    assert got.json()["values"] is None


async def test_scouting_is_shared_by_event_across_workspaces(client, cookie_for_team):
    client.cookies.set("mw_sso", cookie_for_team(4143))
    await client.put("/api/scouting/2025x/2025x_qm1/254", json={"values": {"autoScored": 4}})

    client.cookies.set("mw_sso", cookie_for_team(4423))
    await client.put("/api/scouting/2025x/2025x_qm2/254", json={"values": {"autoScored": 2}})

    listing = await client.get("/api/scouting/2025x")
    rows = {(e["matchKey"], e["team"]): e["values"]["autoScored"] for e in listing.json()["entries"]}
    assert rows == {("2025x_qm1", 254): 4, ("2025x_qm2", 254): 2}


async def test_requires_auth(client):
    assert (await client.get("/api/scouting/2025x")).status_code == 401
    assert (
        await client.put("/api/scouting/2025x/2025x_qm1/254", json={"values": {}})
    ).status_code == 401
