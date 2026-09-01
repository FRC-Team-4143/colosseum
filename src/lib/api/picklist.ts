import { apiGet, apiSend } from "./http";

export type PickTag = "" | "picked" | "dnp";

export interface PickEntry {
  team: number;
  position: number;
  note: string;
  tag: PickTag;
}

interface ListResponse {
  entries: PickEntry[];
}

const q = (eventKey: string) => `event=${encodeURIComponent(eventKey)}`;

export const getPickList = (eventKey: string): Promise<ListResponse> =>
  apiGet(`/api/picklist?${q(eventKey)}`);

export const addPick = (eventKey: string, team: number): Promise<ListResponse> =>
  apiSend("POST", "/api/picklist/entries", { event: eventKey, team });

export const patchPick = (
  eventKey: string,
  team: number,
  change: { note?: string; tag?: PickTag },
): Promise<ListResponse> =>
  apiSend("PATCH", `/api/picklist/entries/${team}?${q(eventKey)}`, change);

export const removePick = (eventKey: string, team: number): Promise<ListResponse> =>
  apiSend("DELETE", `/api/picklist/entries/${team}?${q(eventKey)}`);

export const reorderPicks = (eventKey: string, teams: number[]): Promise<ListResponse> =>
  apiSend("POST", `/api/picklist/reorder?${q(eventKey)}`, { teams });
