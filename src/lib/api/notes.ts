import { apiGet, apiSend } from "./http";

export interface TeamNote {
  body: string;
  updatedBy: string | null;
}

export const getTeamNote = (eventKey: string, team: number): Promise<TeamNote> =>
  apiGet(`/api/notes/${encodeURIComponent(eventKey)}/${team}`);

export const putTeamNote = (eventKey: string, team: number, body: string): Promise<TeamNote> =>
  apiSend("PUT", `/api/notes/${encodeURIComponent(eventKey)}/${team}`, { body });
