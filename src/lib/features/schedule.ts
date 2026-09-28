import { formatMatchName, stripFrc } from "$lib/native/web/tba";

export interface ScheduleRow {
  key: string;
  name: string;
  compLevel: string;
  red: string[];
  blue: string[];
  redScore: number | null;
  blueScore: number | null;
  winner: "red" | "blue" | "tie" | null;
  completed: boolean;
}

const LEVEL_ORDER: Record<string, number> = { qm: 1, ef: 2, qf: 3, sf: 4, f: 5 };

/** Sort raw TBA match objects into playing order and project the fields the schedule
 * view needs. Scores are only surfaced once both alliances have a non-negative score
 * (TBA reports -1 for unplayed matches). */
export function toScheduleRows(matches: readonly unknown[] | null | undefined): ScheduleRow[] {
  const list = (matches ?? []) as Array<Record<string, any>>;
  return [...list]
    .sort((a, b) => {
      const la = LEVEL_ORDER[a.comp_level] ?? 99;
      const lb = LEVEL_ORDER[b.comp_level] ?? 99;
      if (la !== lb) return la - lb;
      const sa = a.comp_level === "qm" ? 0 : a.set_number ?? 0;
      const sb = b.comp_level === "qm" ? 0 : b.set_number ?? 0;
      if (sa !== sb) return sa - sb;
      return (a.match_number ?? 0) - (b.match_number ?? 0);
    })
    .map((m) => {
      const red = ((m.alliances?.red?.team_keys ?? []) as string[]).map(stripFrc);
      const blue = ((m.alliances?.blue?.team_keys ?? []) as string[]).map(stripFrc);
      const rawRed = m.alliances?.red?.score;
      const rawBlue = m.alliances?.blue?.score;
      const redScore = typeof rawRed === "number" && rawRed >= 0 ? rawRed : null;
      const blueScore = typeof rawBlue === "number" && rawBlue >= 0 ? rawBlue : null;
      const completed = redScore !== null && blueScore !== null;
      const winner: ScheduleRow["winner"] = !completed
        ? null
        : m.winning_alliance === "red" || m.winning_alliance === "blue"
          ? m.winning_alliance
          : "tie";
      return {
        key: m.key,
        name: formatMatchName(m.comp_level, m.set_number ?? 0, m.match_number ?? 0),
        compLevel: m.comp_level,
        red,
        blue,
        redScore,
        blueScore,
        winner,
        completed,
      };
    });
}
