import type { WebCommandHandler } from "./index";

/**
 * Browser port of the `tba_*` commands (commands.rs) + helpers/tba.rs.
 *
 * The desktop build reads its TBA key from an env var or in-app setting; the
 * web build has it baked in below (a read-only key for The Blue Alliance's
 * public read API — bundling it client-side just shares its rate limit).
 * `tba_set_api_key` is therefore a no-op and `tba_has_api_key` is always true.
 *
 * The Blue Alliance's v3 API sends permissive CORS headers, so these run as
 * plain `fetch` from the page with no proxy.
 */
const TBA_API_BASE = "https://www.thebluealliance.com/api/v3";
const TBA_API_KEY = "FV6ylEIqaxtoYPrnBfPTd4HntyhyFOfk82YTjpz1rB9LhvXFKaRiSlP8XS7dFVBH";

interface TbaAlliance {
  team_keys: string[];
}
interface TbaMatch {
  key: string;
  comp_level: string;
  set_number: number;
  match_number: number;
  alliances: { red: TbaAlliance; blue: TbaAlliance };
}
interface TbaEvent {
  key: string;
  name: string;
  event_code: string;
  event_type: number;
  start_date: string;
  end_date: string;
  year: number;
  city: string | null;
  state_prov: string | null;
  country: string | null;
}
interface TbaSimpleEvent {
  key: string;
  name: string;
  location: string;
  date_range: string;
  year: number;
}
interface TbaSimpleMatch {
  match_name: string;
  red_teams: string[];
  blue_teams: string[];
  match_key: string;
}

async function tbaJson<T>(endpoint: string): Promise<T> {
  let response: Response;
  try {
    response = await fetch(`${TBA_API_BASE}${endpoint}`, {
      headers: { "X-TBA-Auth-Key": TBA_API_KEY },
    });
  } catch (error) {
    throw `TBA request failed: ${(error as Error).message}`;
  }
  if (!response.ok) throw `TBA API error: ${response.status} ${response.statusText}`;
  try {
    return (await response.json()) as T;
  } catch (error) {
    throw `TBA API JSON error: ${(error as Error).message}`;
  }
}

export const stripFrc = (key: string): string => (key.startsWith("frc") ? key.slice(3) : key);
export const normalizeTeamKey = (key: string): string => (key.startsWith("frc") ? key : `frc${key}`);

export function teamsFromMatches(matches: TbaMatch[]): string[] {
  const seen: string[] = [];
  for (const match of matches) {
    for (const key of [...match.alliances.red.team_keys, ...match.alliances.blue.team_keys]) {
      if (!seen.includes(key)) seen.push(key);
    }
  }
  return seen;
}

// --- simple-event transforms (helpers/tba.rs) ------------------------------
const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

export function formatLocation(event: TbaEvent): string {
  let location =
    event.city && event.state_prov
      ? `${event.city}, ${event.state_prov}`
      : event.city ?? event.state_prov ?? "";
  if (event.country && event.country !== "USA") {
    location = location ? `${location}, ${event.country}` : event.country;
  }
  return location;
}

function parseIsoDate(value: string): [number, number] | null {
  const parts = value.split("-");
  if (parts.length < 3) return null;
  const month = Number(parts[1]);
  const day = Number(parts[2]);
  if (!Number.isInteger(month) || month < 1 || month > 12 || !Number.isInteger(day)) return null;
  return [month, day];
}

export function formatDateRange(start: string, end: string): string | null {
  const a = parseIsoDate(start);
  const b = parseIsoDate(end);
  if (!a || !b) return null;
  return a[0] === b[0]
    ? `${MONTHS[a[0] - 1]} ${a[1]}-${b[1]}`
    : `${MONTHS[a[0] - 1]} ${a[1]} - ${MONTHS[b[0] - 1]} ${b[1]}`;
}

