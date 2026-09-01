import { describe, expect, it } from "vitest";

import {
  createMatch,
  jsToFixed,
  matchFromPacket,
  matchToPacket,
  type MatchModel,
} from "$lib/native/web/match";

// Ported from the tests in src-tauri/src/helpers/match_model.rs.

const fresh = (id: string): MatchModel =>
  createMatch("Q1", ["1", "2", "3"], ["4", "5", "6"], id, null, null, null, null);

describe("jsToFixed — port of match_model::js_to_fixed", () => {
  it("matches the Rust digits=2 vectors", () => {
    const cases: Array<[number, number]> = [
      [0.001, 0], [0.0049, 0], [0.005, 0.01], [1.234, 1.23], [1.235, 1.24],
      [-1.234, -1.23], [-1.235, -1.24], [89.999, 90], [180.126, 180.13], [359.994, 359.99],
    ];
    for (const [input, expected] of cases) expect(jsToFixed(input, 2), String(input)).toBe(expected);
  });

  it("matches the Rust digits=1 vectors", () => {
    const cases: Array<[number, number]> = [
      [152.44, 152.4], [152.45, 152.4], [152.46, 152.5], [0.04, 0], [0.05, 0.1],
      [1.14, 1.1], [1.15, 1.1], [1.16, 1.2], [300.04, 300], [300.05, 300.1],
    ];
    for (const [input, expected] of cases) expect(jsToFixed(input, 1), String(input)).toBe(expected);
  });

  it("keeps the Rust result for exact negative binary halves (where native toFixed differs)", () => {
    expect(jsToFixed(-0.125, 2)).toBe(-0.12);
    expect(Object.is(jsToFixed(-0.5, 0), -0) || jsToFixed(-0.5, 0) === 0).toBe(true);
  });

  it("passes non-finite / huge / zero inputs through untouched", () => {
    expect(jsToFixed(0, 2)).toBe(0);
    expect(jsToFixed(1e15, 2)).toBe(1e15);
    expect(Number.isNaN(jsToFixed(NaN, 2))).toBe(true);
    expect(jsToFixed(Infinity, 2)).toBe(Infinity);
  });
});

describe("match codec", () => {
  it("construction uses year-default robot positions and generates distinct ids", () => {
    const y26 = createMatch("Q1", ["1", "2", "3"], ["4", "5", "6"], "id", null, null, null, 2026);
    const y25 = createMatch("Q1", ["1", "2", "3"], ["4", "5", "6"], "id2", null, null, null, 2025);
    expect([y26.auto.redOneRobot.x, y26.auto.blueOneRobot.x]).toEqual([2680, 830]);
    expect([y25.auto.redOneRobot.x, y25.auto.blueOneRobot.x]).toEqual([2055, 1455]);
    for (const phase of [y26.auto, y26.teleop, y26.transition, y26.endgame, y26.notes]) {
      expect(phase.drawing).toEqual([]);
      expect(phase.drawingBbox).toEqual([]);
      expect(phase.checkboxes).toEqual([]);
    }
    for (const key of ["redOneRobot", "blueThreeRobot"] as const) {
      expect([y26.auto[key].w, y26.auto[key].h, y26.auto[key].r]).toEqual([152.4, 152.4, 0]);
    }
    const gen = () => createMatch("Q", ["1", "2", "3"], ["4", "5", "6"], null, null, null, null, null);
    expect(gen().id).not.toBe(gen().id);
  });

  it("round trips drawings, bboxes, checkboxes and fieldMetadata, rounding r on the way out", () => {
    const original = createMatch(
      "Final", ["1", "2", "3"], ["4", "5", "6"], "packet-id", null,
      "2026miket", "2026miket_qm1", 2026,
    );
    original.auto.redOneRobot.r = 12.3456;
    original.teleop.drawing = [[0, [10, 11], [12, 13]]];
    original.teleop.drawingBbox = [[1, 2, 3, 4]];
    original.notes.checkboxes = [[10, 20, 1, true]];
    original.fieldMetadata = { selectedFieldYear: 2026 };

    const parsed = matchFromPacket(matchToPacket(original));

    expect(parsed.id).toBe("packet-id");
    expect(parsed.teleop.drawing).toEqual([[0, [10, 11], [12, 13]]]);
    expect(parsed.teleop.drawingBbox).toEqual([[1, 2, 3, 4]]);
    expect(parsed.notes.checkboxes).toEqual([[10, 20, 1, true]]);
    expect(parsed.fieldMetadata).toEqual({ selectedFieldYear: 2026 });
    expect(parsed.auto.redOneRobot.r).toBe(12.35);
    expect(parsed.tbaEventKey).toBe("2026miket");
    expect(parsed.tbaYear).toBe(2026);
  });

  it("accepts a legacy 12-element packet and defaults the optional tail", () => {
    const legacy = matchToPacket(fresh("legacy")).slice(0, 12);
    const parsed = matchFromPacket(legacy);
    expect(parsed.notes.checkboxes).toEqual([]);
    expect(parsed.fieldMetadata).toBeNull();
  });

  it("treats a null checkbox slot as an empty array for every phase", () => {
    const packet = matchToPacket(fresh("cb")) as unknown[];
    const body = packet[8] as unknown[][];
    for (let i = 1; i <= 5; i += 1) (body[i] as unknown[])[8] = null;
    const parsed = matchFromPacket(packet);
    for (const phase of [parsed.auto, parsed.teleop, parsed.endgame, parsed.notes, parsed.transition]) {
      expect(phase.checkboxes).toEqual([]);
    }
  });

  it("writes dims from the auto phase (1dp) and pose r (2dp); packet[12] is null when unset", () => {
    const x = fresh("x");
    x.auto.redOneRobot.w = 123.456;
    x.auto.redOneRobot.h = 78.951;
    x.auto.redOneRobot.r = 1.234567;
    const packet = matchToPacket(x) as unknown[];
    const body = packet[8] as unknown[][];
    expect(body[0][0]).toEqual([123.5, 79]);
    expect((body[1][0] as number[])[2]).toBe(1.23);
    expect(packet[12]).toBeNull();
  });

  it("rejects a value that is not a packet array with the Rust message", () => {
    expect(() => matchFromPacket("not a packet")).toThrow("invalid match packet: packet is not an array");
    expect(() => matchFromPacket([1, 2, 3])).toThrow(/is not an array/);
  });

  it("applies custom options and keeps unrelated state on update", () => {
    const dims = [
      [100, 100], [110, 110], [120, 120], [130, 130], [140, 140], [150, 150],
    ];
    const phase = (x: number) => [
      [x, 20, 0.5], [0, 0, 0], [0, 0, 0], [0, 0, 0], [0, 0, 0], [0, 0, 0],
      [[1, [5, 5]]], [[0, 0, 10, 10]], [[10, 20, 0, true]],
    ];
    const built = matchFromPacket([
      "Old", "1", "2", "3", "4", "5", "6", "stable",
      [dims, phase(10), phase(0), phase(0), 0, 0],
      "ev", "mk", 2026, null,
    ]);
    expect([
      built.auto.redOneRobot.x,
      built.auto.redOneRobot.y,
      built.auto.redOneRobot.r,
      built.auto.redOneRobot.w,
      built.auto.blueThreeRobot.w,
    ]).toEqual([10, 20, 0.5, 100, 150]);
    expect(built.auto.drawing).toEqual([[1, [5, 5]]]);
    expect(built.id).toBe("stable");
    expect(built.tbaEventKey).toBe("ev");
  });
});
