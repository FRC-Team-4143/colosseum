import { describe, expect, it } from "vitest";

import { toScheduleRows } from "$lib/features/schedule";

const alliance = (teams: string[], score = -1) => ({ team_keys: teams, score });
const raw = (over: Record<string, unknown> = {}) => ({
  key: "2025x_qm1",
  comp_level: "qm",
  set_number: 1,
  match_number: 1,
  alliances: { red: alliance(["frc4143", "frc111"]), blue: alliance(["frc4423", "frc222"]) },
  winning_alliance: "",
  ...over,
});

describe("toScheduleRows", () => {
  it("sorts by level then set then number and names each match", () => {
    const rows = toScheduleRows([
      raw({ key: "f", comp_level: "f", set_number: 1, match_number: 2 }),
      raw({ key: "q2", comp_level: "qm", set_number: 1, match_number: 2 }),
      raw({ key: "sf", comp_level: "sf", set_number: 3, match_number: 1 }),
      raw({ key: "q1", comp_level: "qm", set_number: 1, match_number: 1 }),
    ]);
    expect(rows.map((r) => r.name)).toEqual(["Quals 1", "Quals 2", "Semis 3-1", "Finals 1-2"]);
  });

  it("strips the frc prefix from team keys", () => {
    const [row] = toScheduleRows([raw()]);
    expect(row.red).toEqual(["4143", "111"]);
    expect(row.blue).toEqual(["4423", "222"]);
  });

  it("treats a match as incomplete until both alliances have a non-negative score", () => {
    const [pending] = toScheduleRows([raw()]);
    expect(pending.completed).toBe(false);
    expect(pending.redScore).toBeNull();
    expect(pending.winner).toBeNull();

    const [done] = toScheduleRows([
      raw({
        alliances: { red: alliance(["frc1"], 88), blue: alliance(["frc2"], 74) },
        winning_alliance: "red",
      }),
    ]);
    expect(done.completed).toBe(true);
    expect([done.redScore, done.blueScore]).toEqual([88, 74]);
    expect(done.winner).toBe("red");
  });

  it("reports a tie when both scores land and no winner is named", () => {
    const [row] = toScheduleRows([
      raw({ alliances: { red: alliance(["frc1"], 50), blue: alliance(["frc2"], 50) }, winning_alliance: "" }),
    ]);
    expect(row.winner).toBe("tie");
  });

  it("tolerates an empty or missing list", () => {
    expect(toScheduleRows(null)).toEqual([]);
    expect(toScheduleRows([])).toEqual([]);
  });
});