function parseDisplayDate(value: string, year: number): [number, number, number] | null {
  const parts = value.split(/\s+/).filter(Boolean);
  const month = MONTHS.indexOf(parts[0]) + 1;
  if (month === 0) return null;
  const day = Number((parts[1] ?? "").split("-")[0]);
  if (!Number.isInteger(day)) return null;
  return [year, month, day];
}

export function parseEventsToSimple(events: TbaEvent[]): TbaSimpleEvent[] {
  return events.map((event) => ({
    key: event.key,
    name: event.name,
    location: formatLocation(event),
    date_range: formatDateRange(event.start_date, event.end_date) ?? "",
    year: event.year,
  }));
}

export function filterAndSortEvents(events: TbaSimpleEvent[]): TbaSimpleEvent[] {
  const cmp = (x: [number, number, number], y: [number, number, number]) =>
    x[0] - y[0] || x[1] - y[1] || x[2] - y[2];
  return events
    .map((event) => ({ event, date: parseDisplayDate(event.date_range, event.year) }))
    .filter(
      (item): item is { event: TbaSimpleEvent; date: [number, number, number] } =>
        item.date !== null && cmp(item.date, [2025, 1, 1]) >= 0,
    )
    .sort((x, y) => cmp(y.date, x.date))
    .map((item) => item.event);
}

// --- simple-match transforms --------------------------------------------------
function matchLevelOrder(level: string): number {
  return { qm: 1, ef: 2, qf: 3, sf: 4, f: 5 }[level] ?? 99;
}

export function formatMatchName(level: string, set: number, number: number): string {
  const name = { qm: "Quals", ef: "Eighths", qf: "Quarters", sf: "Semis", f: "Finals" }[level];
  if (!name) return `${level.toUpperCase()} ${set}-${number}`;
  return level === "qm" ? `${name} ${number}` : `${name} ${set}-${number}`;
}

export function parseMatchesToSimple(matches: TbaMatch[]): TbaSimpleMatch[] {
  return [...matches]
    .sort((a, b) => {
      const la = matchLevelOrder(a.comp_level);
      const lb = matchLevelOrder(b.comp_level);
      if (la !== lb) return la - lb;
      const sa = a.comp_level === "qm" ? 0 : a.set_number;
      const sb = b.comp_level === "qm" ? 0 : b.set_number;
      if (sa !== sb) return sa - sb;
      return a.match_number - b.match_number;
    })
    .map((match) => ({
      match_name: formatMatchName(match.comp_level, match.set_number, match.match_number),
      red_teams: match.alliances.red.team_keys.map(stripFrc),
      blue_teams: match.alliances.blue.team_keys.map(stripFrc),
      match_key: match.key,
    }));
}

export const tbaCommands: Record<string, WebCommandHandler> = {
  tba_has_api_key: () => true,
  tba_set_api_key: () => null,

  tba_events: (args) => tbaJson<TbaEvent[]>(`/events/${Number(args.year)}`),
  tba_matches_at_event: (args) => tbaJson<TbaMatch[]>(`/event/${String(args.eventKey)}/matches`),
  tba_team_matches: (args) =>
    tbaJson<TbaMatch[]>(
      `/team/${normalizeTeamKey(String(args.teamKey))}/event/${String(args.eventKey)}/matches`,
    ),
  tba_team_events: (args) =>
    tbaJson<TbaEvent[]>(`/team/${normalizeTeamKey(String(args.teamKey))}/events/${Number(args.year)}`),

  tba_teams_at_event: async (args) => {
    const eventKey = String(args.eventKey);
    let keys: string[];
    try {
      keys = await tbaJson<string[]>(`/event/${eventKey}/teams/keys`);
    } catch {
      keys = teamsFromMatches(await tbaJson<TbaMatch[]>(`/event/${eventKey}/matches`));
    }
    return keys.map(stripFrc);
  },

  tba_simple_events: (args) => filterAndSortEvents(parseEventsToSimple((args.events as TbaEvent[]) ?? [])),
  tba_simple_matches: (args) => parseMatchesToSimple((args.matches as TbaMatch[]) ?? []),
};
