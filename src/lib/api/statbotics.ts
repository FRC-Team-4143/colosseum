import { apiGet } from "./http";

/** `{ "<team number>": epa }`. Empty when Statbotics is disabled or unreachable. */
export const getEventEpa = (eventKey: string): Promise<Record<string, number>> =>
  apiGet(`/api/statbotics/event/${encodeURIComponent(eventKey)}`);
