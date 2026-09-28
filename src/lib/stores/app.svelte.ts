import { native } from "$lib/native/api";
import type { CreateMatchInput, MatchPacket, StrategyMatch } from "$lib/native/types";
import { ApiError } from "$lib/api/http";
import * as boards from "$lib/api/whiteboards";
import { clonePacket } from "$lib/features/runtime";

import { toast } from "./toast.svelte";

export type Screen = "schedule" | "teams" | "team" | "picklist" | "scout" | "whiteboard";

let screen = $state<Screen>("schedule");
let packets = $state<MatchPacket[]>([]);
let activeMatchId = $state<string | null>(null);
let selectedTeam = $state<number | null>(null);
let scoutMatchKey = $state<string | null>(null);
let scoutTeam = $state<number | null>(null);
let loading = $state(true);
let saving = $state(false);
let initialized = false;
let initPromise: Promise<void> | null = null;
let writeQueue: Promise<void> = Promise.resolve();
let pendingWrites = 0;

// id -> the server's `updatedAt` for that board when we last saw it. Sent back on a PUT so
// the server can flag a write that would clobber another device's newer edit.
const seenAt = new Map<string, string>();

function project(packet: MatchPacket): StrategyMatch {
  return {
    id: packet[7],
    matchName: packet[0],
    redOne: packet[1],
    redTwo: packet[2],
    redThree: packet[3],
    blueOne: packet[4],
    blueTwo: packet[5],
    blueThree: packet[6],
    tbaMatchKey: packet[10] ?? null,
    red: [packet[1], packet[2], packet[3]],
    blue: [packet[4], packet[5], packet[6]],
    packet,
    ...(packet[9] ? { tbaEventKey: packet[9] } : {}),
    ...(packet[11] !== null && packet[11] !== undefined ? { tbaYear: packet[11] } : {}),
    ...(packet[12] ? { fieldMetadata: packet[12] } : {}),
  };
}

function setPackets(next: MatchPacket[]): void {
  packets = next.map((packet) => clonePacket(packet));
}

function replaceInMemory(packet: MatchPacket): void {
  const index = packets.findIndex((candidate) => candidate[7] === packet[7]);
  if (index === -1) return;
  const next = [...packets];
  next[index] = clonePacket(packet);
  packets = next;
}

function queueWrite<T>(operation: () => Promise<T>): Promise<T> {
  pendingWrites += 1;
  saving = true;
  const task = writeQueue.then(operation);
  writeQueue = task.then(() => undefined, () => undefined);
  return task.finally(() => {
    pendingWrites -= 1;
    saving = pendingWrites > 0;
  });
}

/** Pull the current server copy of one board into memory (best effort). */
async function refreshBoard(id: string): Promise<void> {
  try {
    const fresh = await boards.getBoard(id);
    seenAt.set(id, fresh.updatedAt);
    replaceInMemory(fresh.packet);
  } catch {
    /* offline or gone — keep the local copy */
  }
}

async function persist(packet: MatchPacket): Promise<void> {
  const normalized = await native.matches.normalizePacket(packet);
  const id = normalized[7];
  try {
    const saved = await boards.updateBoard(id, normalized, seenAt.get(id));
    seenAt.set(id, saved.updatedAt);
  } catch (error) {
    if (error instanceof ApiError && error.status === 409) {
      toast.show(
        "This board was changed on another device — your latest edit was saved over it.",
        "warning",
        8000,
      );
      const forced = await boards.updateBoard(id, normalized);
      seenAt.set(id, forced.updatedAt);
    } else if (error instanceof ApiError && error.status === 404) {
      const created = await boards.createBoard(normalized);
      seenAt.set(id, created.updatedAt);
    } else {
      throw error;
    }
  }
  replaceInMemory(normalized);
}

async function createMatch(input: CreateMatchInput): Promise<string>;
async function createMatch(matchName: string, red: readonly string[], blue: readonly string[]): Promise<string>;
async function createMatch(
  inputOrName: CreateMatchInput | string,
  red?: readonly string[],
  blue?: readonly string[],
): Promise<string> {
  const input: CreateMatchInput =
    typeof inputOrName === "string"
      ? {
          matchName: inputOrName,
          redTeams: [red?.[0] ?? "", red?.[1] ?? "", red?.[2] ?? ""],
          blueTeams: [blue?.[0] ?? "", blue?.[1] ?? "", blue?.[2] ?? ""],
        }
      : inputOrName;
  return queueWrite(async () => {
    const packet = await native.matches.createPacket(input);
    const created = await boards.createBoard(packet);
    seenAt.set(created.id, created.updatedAt);
    packets = [...packets, clonePacket(created.packet)];
    return created.id;
  });
}

