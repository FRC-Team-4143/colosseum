import type { WebCommandHandler } from "./index";
import { createMatch, matchFromPacket, matchToPacket } from "./match";
import { storageGet, storageSet } from "./storage";

/**
 * Browser port of the `model_*` and `match_*` commands (commands.rs). Same
 * contract as the Rust handlers:
 *   - the canonical store key is `appData` (an array of packets); a legacy
 *     `matchIds` list is read as a fallback but, like the Rust *command* layer
 *     (not `helpers/model.rs`), never rewritten.
 *   - every packet is round-tripped through the codec on the way in and out, so
 *     stored data is always normalised.
 *   - ids must be unique across the collection and within a batch add.
 */
const APP_DATA_KEY = "appData";
const MATCH_IDS_KEY = "matchIds";

/**
 * The Rust side holds one `Mutex<JsonFileStore>` for a whole command, so a
 * read-modify-write is atomic. IndexedDB gives no such lock across awaits, so
 * serialise every `model_*` command through one chain to match that guarantee.
 */
let chain: Promise<unknown> = Promise.resolve();
function serialize<T>(op: () => Promise<T>): Promise<T> {
  const result = chain.then(op, op);
  chain = result.then(
    () => undefined,
    () => undefined,
  );
  return result;
}

function packetId(packet: unknown): string | null {
  return Array.isArray(packet) && typeof packet[7] === "string" ? packet[7] : null;
}

/** Mirrors `loaded_packets` in commands.rs. */
async function loadedPackets(): Promise<unknown[][]> {
  let raw = await storageGet(APP_DATA_KEY);
  if (raw === null) {
    const ids = await storageGet(MATCH_IDS_KEY);
    if (Array.isArray(ids)) {
      const collected: unknown[] = [];
      for (const id of ids) {
        if (typeof id !== "string") continue;
        const packet = await storageGet(id);
        if (packet !== null) collected.push(packet);
      }
      raw = collected;
    }
  }
  const packets = Array.isArray(raw) ? raw : [];
  const out: unknown[][] = [];
  for (const packet of packets) {
    try {
      out.push(matchToPacket(matchFromPacket(packet)));
    } catch {
      // Corrupt packets are skipped, exactly like `Match::from_packet(...).ok()`.
    }
  }
  return out;
}

async function addPackets(packets: unknown[]): Promise<string[]> {
  const models = packets.map(matchFromPacket); // throws (string) on the first invalid one
  if (models.length === 0) return [];

  const stored = await loadedPackets();
  const ids = new Set<string>();
  for (const packet of stored) {
    const id = packetId(packet);
    if (id !== null) ids.add(id);
  }
  for (const model of models) {
    if (ids.has(model.id)) throw `a match with id ${model.id} already exists`;
    ids.add(model.id);
  }

  const addedIds = models.map((model) => model.id);
  await storageSet(APP_DATA_KEY, [...stored, ...models.map(matchToPacket)]);
  return addedIds;
}

async function replacePacket(packet: unknown): Promise<string> {
  const model = matchFromPacket(packet);
  const packets = await loadedPackets();
  const index = packets.findIndex((candidate) => packetId(candidate) === model.id);
  if (index < 0) throw `match ${model.id} does not exist`;
  packets[index] = matchToPacket(model);
  await storageSet(APP_DATA_KEY, packets);
  return model.id;
}

export const modelCommands: Record<string, WebCommandHandler> = {
  model_load_packets: () => serialize(loadedPackets),
  model_add_packet: (args) => serialize(async () => (await addPackets([args.packet]))[0]),
  model_add_packets: (args) =>
    serialize(() => addPackets(Array.isArray(args.packets) ? args.packets : [])),
  model_replace_packet: (args) => serialize(() => replacePacket(args.packet)),
  model_delete_match: (args) =>
    serialize(async () => {
      const id = String(args.id);
      const packets = (await loadedPackets()).filter((packet) => packetId(packet) !== id);
      await storageSet(APP_DATA_KEY, packets);
      return null;
    }),
  model_clear_matches: () =>
    serialize(async () => {
      await storageSet(APP_DATA_KEY, []);
      return null;
    }),

  match_create_packet: (args) => {
    const red = Array.isArray(args.redTeams) ? args.redTeams : [];
    const blue = Array.isArray(args.blueTeams) ? args.blueTeams : [];
    if (red.length !== 3 || blue.length !== 3) {
      throw "a match requires exactly three red and three blue teams";
    }
    const model = createMatch(
      String(args.matchName ?? ""),
      red.map(String) as [string, string, string],
      blue.map(String) as [string, string, string],
      null,
      null,
      (args.tbaEventKey as string | undefined) ?? null,
      (args.tbaMatchKey as string | undefined) ?? null,
      (args.tbaYear as number | undefined) ?? null,
    );
    return matchToPacket(model);
  },
  match_normalize_packet: (args) => matchToPacket(matchFromPacket(args.packet)),
};
