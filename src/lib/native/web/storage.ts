import type { WebCommandHandler } from "./index";

/**
 * Browser port of the `storage_*` commands (commands.rs -> `JsonFileStore` in
 * adapters.rs): a flat string -> JSON key/value store. The desktop build keeps
 * this in `colosseum.json` under the app data dir; the web build keeps it in an
 * IndexedDB object store, which — like the Rust `BTreeMap` — iterates keys in
 * ascending order, so `storage_entries` returns the same ordering on both.
 *
 * `idb-keyval` is deliberately not used (it isn't a dependency and the surface
 * here is tiny). Values go through IndexedDB's structured clone, which round
 * trips every JSON value losslessly.
 */
const DB_NAME = "colosseum";
const STORE = "kv";

let dbPromise: Promise<IDBDatabase> | null = null;

function openDb(): Promise<IDBDatabase> {
  if (dbPromise) return dbPromise;
  dbPromise = new Promise<IDBDatabase>((resolve, reject) => {
    if (typeof indexedDB === "undefined") {
      reject(new Error("this browser has no IndexedDB; local storage is unavailable"));
      return;
    }
    const request = indexedDB.open(DB_NAME, 1);
    request.onupgradeneeded = () => {
      if (!request.result.objectStoreNames.contains(STORE)) request.result.createObjectStore(STORE);
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error ?? new Error("could not open the local database"));
  });
  // A failed open must not be cached forever.
  dbPromise.catch(() => {
    dbPromise = null;
  });
  return dbPromise;
}

function tx<T>(mode: IDBTransactionMode, run: (store: IDBObjectStore) => IDBRequest<T>): Promise<T> {
  return openDb().then(
    (db) =>
      new Promise<T>((resolve, reject) => {
        const transaction = db.transaction(STORE, mode);
        const request = run(transaction.objectStore(STORE));
        transaction.onabort = () => reject(transaction.error ?? new Error("storage transaction aborted"));
        request.onsuccess = () => resolve(request.result);
        request.onerror = () => reject(request.error ?? new Error("storage request failed"));
      }),
  );
}

/** Low-level accessors, shared with the model port (./model.ts). */
export async function storageGet(key: string): Promise<unknown> {
  const value = await tx<unknown>("readonly", (store) => store.get(key));
  return value === undefined ? null : value;
}
export async function storageSet(key: string, value: unknown): Promise<void> {
  await tx("readwrite", (store) => store.put(value, key));
}

async function entries(): Promise<Array<[string, unknown]>> {
  const db = await openDb();
  return new Promise((resolve, reject) => {
    const out: Array<[string, unknown]> = [];
    const transaction = db.transaction(STORE, "readonly");
    const cursorRequest = transaction.objectStore(STORE).openCursor();
    cursorRequest.onsuccess = () => {
      const cursor = cursorRequest.result;
      if (cursor) {
        out.push([String(cursor.key), cursor.value]);
        cursor.continue();
      } else {
        resolve(out);
      }
    };
    cursorRequest.onerror = () => reject(cursorRequest.error ?? new Error("storage cursor failed"));
  });
}

export const storageCommands: Record<string, WebCommandHandler> = {
  storage_get: (args) => storageGet(String(args.key)),
  storage_get_many: (args) => {
    const keys = Array.isArray(args.keys) ? (args.keys as unknown[]).map(String) : [];
    return Promise.all(keys.map(storageGet));
  },
  storage_set: async (args) => {
    await storageSet(String(args.key), args.value);
    return null;
  },
  storage_delete: async (args) => {
    await tx("readwrite", (store) => store.delete(String(args.key)));
    return null;
  },
  storage_clear: async () => {
    await tx("readwrite", (store) => store.clear());
    return null;
  },
  storage_entries: () => entries(),
};

/**
 * Test-only: close and drop the cached connection so a fresh IndexedDB (e.g. a
 * new fake-indexeddb, or one about to be `deleteDatabase`d) is picked up. An
 * open connection would otherwise block `deleteDatabase`.
 */
export async function __resetStorage(): Promise<void> {
  const pending = dbPromise;
  dbPromise = null;
  if (pending) {
    try {
      (await pending).close();
    } catch {
      /* already closed / failed to open */
    }
  }
}
