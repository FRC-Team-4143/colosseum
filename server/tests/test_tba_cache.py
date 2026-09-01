import pytest

from app.services import tba


async def test_get_fetches_then_serves_from_cache(db, stub_tba):
    stub_tba.responses["/events/2025"] = [{"key": "2025mokc"}]

    first = await tba.get(db, "/events/2025", ttl=100)
    second = await tba.get(db, "/events/2025", ttl=100)

    assert first == second == [{"key": "2025mokc"}]
    assert stub_tba.calls == ["/events/2025"]  # fetched once, then cached


async def test_get_serves_stale_cache_when_upstream_fails(db, stub_tba):
    stub_tba.responses["/events/2025"] = [{"key": "2025mokc"}]
    await tba.get(db, "/events/2025", ttl=100)

    stub_tba.fail = True
    stale = await tba.get(db, "/events/2025", ttl=0)  # ttl=0 forces a refetch attempt

    assert stale == [{"key": "2025mokc"}]  # last good payload, not an error


async def test_get_raises_on_a_cold_miss_with_a_failing_upstream(db, stub_tba):
    stub_tba.fail = True
    with pytest.raises(tba.TbaError):
        await tba.get(db, "/events/2099", ttl=100)


async def test_tba_endpoint_returns_cached_json_for_an_allowed_team(client, cookie_for_team, stub_tba):
    stub_tba.responses["/events/2025"] = [{"key": "2025mokc", "name": "Haymarket"}]
    client.cookies.set("mw_sso", cookie_for_team(4143))

    resp = await client.get("/api/tba/events?year=2025")

    assert resp.status_code == 200
    assert resp.json() == [{"key": "2025mokc", "name": "Haymarket"}]
