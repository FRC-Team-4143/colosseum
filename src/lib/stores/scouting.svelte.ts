import * as api from "$lib/api/scouting";
import type { ScoutRecord } from "$lib/api/scouting";
import { NUMERIC_FIELDS, TOGGLE_FIELDS, type ScoutValues } from "$lib/scouting/schema";

let entries = $state<ScoutRecord[]>([]);
let loadedEvent = $state<string | null>(null);
let loading = $state(false);

export interface TeamAggregate {
  matchCount: number;
  averages: Record<string, number>;
  toggles: Record<string, number>;
}

/**
 * Shared manual scouting for the current event. `teamAggregate` averages the numeric
 * fields (and counts the toggles) across every recorded match for a team.
 */
export const scouting = {
  get entries(): ScoutRecord[] { return entries; },
  get loading(): boolean { return loading; },

  async load(eventKey: string | null, force = false): Promise<void> {
    if (!eventKey) { entries = []; loadedEvent = null; return; }
    if (loadedEvent === eventKey && !force) return;
    loading = true;
    try {
      entries = (await api.listEventScouting(eventKey)).entries;
      loadedEvent = eventKey;
    } finally {
      loading = false;
    }
  },

  entryFor(matchKey: string, team: number): ScoutRecord | undefined {
    return entries.find((entry) => entry.matchKey === matchKey && entry.team === team);
  },

  async save(eventKey: string, matchKey: string, team: number, values: ScoutValues): Promise<void> {
    await api.putScoutEntry(eventKey, matchKey, team, values);
    await this.load(eventKey, true);
  },

  teamAggregate(team: number): TeamAggregate {
    const rows = entries.filter((entry) => entry.team === team && entry.values);
    const averages: Record<string, number> = {};
    const toggles: Record<string, number> = {};
    if (rows.length === 0) return { matchCount: 0, averages, toggles };

    for (const field of NUMERIC_FIELDS) {
      const sum = rows.reduce((total, row) => total + Number((row.values as ScoutValues)[field.key] ?? 0), 0);
      averages[field.key] = sum / rows.length;
    }
    for (const field of TOGGLE_FIELDS) {
      toggles[field.key] = rows.reduce(
        (total, row) => total + ((row.values as ScoutValues)[field.key] ? 1 : 0),
        0,
      );
    }
    return { matchCount: rows.length, averages, toggles };
  },
};
