import { indexedDB as fakeIndexedDb } from "fake-indexeddb";
import { beforeEach, describe, expect, it } from "vitest";

Object.defineProperty(globalThis, "indexedDB", { configurable: true, value: fakeIndexedDb });

import { createMatch, matchToPacket } from "$lib/native/web/match";
import { modelCommands } from "$lib/native/web/model";
import { __resetStorage, storageCommands } from "$lib/native/web/storage";

const load = () => modelCommands.model_load_packets({}) as Promise<unknown[][]>;
const add = (packet: unknown) => modelCommands.model_add_packet({ packet }) as Promise<string>;
const addMany = (packets: unknown[]) => modelCommands.model_add_packets({ packets }) as Promise<string[]>;
const replace = (packet: unknown) => modelCommands.model_replace_packet({ packet }) as Promise<string>;
const del = (id: string) => modelCommands.model_delete_match({ id });
const clear = () => modelCommands.model_clear_matches({});
// match_* handlers are synchronous; wrap so a sync throw surfaces as a rejection
// (webInvoke does the same in production).
const create = async (input: Record<string, unknown>) =>
  modelCommands.match_create_packet(input) as unknown[];
const normalize = async (p: unknown) => modelCommands.match_normalize_packet({ packet: p }) as unknown[];

const packet = (id: string, name = "Q1") =>
  matchToPacket(createMatch(name, ["1", "2", "3"], ["4", "5", "6"], id, null, null, null, null));

beforeEach(async () => {
  await __resetStorage();
  await new Promise<void>((resolve) => {
    const request = fakeIndexedDb.deleteDatabase("colosseum");
    request.onsuccess = () => resolve();
    request.onerror = () => resolve();
    request.onblocked = () => resolve();
  });
});

describe("web model port", () => {
  it("adds and loads normalised packets", async () => {
    const id = await add(packet("m1", "Quals 1"));
    expect(id).toBe("m1");
    const loaded = await load();
    expect(loaded).toHaveLength(1);
    expect(loaded[0][0]).toBe("Quals 1");
    expect(loaded[0][7]).toBe("m1");
  });

  it("rejects a duplicate id against the collection and within a batch", async () => {
    await add(packet("dup"));
    await expect(add(packet("dup"))).rejects.toThrow(/already exists/);
    await expect(addMany([packet("x"), packet("x")])).rejects.toThrow(/already exists/);
  });

  it("replaces one match in place and errors on an unknown id", async () => {
    await addMany([packet("a", "A"), packet("b", "B")]);
    const changed = createMatch("A2", ["9", "9", "9"], ["9", "9", "9"], "a", null, null, null, null);
    await replace(matchToPacket(changed));
    const loaded = await load();
    expect(loaded.map((p) => p[0])).toEqual(["A2", "B"]);
    await expect(replace(packet("ghost"))).rejects.toThrow("match ghost does not exist");
  });

  it("deletes by id and clears everything", async () => {
    await addMany([packet("a"), packet("b")]);
    await del("a");
    expect((await load()).map((p) => p[7])).toEqual(["b"]);
    await clear();
    expect(await load()).toEqual([]);
  });

  it("skips corrupt packets on load", async () => {
    await storageCommands.storage_set({ key: "appData", value: [packet("good"), "junk", packet("good2")] });
    const loaded = await load();
    expect(loaded.map((p) => p[7])).toEqual(["good", "good2"]);
  });

  it("falls back to a legacy matchIds list when appData is absent", async () => {
    await storageCommands.storage_set({ key: "m-legacy", value: packet("m-legacy") });
    await storageCommands.storage_set({ key: "matchIds", value: ["m-legacy"] });
    const loaded = await load();
    expect(loaded).toHaveLength(1);
    expect(loaded[0][7]).toBe("m-legacy");
  });

  it("match_create_packet validates the alliance sizes and builds a packet", async () => {
    await expect(create({ matchName: "Q", redTeams: ["1"], blueTeams: ["2", "3", "4"] })).rejects.toThrow(
      "a match requires exactly three red and three blue teams",
    );
    const built = await create({
      matchName: "Q7",
      redTeams: ["11", "22", "33"],
      blueTeams: ["44", "55", "66"],
      tbaYear: 2026,
    });
    expect(built[0]).toBe("Q7");
    expect(built.slice(1, 7)).toEqual(["11", "22", "33", "44", "55", "66"]);
    expect(typeof built[7]).toBe("string");
  });

  it("match_normalize_packet round-trips through the codec", async () => {
    const built = await create({ matchName: "Q1", redTeams: ["1", "2", "3"], blueTeams: ["4", "5", "6"] });
    expect(await normalize(built)).toEqual(built);
  });
});
