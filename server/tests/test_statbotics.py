from app.config import settings


async def test_disabled_returns_empty_without_calling_upstream(client, cookie_for_team, stub_tba):
    settings.statbotics_enabled = False
    stub_tba.responses["/team_events"] = [{"team": 254, "epa": {"total_points": 41.2}}]
    client.cookies.set("mw_sso", cookie_for_team(4143))

    resp = await client.get("/api/statbotics/event/2025x")

    assert resp.status_code == 200
    assert resp.json() == {}
    assert "/team_events" not in stub_tba.calls


async def test_enabled_maps_team_to_epa_total_points(client, cookie_for_team, stub_tba):
    settings.statbotics_enabled = True
    stub_tba.responses["/team_events"] = [
        {"team": 254, "epa": {"total_points": 41.2}},
        {"team": 9, "epa": {"total_points": 12.0}},
        {"team": 111, "epa": {}},          # missing total_points -> skipped
        {"team": None, "epa": {"total_points": 5}},  # bad team -> skipped
    ]
    client.cookies.set("mw_sso", cookie_for_team(4143))

    resp = await client.get("/api/statbotics/event/2025x")

    assert resp.json() == {"254": 41.2, "9": 12.0}


async def test_upstream_failure_is_swallowed(client, cookie_for_team, stub_tba):
    settings.statbotics_enabled = True
    stub_tba.fail = True
    client.cookies.set("mw_sso", cookie_for_team(4143))

    resp = await client.get("/api/statbotics/event/2025x")

    assert resp.status_code == 200
    assert resp.json() == {}


async def test_requires_auth(client):
    assert (await client.get("/api/statbotics/event/2025x")).status_code == 401
