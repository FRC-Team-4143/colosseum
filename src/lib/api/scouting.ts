import { apiGet, apiSend } from "./http";
import type { ScoutValues } from "$lib/scouting/schema";

export interface ScoutRecord {
  matchKey: string;
  team: number;
  values: ScoutValues | null;
  scoutName?: string;
  updatedAt?: string;
}

const path = (eventKey: string, extra = "") =>
  `/api/scouting/${encodeURIComponent(eventKey)}${extra}`;

export const listEventScouting = (eventKey: string): Promise<{ entries: ScoutRecord[] }> =>
  apiGet(path(eventKey));

export const getScoutEntry = (eventKey: string, matchKey: string, team: number): Promise<ScoutRecord> =>
  apiGet(path(eventKey, `/${encodeURIComponent(matchKey)}/${team}`));

export const putScoutEntry = (
  eventKey: string,
  matchKey: string,
  team: number,
  values: ScoutValues,
): Promise<ScoutRecord> =>
  apiSend("PUT", path(eventKey, `/${encodeURIComponent(matchKey)}/${team}`), { values });
