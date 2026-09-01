/**
 * The manual scouting form. Deliberately generic and game-agnostic — retuning for a new
 * season is editing this one array. `counter` and `rating` fields are averaged into team
 * aggregates; `toggle` is counted; `text` is shown but not aggregated.
 */
export type ScoutFieldType = "counter" | "toggle" | "rating" | "text";

export interface ScoutField {
  key: string;
  label: string;
  type: ScoutFieldType;
  /** Upper bound for a `rating` field (0..max). */
  max?: number;
}

export const SCOUT_FIELDS: ScoutField[] = [
  { key: "autoScored", label: "Auto pieces scored", type: "counter" },
  { key: "teleopScored", label: "Teleop pieces scored", type: "counter" },
  { key: "endgame", label: "Endgame", type: "rating", max: 3 },
  { key: "defense", label: "Defense played", type: "rating", max: 3 },
  { key: "brokeDown", label: "Broke down / disabled", type: "toggle" },
  { key: "notes", label: "Notes", type: "text" },
];

export type ScoutValue = number | boolean | string;
export type ScoutValues = Record<string, ScoutValue>;

export const NUMERIC_FIELDS = SCOUT_FIELDS.filter((f) => f.type === "counter" || f.type === "rating");
export const TOGGLE_FIELDS = SCOUT_FIELDS.filter((f) => f.type === "toggle");

export function blankValues(): ScoutValues {
  const values: ScoutValues = {};
  for (const field of SCOUT_FIELDS) {
    values[field.key] = field.type === "toggle" ? false : field.type === "text" ? "" : 0;
  }
  return values;
}
