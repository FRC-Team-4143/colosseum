import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import {
  filterAndSortEvents,
  formatDateRange,
  formatLocation,
  formatMatchName,
  normalizeTeamKey,
  parseMatchesToSimple,
  stripFrc,
  tbaCommands,
  teamsFromMatches,
} from "$lib/native/web/tba";

// Vectors ported from src-tauri/src/helpers/tba.rs.

const alliance = (...teams: string[]) => ({ team_keys: teams });
const match = (key: string, level: string, set: number, number: number) => ({
  key,
  comp_level: level,
  set_number: set,
  match_number: number,
  alliances: { red: alliance("frc1"), blue: alliance("frc2") },
});
const simpleEvent = (key: string, dateRange: string, year: number) => ({
  key,
  name: "",
  location: "",
  date_range: dateRange,
  year,
});

describe("tba pure transforms", () => {
  it("formats a location, dropping a USA country and keeping others", () => {
    expect(formatLocation({ city: "Detroit", state_prov: "MI", country: "USA" } as never)).toBe("Detroit, MI");
    expect(formatLocation({ city: null, state_prov: "ON", country: "Canada" } as never)).toBe("ON, Canada");
  });

  it("formats a cross-month / cross-year date range", () => {
    expect(formatDateRange("2026-03-30", "2026-04-01")).toBe("Mar 30 - Apr 1");
    expect(formatDateRange("2026-12-31", "2027-01-02")).toBe("Dec 31 - Jan 2");
    expect(formatDateRange("2026-03-01", "2026-03-03")).toBe("Mar 1-3");
  });

  it("sorts and names every competition level, stripping the frc prefix", () => {
    const output = parseMatchesToSimple([
      match("f", "f", 1, 2),
      match("q2", "qm", 1, 2),
      match("e", "ef", 2, 1),
      match("q1", "qm", 1, 1),
      match("x", "xx", 1, 1),
    ]);
    expect(output.map((m) => m.match_name)).toEqual([
      "Quals 1",
      "Quals 2",
      "Eighths 2-1",
      "Finals 1-2",
      "XX 1-1",
    ]);
    expect(output[0].red_teams).toEqual(["1"]);
    expect(output[0].blue_teams).toEqual(["2"]);
  });

  it("formatMatchName covers the individual cases", () => {
    expect(formatMatchName("qm", 1, 7)).toBe("Quals 7");
    expect(formatMatchName("sf", 3, 1)).toBe("Semis 3-1");
    expect(formatMatchName("weird", 2, 4)).toBe("WEIRD 2-4");
  });

  it("filters events before 2025 and sorts newest first", () => {
    const events = [
      simpleEvent("old", "Dec 1-2", 2024),
      simpleEvent("jan", "Jan 1-2", 2025),
      simpleEvent("new", "Apr 3-5", 2025),
    ];
    expect(filterAndSortEvents(events).map((e) => e.key)).toEqual(["new", "jan"]);
  });

  it("normalizeTeamKey / stripFrc / teamsFromMatches", () => {
    expect(normalizeTeamKey("254")).toBe("frc254");
    expect(normalizeTeamKey("frc254")).toBe("frc254");
    expect(stripFrc("frc1114")).toBe("1114");
    expect(
      teamsFromMatches([
        { alliances: { red: alliance("frc1", "frc2"), blue: alliance("frc3") } } as never,
        { alliances: { red: alliance("frc2"), blue: alliance("frc4") } } as never,
      ]),
    ).toEqual(["frc1", "frc2", "frc3", "frc4"]);
  });
});

describe("tba fetch commands", () => {
  const fetchMock = vi.fn();
  beforeEach(() => {
    fetchMock.mockReset();
    vi.stubGlobal("fetch", fetchMock);
  });
  afterEach(() => vi.unstubAllGlobals());

  const ok = (data: unknown) => ({ ok: true, json: async () => data });

  it("hits the events endpoint with the auth header", async () => {
    fetchMock.mockResolvedValue(ok([{ key: "2026miket" }]));
    const result = await tbaCommands.tba_events({ year: 2026 });
    expect(result).toEqual([{ key: "2026miket" }]);
    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toBe("https://www.thebluealliance.com/api/v3/events/2026");
    expect((init.headers as Record<string, string>)["X-TBA-Auth-Key"]).toMatch(/^\w{40,}$/);
  });

  it("normalizes the team key for team endpoints", async () => {
    fetchMock.mockResolvedValue(ok([]));
    await tbaCommands.tba_team_matches({ teamKey: "254", eventKey: "2026miket" });
    expect(fetchMock.mock.calls[0][0]).toBe(
      "https://www.thebluealliance.com/api/v3/team/frc254/event/2026miket/matches",
    );
  });

  it("teams_at_event falls back to /matches and returns bare team numbers", async () => {
    fetchMock
      .mockResolvedValueOnce({ ok: false, status: 404, statusText: "Not Found" })
      .mockResolvedValueOnce(ok([match("m1", "qm", 1, 1)]));
    const teams = await tbaCommands.tba_teams_at_event({ eventKey: "2026miket" });
    expect(teams).toEqual(["1", "2"]);
    expect(fetchMock.mock.calls[1][0]).toContain("/event/2026miket/matches");
  });

  it("surfaces a non-2xx response as a TBA API error", async () => {
    fetchMock.mockResolvedValue({ ok: false, status: 401, statusText: "Unauthorized" });
    await expect(tbaCommands.tba_events({ year: 2026 })).rejects.toBe("TBA API error: 401 Unauthorized");
  });

  it("tba_has_api_key is always true; tba_set_api_key is a no-op", async () => {
    expect(await tbaCommands.tba_has_api_key({})).toBe(true);
    expect(await tbaCommands.tba_set_api_key({ apiKey: "whatever" })).toBeNull();
    expect(fetchMock).not.toHaveBeenCalled();
  });
});
