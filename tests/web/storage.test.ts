import { indexedDB as fakeIndexedDb } from "fake-indexeddb";
import { beforeEach, describe, expect, it } from "vitest";

Object.defineProperty(globalThis, "indexedDB", { configurable: true, value: fakeIndexedDb });

import { __resetStorage, storageCommands } from "$lib/native/web/storage";

const get = (key: string) => storageCommands.storage_get({ key });
const getMany = (keys: string[]) => storageCommands.storage_get_many({ keys });
const set = (key: string, value: unknown) => storageCommands.storage_set({ key, value });
const del = (key: string) => storageCommands.storage_delete({ key });
const clear = () => storageCommands.storage_clear({});
const entries = () => storageCommands.storage_entries({});

beforeEach(async () => {
  await __resetStorage();
  await new Promise<void>((resolve) => {
    const request = fakeIndexedDb.deleteDatabase("colosseum");
    request.onsuccess = () => resolve();
    request.onerror = () => resolve();
    request.onblocked = () => resolve();
  });
});

describe("web storage port (IndexedDB)", () => {
  it("round trips arbitrary JSON values", async () => {
    await set("teamNumber", "4143");
    await set("appData", [["Q1", "1", "2", "3"], { nested: true }]);
    expect(await get("teamNumber")).toBe("4143");
    expect(await get("appData")).toEqual([["Q1", "1", "2", "3"], { nested: true }]);
  });

  it("returns null (not undefined) for a missing key", async () => {
    expect(await get("nope")).toBeNull();
  });

  it("get_many preserves order and fills gaps with null", async () => {
    await set("a", 1);
    await set("c", 3);
    expect(await getMany(["a", "b", "c"])).toEqual([1, null, 3]);
  });

  it("delete removes a single key; clear wipes everything", async () => {
    await set("a", 1);
    await set("b", 2);
    await del("a");
    expect(await get("a")).toBeNull();
    expect(await get("b")).toBe(2);
    await clear();
    expect(await entries()).toEqual([]);
  });

  it("entries come back sorted by key, matching the Rust BTreeMap", async () => {
    await set("gamma", 3);
    await set("alpha", 1);
    await set("beta", 2);
    expect(await entries()).toEqual([
      ["alpha", 1],
      ["beta", 2],
      ["gamma", 3],
    ]);
  });

  it("set overwrites an existing key", async () => {
    await set("k", "first");
    await set("k", "second");
    expect(await get("k")).toBe("second");
  });
});
