import { describe, expect, it } from "vitest";

import { fuzzyMatch, fuzzySearchBatch } from "$lib/native/web/search";

// Ported from src-tauri/src/helpers/search.rs.

const item = (name: string, details: string, key: string) => ({
  name,
  nameLower: name.toLowerCase(),
  details,
  detailsLower: details.toLowerCase(),
  key,
  keyLower: key.toLowerCase(),
});

describe("web fuzzy search port", () => {
  it("exact match: full indices and a strong score", () => {
    for (const term of ["a", "qm", "event", "2026miket", "alpha-beta", "frc2056", "finals"]) {
      const r = fuzzyMatch(term, term)!;
      expect(r.matchedIndices).toEqual([...term].map((_, i) => i));
      expect(r.score).toBeGreaterThan(100);
    }
  });

  it("impossible and empty searches follow the contract", () => {
    for (const [term, target] of [
      ["abc", ""], ["abcd", "abc"], ["xyz", "event"], ["zz", "quals"], ["999", "frc111"],
    ] as const) {
      expect(fuzzyMatch(term, target)).toBeNull();
    }
    for (const target of ["", "2026", "quals", "team 1114"]) {
      expect(fuzzyMatch("", target)).toEqual({ score: 0, matchedIndices: [] });
    }
  });

  it("start / consecutive / first-char matches score higher", () => {
    expect(fuzzyMatch("det", "detroit michigan")!.score).toBeGreaterThan(
      fuzzyMatch("det", "the detroit area")!.score,
    );
    expect(fuzzyMatch("abc", "abcdef")!.score).toBeGreaterThan(fuzzyMatch("abc", "axbxcx")!.score);
    expect(fuzzyMatch("ab", "abcd")!.score).toBeGreaterThan(fuzzyMatch("ab", "xabcd")!.score);
  });

  it("every legacy word separator earns the boundary bonus", () => {
    const baseline = fuzzyMatch("ef", "xxefyy")!.score;
    for (const target of [
      "ef schedule", "x-ef schedule", "x_ef schedule", "x.ef schedule", "x,ef schedule",
      "x(ef schedule", "x)ef schedule", "x/ef schedule", "x\\ef schedule",
    ]) {
      expect(fuzzyMatch("ef", target)!.score, target).toBeGreaterThan(baseline);
    }
  });

  it("camelCase boundaries in the original text raise the score", () => {
    for (const [term, lower, original] of [
      ["sb", "strategyboard", "StrategyBoard"],
      ["tb", "thebluealliance", "TheBlueAlliance"],
      ["dt", "drivetrain", "DriveTrain"],
      ["qd", "quickdraw", "QuickDraw"],
    ] as const) {
      expect(fuzzyMatch(term, lower, original)!.score).toBeGreaterThan(
        fuzzyMatch(term, lower, lower)!.score,
      );
    }
  });

  it("numeric and single-character searches preserve indices", () => {
    expect(fuzzyMatch("1114", "1114 simbotics")!.matchedIndices).toEqual([0, 1, 2, 3]);
    expect(fuzzyMatch("a", "abcdef")!.matchedIndices).toEqual([0]);
  });

  it("batch search sorts by score, filters by minScore, and boosts name hits", () => {
    const items = [
      item("General Item", "Strategy Board planning", "abc123"),
      item("Strategy Board", "General details", "zzz999"),
    ];
    expect(fuzzySearchBatch(items, "strategy", 0)[0].index).toBe(1);

    const keyItems = [item("Some Event", "Info", "2026abc"), item("Michigan", "", "2026miket")];
    expect(fuzzySearchBatch(keyItems, "2026miket", 0)[0].index).toBe(1);

    expect(fuzzySearchBatch([item("Alpha", "Bravo", "charlie")], "zz", 999)).toEqual([]);
    expect(fuzzySearchBatch([item("A", "", "1"), item("B", "", "2")], "", 0)).toHaveLength(2);
  });

  it("batch search finds a hit in any of name / details / key", () => {
    for (const [term, name, details, key] of [
      ["strategy", "Strategy Board", "General planning", "abc"],
      ["planning", "General board", "Planning details", "abc"],
      ["254", "General board", "No team here", "frc254"],
      ["miket", "Michigan Event", "Week 2", "2026miket"],
      ["1114", "Simbotics", "Legend team", "1114"],
    ] as const) {
      const items = [item("Other", "Elsewhere", "zzz"), item(name, details, key)];
      const matches = fuzzySearchBatch(items, term, 1);
      expect(matches, term).toHaveLength(1);
      expect(matches[0].index, term).toBe(1);
    }
  });
});
