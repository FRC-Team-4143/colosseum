import type { WebCommandHandler } from "./index";

/**
 * Browser port of `field_years` / `field_image` / `field_robot_positions`
 * (src-tauri/src/helpers/manager.rs). No frontend code currently calls
 * `native.field.*` — the whiteboard imports the year PNGs directly via Vite —
 * but the command surface is kept complete and faithful to the Rust contract:
 * `field_image` returns a *logical* path (`images/<year>.png`), not a resolved
 * URL, on both platforms.
 */
const YEARS = [2025, 2026] as const;
const LATEST_YEAR = 2026;
const IMAGE: Record<number, string> = { 2025: "images/2025.png", 2026: "images/2026.png" };

const POSITIONS = {
  2025: {
    red: { one: { x: 2055, y: 455 }, two: { x: 2055, y: 805 }, three: { x: 2055, y: 1155 } },
    blue: { one: { x: 1455, y: 455 }, two: { x: 1455, y: 805 }, three: { x: 1455, y: 1155 } },
  },
  2026: {
    red: { one: { x: 2680, y: 205 }, two: { x: 2680, y: 805 }, three: { x: 2680, y: 1405 } },
    blue: { one: { x: 830, y: 205 }, two: { x: 830, y: 805 }, three: { x: 830, y: 1405 } },
  },
} as const;

/**
 * Mirrors `manager::select_year`: an omitted/0/NaN year picks the newest field;
 * < 2025 -> 2025; >= 2026 -> 2026; anything in between (2025.x) -> 2025.
 */
export function selectFieldYear(year: unknown): 2025 | 2026 {
  if (typeof year !== "number" || year === 0 || Number.isNaN(year)) return LATEST_YEAR;
  if (year < 2025) return 2025;
  if (year >= 2026) return 2026;
  return 2025;
}

/** Mirrors `manager::robot_positions_for_year` — the default robot start poses. */
export function robotPositionsForYear(year: unknown): (typeof POSITIONS)[2025 | 2026] {
  return POSITIONS[selectFieldYear(year)];
}

export const fieldCommands: Record<string, WebCommandHandler> = {
  field_years: () => [...YEARS],
  field_image: (args) => IMAGE[selectFieldYear(args.year)],
  field_robot_positions: (args) => robotPositionsForYear(args.year),
};
