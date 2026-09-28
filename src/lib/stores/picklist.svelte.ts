import * as api from "$lib/api/picklist";
import type { PickEntry, PickTag } from "$lib/api/picklist";

let entries = $state<PickEntry[]>([]);
let loadedEvent = $state<string | null>(null);
let loading = $state(false);
let error = $state<string | null>(null);

async function run(op: () => Promise<{ entries: PickEntry[] }>): Promise<void> {
  error = null;
  try {
    entries = (await op()).entries;
  } catch (cause) {
    error = cause instanceof Error ? cause.message : "Pick list update failed.";
    throw cause;
  }
}

/**
 * The current workspace's pick list for one event. Every mutation returns the full
 * re-ordered list from the server, so the local copy stays authoritative without manual
 * position bookkeeping.
 */
export const pickList = {
  get entries(): PickEntry[] { return entries; },
  get loading(): boolean { return loading; },
  get error(): string | null { return error; },
  has(team: number): boolean { return entries.some((entry) => entry.team === team); },

  async load(eventKey: string | null): Promise<void> {
    if (!eventKey) { entries = []; loadedEvent = null; return; }
    if (loadedEvent === eventKey) return;
    loading = true;
    try {
      entries = (await api.getPickList(eventKey)).entries;
      loadedEvent = eventKey;
      error = null;
    } catch (cause) {
      error = cause instanceof Error ? cause.message : "Could not load the pick list.";
    } finally {
      loading = false;
    }
  },

  add: (eventKey: string, team: number) => run(() => api.addPick(eventKey, team)),
  remove: (eventKey: string, team: number) => run(() => api.removePick(eventKey, team)),
  setNote: (eventKey: string, team: number, note: string) => run(() => api.patchPick(eventKey, team, { note })),
  setTag: (eventKey: string, team: number, tag: PickTag) => run(() => api.patchPick(eventKey, team, { tag })),
  reorder: (eventKey: string, teams: number[]) => run(() => api.reorderPicks(eventKey, teams)),

  move(eventKey: string, team: number, delta: number): Promise<void> {
    const order = entries.map((entry) => entry.team);
    const from = order.indexOf(team);
    const to = from + delta;
    if (from < 0 || to < 0 || to >= order.length) return Promise.resolve();
    order.splice(to, 0, order.splice(from, 1)[0]);
    return this.reorder(eventKey, order);
  },
};
