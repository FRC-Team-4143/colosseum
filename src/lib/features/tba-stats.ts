import { stripFrc } from "$lib/native/web/tba";

export interface TeamStatRow {
  team: number;
  nickname: string;
  rank: number | null;
  wins: number;
  losses: number;
  ties: number;
  /** The event's primary ranking sort value (sort_orders[0]); label is `rankLabel`. */
  rankingScore: number | null;
  opr: number | null;
  dpr: number | null;
  ccwm: number | null;
  /** Statbotics EPA (expected points contribution); null when Statbotics is off/unavailable. */
  epa: number | null;
  /** Component OPRs by category name (year-specific; often empty pre-event). */
  components: Record<string, number>;
}

export interface TeamStats {
  rows: TeamStatRow[];
  componentNames: string[];
  rankLabel: string;
}

type Dict = Record<string, unknown>;

function numberOrNull(value: unknown): number | null {
  return typeof value === "number" && Number.isFinite(value) ? value : null;
}

/** Join a TBA event's team list with its rankings, OPRs and component OPRs into one flat
 * table. Every source is optional — a missing piece just leaves those cells null. */
export function buildTeamStats(
  teams: readonly unknown[] | null | undefined,
  rankings: Dict | null | undefined,
  oprs: Dict | null | undefined,
  coprs: Dict | null | undefined,
  epaByTeam: Record<string, number> | null | undefined = null,
): TeamStats {
  const rankingList = (rankings?.rankings ?? []) as Array<Dict>;
  const rankLabel =
    ((rankings?.sort_order_info as Array<Dict> | undefined)?.[0]?.name as string | undefined) ?? "RP";
  const rankByTeam = new Map<number, Dict>();
  for (const entry of rankingList) {
    rankByTeam.set(Number(stripFrc(String(entry.team_key))), entry);
  }

  const oprMap = (oprs?.oprs ?? {}) as Record<string, number>;
  const dprMap = (oprs?.dprs ?? {}) as Record<string, number>;
  const ccwmMap = (oprs?.ccwms ?? {}) as Record<string, number>;

  const componentNames = Object.entries(coprs ?? {})
    .filter(([, v]) => v && typeof v === "object")
    .map(([name]) => name)
    .sort();

  const rows: TeamStatRow[] = ((teams ?? []) as Array<Dict>).map((team) => {
    const number = Number(team.team_number);
    const frc = `frc${number}`;
    const rankEntry = rankByTeam.get(number);
    const record = (rankEntry?.record ?? {}) as Dict;
    const sortOrders = (rankEntry?.sort_orders ?? []) as unknown[];

    const components: Record<string, number> = {};
    for (const name of componentNames) {
      const value = ((coprs as Dict)?.[name] as Record<string, number> | undefined)?.[frc];
      if (typeof value === "number") components[name] = value;
    }

    return {
      team: number,
      nickname: (team.nickname as string) || String(number),
      rank: numberOrNull(rankEntry?.rank),
      wins: Number(record.wins ?? 0),
      losses: Number(record.losses ?? 0),
      ties: Number(record.ties ?? 0),
      rankingScore: numberOrNull(sortOrders[0]),
      opr: numberOrNull(oprMap[frc]),
      dpr: numberOrNull(dprMap[frc]),
      ccwm: numberOrNull(ccwmMap[frc]),
      epa: numberOrNull(epaByTeam?.[String(number)]),
      components,
    };
  });

  return { rows, componentNames, rankLabel };
}

export type SortKey =
  | "team"
  | "nickname"
  | "rank"
  | "record"
  | "rankingScore"
  | "opr"
  | "dpr"
  | "ccwm"
  | "epa"
  | `component:${string}`;

function sortValue(row: TeamStatRow, key: SortKey): number | string | null {
  switch (key) {
    case "team": return row.team;
    case "nickname": return row.nickname.toLowerCase();
    case "rank": return row.rank;
    case "record": return row.wins - row.losses;
    case "rankingScore": return row.rankingScore;
    case "opr": return row.opr;
    case "dpr": return row.dpr;
    case "ccwm": return row.ccwm;
    case "epa": return row.epa;
    default: return row.components[key.slice("component:".length)] ?? null;
  }
}

/** Stable sort by any column. Null/undefined values always sort to the bottom, whichever
 * direction the rest is going. */
export function sortRows(rows: readonly TeamStatRow[], key: SortKey, dir: "asc" | "desc"): TeamStatRow[] {
  const factor = dir === "asc" ? 1 : -1;
  return [...rows].sort((a, b) => {
    const av = sortValue(a, key);
    const bv = sortValue(b, key);
    const aNull = av === null || av === undefined;
    const bNull = bv === null || bv === undefined;
    if (aNull && bNull) return 0;
    if (aNull) return 1;
    if (bNull) return -1;
    if (typeof av === "string" && typeof bv === "string") return av.localeCompare(bv) * factor;
    return ((av as number) - (bv as number)) * factor;
  });
}