/**
 * Persistent match state. Canvas code updates its in-memory scene freely and calls
 * `commitPacket` only at a completed edit boundary (pointer-up / debounce). Boards live on
 * the server, scoped to the workspace; this store never persists them locally.
 */
export const app = {
  get screen(): Screen { return screen; },
  /** Direct navigation between the hub screens. `whiteboard` / `team` / `scout` are
   * entered through `openMatch*` / `openTeam` / `openScout`, not this setter. */
  set screen(next: Screen) { screen = next; },

  openTeam(team: number): void {
    selectedTeam = team;
    screen = "team";
  },

  openScout(matchKey: string, team: number | null = null): void {
    scoutMatchKey = matchKey;
    scoutTeam = team;
    screen = "scout";
  },

  get matches(): StrategyMatch[] { return packets.map(project); },
  get activeMatch(): StrategyMatch | null {
    const packet = activeMatchId === null ? undefined : packets.find((item) => item[7] === activeMatchId);
    return packet ? project(packet) : null;
  },
  get activeMatchId(): string | null { return activeMatchId; },
  get selectedTeam(): number | null { return selectedTeam; },
  get scoutMatchKey(): string | null { return scoutMatchKey; },
  get scoutTeam(): number | null { return scoutTeam; },
  get loading(): boolean { return loading; },
  get saving(): boolean { return saving; },

  init(): Promise<void> {
    if (initialized) return Promise.resolve();
    if (initPromise) return initPromise;
    initPromise = (async () => {
      loading = true;
      try {
        const { boards: list } = await boards.listBoards();
        seenAt.clear();
        for (const board of list) seenAt.set(board.id, board.updatedAt);
        setPackets(list.map((board) => board.packet));
        initialized = true;
      } catch (error) {
        console.error("Failed to load whiteboards", error);
        toast.show("Could not load saved boards.", "error");
      } finally {
        loading = false;
        initPromise = null;
      }
    })();
    return initPromise;
  },

  openMatch(id: string): boolean {
    if (!packets.some((packet) => packet[7] === id)) return false;
    activeMatchId = id;
    screen = "whiteboard";
    void refreshBoard(id);
    return true;
  },

  closeMatch(): void {
    activeMatchId = null;
    screen = "schedule";
  },

  /** Open the whiteboard for a TBA match, creating its board on first use. */
  async openMatchByTbaKey(
    tbaMatchKey: string,
    red: readonly string[],
    blue: readonly string[],
    matchName: string,
    tbaEventKey: string,
    tbaYear?: number,
  ): Promise<string> {
    const existing = packets.find((packet) => packet[10] === tbaMatchKey);
    if (existing) {
      this.openMatch(existing[7]);
      return existing[7];
    }
    const id = await createMatch({
      matchName,
      redTeams: [red[0] ?? "", red[1] ?? "", red[2] ?? ""],
      blueTeams: [blue[0] ?? "", blue[1] ?? "", blue[2] ?? ""],
      tbaEventKey,
      tbaMatchKey,
      ...(tbaYear ? { tbaYear } : {}),
    });
    this.openMatch(id);
    return id;
  },

  createMatch,

  createBasicMatch(matchName: string, red: readonly string[], blue: readonly string[]): Promise<string> {
    return createMatch(matchName, red, blue);
  },

  async duplicateMatch(id: string): Promise<string> {
    const source = packets.find((packet) => packet[7] === id);
    if (!source) throw new Error("Cannot duplicate a match that is not loaded.");
    return queueWrite(async () => {
      const fresh = await native.matches.createPacket({
        matchName: `Copy of ${source[0]}`,
        redTeams: [source[1], source[2], source[3]],
        blueTeams: [source[4], source[5], source[6]],
        ...(source[9] ? { tbaEventKey: source[9] } : {}),
        ...(source[10] ? { tbaMatchKey: source[10] } : {}),
        ...(source[11] !== null && source[11] !== undefined ? { tbaYear: source[11] } : {}),
      });
      const copy = clonePacket(source);
      copy[0] = fresh[0];
      copy[7] = fresh[7];
      copy[10] = fresh[10] ?? null;
      const created = await boards.createBoard(copy);
      seenAt.set(created.id, created.updatedAt);
      packets = [...packets, clonePacket(created.packet)];
      return created.id;
    });
  },

  /** Persist one fully composed packet after a form or canvas edit. */
  commitPacket(packet: MatchPacket): Promise<void> {
    return queueWrite(() => persist(packet));
  },

  async deleteMatch(id: string): Promise<void> {
    if (!packets.some((packet) => packet[7] === id)) return;
    await queueWrite(async () => {
      await boards.deleteBoard(id);
      seenAt.delete(id);
      packets = packets.filter((packet) => packet[7] !== id);
      if (activeMatchId === id) this.closeMatch();
    });
  },
};
