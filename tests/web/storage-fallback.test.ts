import { afterEach, beforeEach, describe, expect, it } from "vitest";

import { __resetStorage, storageBackendName, storageCommands } from "$lib/native/web/storage";

// These run with no `indexedDB` global (the other storage tests inject
// fake-indexeddb; this file deliberately does not), so the resolver has to fall
// past IndexedDB — to localStorage when present, otherwise to memory.

const get = (key: string) => storageCommands.storage_get({ key });
const set = (key: string, value: unknown) => storageCommands.storage_set({ key, value });
const entries = () => storageCommands.storage_entries({});

/**
 * Minimal Web Storage stand-in: data keys are plain own-enumerable properties
 * (so `Object.keys()` lists them, like a real `localStorage`); the API methods
 * live non-enumerably on the prototype.
 */
function fakeLocalStorage(): Storage {
  const store = Object.create({
    getItem(this: Record<string, string>, k: string) {
      return Object.prototype.hasOwnProperty.call(this, k) ? this[k] : null;
    },
    setItem(this: Record<string, string>, k: string, v: string) {
      this[k] = String(v);
    },
    removeItem(this: Record<string, string>, k: string) {
      delete this[k];
    },
  });
  return store as Storage;
}

describe("storage backend fallback", () => {
  beforeEach(() => __resetStorage());
  afterEach(() => {
    delete (globalThis as { localStorage?: unknown }).localStorage;
    return __resetStorage();
  });

  it("uses localStorage when IndexedDB is unavailable", async () => {
    (globalThis as { localStorage?: unknown }).localStorage = fakeLocalStorage();

    expect(await storageBackendName()).toBe("localstorage");
    await set("teamNumber", "4143");
    await set("appData", [["Q1"]]);
    expect(await get("teamNumber")).toBe("4143");
    expect(await get("appData")).toEqual([["Q1"]]);
    expect(await get("missing")).toBeNull();
    expect(await entries()).toEqual([
      ["appData", [["Q1"]]],
      ["teamNumber", "4143"],
    ]);
  });

  it("falls all the way to memory when neither store is available", async () => {
    expect(await storageBackendName()).toBe("memory");
    await set("k", { a: 1 });
    expect(await get("k")).toEqual({ a: 1 });
    // the memory backend clones on the way out
    const first = (await get("k")) as { a: number };
    first.a = 99;
    expect(await get("k")).toEqual({ a: 1 });
  });
});
