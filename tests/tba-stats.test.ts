import { describe, expect, it } from "vitest";

import { buildTeamStats, sortRows } from "$lib/features/tba-stats";

const teams = [
  { key: "frc254", team_number: 254, nickname: "The Cheesy Poofs" },
  { key: "frc9", team_number: 9, nickname: "Iron Reign" },
  { key: "frc1", team_number: 1, nickname: "" },
];
const rankings = {
  sort_order_info: [{ name: "Ranking Score", precision: 2 }],
  rankings: [
    { rank: 1, team_key: "frc254", record: { wins: 8, losses: 2, ties: 0 }, sort_orders: [3.4, 210] },
    { rank: 12, team_key: "frc9", record: { wins: 4, losses: 6, ties: 0 }, sort_orders: [1.9, 140] },
  ],
};
const oprs = {
  oprs: { frc254: 88.1, frc9: 41.2 },
  dprs: { frc254: 20.0, frc9: 33.5 },
  ccwms: { frc254: 68.1, frc9: 7.7 },
};
const coprs = {
  "Auto Coral": { frc254: 12.5, frc9: 4.1 },
  "Barge Points": { frc254: 9.0 },
};

describe("buildTeamStats", () => {
  it("joins teams, rankings, oprs and component oprs", () => {
    const { rows, componentNames, rankLabel } = buildTeamStats(teams, rankings, oprs, coprs);
    expect(rankLabel).toBe("Ranking Score");
    expect(componentNames).toEqual(["Auto Coral", "Barge Points"]);

    const poofs = rows.find((r) => r.team === 254)!;
    expect(poofs).toMatchObject({
      nickname: "The Cheesy Poofs",
      rank: 1,
      wins: 8,
      losses: 2,
      rankingScore: 3.4,
      opr: 88.1,
      dpr: 20.0,
      ccwm: 68.1,
    });
    expect(poofs.components).toEqual({ "Auto Coral": 12.5, "Barge Points": 9.0 });
  });

  it("leaves cells null for a team missing from a source", () => {
    const { rows } = buildTeamStats(teams, rankings, oprs, coprs);
    const one = rows.find((r) => r.team === 1)!;
    expect(one.nickname).toBe("1"); // blank nickname falls back to the number
    expect(one.rank).toBeNull();
    expect(one.opr).toBeNull();
    expect(one.components).toEqual({});
  });

  it("tolerates entirely missing sources", () => {
    const { rows, componentNames } = buildTeamStats(teams, null, undefined, {});
    expect(componentNames).toEqual([]);
    expect(rows).toHaveLength(3);
    expect(rows[0].rank).toBeNull();
    expect(rows[0].epa).toBeNull();
  });

  it("attaches Statbotics EPA by team number when provided", () => {
    const { rows } = buildTeamStats(teams, rankings, oprs, coprs, { "254": 41.2, "9": 12 });
    expect(rows.find((r) => r.team === 254)!.epa).toBe(41.2);
    expect(rows.find((r) => r.team === 9)!.epa).toBe(12);
    expect(rows.find((r) => r.team === 1)!.epa).toBeNull();
  });
});

describe("sortRows", () => {
  const { rows } = buildTeamStats(teams, rankings, oprs, coprs);

  it("sorts numerically and pushes nulls last regardless of direction", () => {
    const byOprDesc = sortRows(rows, "opr", "desc").map((r) => r.team);
    expect(byOprDesc).toEqual([254, 9, 1]); // 1 has no OPR -> last

    const byOprAsc = sortRows(rows, "opr", "asc").map((r) => r.team);
    expect(byOprAsc).toEqual([9, 254, 1]); // 1 still last
  });

  it("sorts by rank ascending with unranked last", () => {
    expect(sortRows(rows, "rank", "asc").map((r) => r.team)).toEqual([254, 9, 1]);
  });

  it("sorts by a component column", () => {
    expect(sortRows(rows, "component:Barge Points", "desc").map((r) => r.team)).toEqual([254, 9, 1]);
  });

  it("sorts by EPA", () => {
    const withEpa = buildTeamStats(teams, rankings, oprs, coprs, { "254": 41.2, "9": 12 }).rows;
    expect(sortRows(withEpa, "epa", "desc").map((r) => r.team)).toEqual([254, 9, 1]);
  });
});
