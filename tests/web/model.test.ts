import { describe, expect, it } from "vitest";

import { matchCommands } from "$lib/native/web/model";

// Board persistence lives on the backend now (src/lib/api/whiteboards.ts); what remains
// here is the pure `match_*` packet construction / codec.
const create = (input: Record<string, unknown>) => matchCommands.match_create_packet(input) as unknown[];
const normalize = (packet: unknown) => matchCommands.match_normalize_packet({ packet }) as unknown[];

describe("web match commands", () => {
  it("match_create_packet validates the alliance sizes and builds a packet", () => {
    expect(() => create({ matchName: "Q", redTeams: ["1"], blueTeams: ["2", "3", "4"] })).toThrow(
      "a match requires exactly three red and three blue teams",
    );

    const built = create({
      matchName: "Q7",
      redTeams: ["11", "22", "33"],
      blueTeams: ["44", "55", "66"],
      tbaEventKey: "2026mokc",
      tbaMatchKey: "2026mokc_qm7",
      tbaYear: 2026,
    });
    expect(built[0]).toBe("Q7");
    expect(built.slice(1, 7)).toEqual(["11", "22", "33", "44", "55", "66"]);
    expect(typeof built[7]).toBe("string");
    expect(built[9]).toBe("2026mokc");
    expect(built[10]).toBe("2026mokc_qm7");
    expect(built[11]).toBe(2026);
  });

  it("match_normalize_packet round-trips through the codec", () => {
    const built = create({ matchName: "Q1", redTeams: ["1", "2", "3"], blueTeams: ["4", "5", "6"] });
    expect(normalize(built)).toEqual(built);
  });
});
