async def test_note_round_trips_and_is_shared_by_event(client, cookie_for_team):
    client.cookies.set("mw_sso", cookie_for_team(4143, name="Ada"))
    assert (await client.get("/api/notes/2025mrcmp/254")).json()["body"] == ""

    put = await client.put("/api/notes/2025mrcmp/254", json={"body": "great climber"})
    assert put.status_code == 200
    assert put.json()["body"] == "great climber"
    assert put.json()["updatedBy"] == "Ada"

    # 4423 at the same event sees 4143's note (keyed by event+team, not workspace).
    client.cookies.set("mw_sso", cookie_for_team(4423))
    assert (await client.get("/api/notes/2025mrcmp/254")).json()["body"] == "great climber"


async def test_note_requires_auth(client):
    assert (await client.get("/api/notes/2025mrcmp/254")).status_code == 401
    assert (await client.put("/api/notes/2025mrcmp/254", json={"body": "x"})).status_code == 401
