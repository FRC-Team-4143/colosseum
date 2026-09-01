import { apiGet, ApiError, apiSend } from "$lib/api/http";

/** A lazily-loaded piece of the current event's TBA data. */
export interface Resource<T> {
  data: T | null;
  loading: boolean;
  error: string | null;
}

function empty<T>(): Resource<T> {
  return { data: null, loading: false, error: null };
}

let currentEventKey = $state<string | null>(null);
let bootLoading = $state(true);

let event = $state<Resource<Record<string, unknown>>>(empty());
let teams = $state<Resource<unknown[]>>(empty());
let matches = $state<Resource<unknown[]>>(empty());
let rankings = $state<Resource<Record<string, unknown>>>(empty());
let oprs = $state<Resource<Record<string, unknown>>>(empty());
let coprs = $state<Resource<Record<string, unknown>>>(empty());
let insights = $state<Resource<Record<string, unknown>>>(empty());
let epa = $state<Resource<Record<string, number>>>(empty());

const ALL = [event, teams, matches, rankings, oprs, coprs, insights, epa];

function resetResources(): void {
  for (const res of ALL) {
    res.data = null;
    res.error = null;
    res.loading = false;
  }
}

async function load<T>(res: Resource<T>, path: string): Promise<void> {
  res.loading = true;
  res.error = null;
  try {
    res.data = await apiGet<T>(path);
  } catch (cause) {
    res.error = cause instanceof ApiError ? cause.message : "Could not load from The Blue Alliance.";
  } finally {
    res.loading = false;
  }
}

async function loadAll(key: string): Promise<void> {
  await Promise.all([
    load(event, `/api/tba/event/${key}`),
    load(teams, `/api/tba/event/${key}/teams`),
    load(matches, `/api/tba/event/${key}/matches`),
    load(rankings, `/api/tba/event/${key}/rankings`),
    load(oprs, `/api/tba/event/${key}/oprs`),
    load(coprs, `/api/tba/event/${key}/coprs`),
    load(insights, `/api/tba/event/${key}/insights`),
    load(epa, `/api/statbotics/event/${key}`),
  ]);
}

/**
 * The current event for this workspace and its cached TBA data. `currentEventKey` is
 * persisted server-side per team_number (see /api/workspace/event); everything else is a
 * view onto TBA, refetched on `setEvent` and (for the parts that move during play) on
 * `refresh`.
 */
export const eventStore = {
  get currentEventKey(): string | null { return currentEventKey; },
  get bootLoading(): boolean { return bootLoading; },
  get event(): Resource<Record<string, unknown>> { return event; },
  get teams(): Resource<unknown[]> { return teams; },
  get matches(): Resource<unknown[]> { return matches; },
  get rankings(): Resource<Record<string, unknown>> { return rankings; },
  get oprs(): Resource<Record<string, unknown>> { return oprs; },
  get coprs(): Resource<Record<string, unknown>> { return coprs; },
  get insights(): Resource<Record<string, unknown>> { return insights; },
  get epa(): Resource<Record<string, number>> { return epa; },

  async init(): Promise<void> {
    bootLoading = true;
    try {
      const { eventKey } = await apiGet<{ eventKey: string | null }>("/api/workspace/event");
      currentEventKey = eventKey;
      if (eventKey) await loadAll(eventKey);
    } catch {
      /* a 401 has already redirected; anything else leaves the picker showing */
    } finally {
      bootLoading = false;
    }
  },

  async setEvent(key: string): Promise<void> {
    await apiSend("PUT", "/api/workspace/event", { eventKey: key });
    currentEventKey = key;
    resetResources();
    await loadAll(key);
  },

  async refresh(): Promise<void> {
    if (!currentEventKey) return;
    await Promise.all([
      load(matches, `/api/tba/event/${currentEventKey}/matches`),
      load(rankings, `/api/tba/event/${currentEventKey}/rankings`),
      load(oprs, `/api/tba/event/${currentEventKey}/oprs`),
      load(coprs, `/api/tba/event/${currentEventKey}/coprs`),
      load(epa, `/api/statbotics/event/${currentEventKey}`),
    ]);
  },
};
