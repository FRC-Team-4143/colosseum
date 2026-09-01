import { describe, expect, it } from "vitest";

import { configCommands } from "$lib/native/web/config";
import { fieldCommands, selectFieldYear } from "$lib/native/web/field";

describe("web config port", () => {
  it("returns the static NativeConfig shape with the disabled release banner", () => {
    const config = configCommands.config_current({}) as Record<string, unknown>;
    expect(config.fieldPngPixelWidth).toBe(3510);
    expect(config.fieldPngPixelHeight).toBe(1610);
    expect(config.fieldRealWidthInches).toBe(690.875);
    expect(config.redOneStationX).toBe(3575);
    expect(config.blueThreeStationY).toBe(1155);
    expect(typeof config.sharedTbaApiKey).toBe("string");
    expect(config.releaseAnnouncement).toMatchObject({ enabled: false, showOnce: true });
  });
});

describe("web field port", () => {
  it("matches manager::select_year's fallback table", () => {
    const cases: Array<[unknown, 2025 | 2026]> = [
      [undefined, 2026],
      [1900, 2025],
      [2024, 2025],
      [2025, 2025],
      [2025.1, 2025],
      [2025.999, 2025],
      [2026, 2026],
      [2026.1, 2026],
      [9999, 2026],
      [-100, 2025],
      [0, 2026],
      [NaN, 2026],
    ];
    for (const [input, expected] of cases) {
      expect(selectFieldYear(input), String(input)).toBe(expected);
    }
  });

  it("exposes years and logical image paths", () => {
    expect(fieldCommands.field_years({})).toEqual([2025, 2026]);
    expect(fieldCommands.field_image({ year: 2025 })).toBe("images/2025.png");
    expect(fieldCommands.field_image({})).toBe("images/2026.png");
  });

  it("returns year-specific robot start positions", () => {
    const p = fieldCommands.field_robot_positions({ year: 2026 }) as {
      red: { one: { x: number; y: number } };
      blue: { one: { x: number } };
    };
    expect(p.red.one).toEqual({ x: 2680, y: 205 });
    expect(p.red.one.x).toBeGreaterThan(p.blue.one.x);
  });
});
