import type { WebCommandHandler } from "./index";

/**
 * Browser port of the `storage_*` commands (commands.rs -> `JsonFileStore` in
 * adapters.rs): a flat string -> JSON key/value store.
 *
 * Three backends are tried in order so the app still runs where a browser has
 * locked storage down (Safari Private Browsing, "Block All Cookies", an iPad
 * hitting a bare-IP origin over http, ...):
 *
 *   1. IndexedDB  — the real thing; survives reloads, no practical size limit.
 *   2. localStorage — smaller and synchronous, but widely available; namespaced
 *      under `colosseum:`.
 *   3. in-memory  — last resort so the session is at least usable; NOT persisted.
 *
 * All three iterate keys in ascending order, matching the Rust `BTreeMap`, so
 * `storage_entries` agrees across every backend and the desktop build.
 */
const DB_NAME = "colosseum";
const STORE = "kv";
const LS_PREFIX = "colosseum:";

interface KvBackend {
  readonly name: "indexeddb" | "localstorage" | "memory";
  get(key: string): Promise<unknown>;
  set(key: string, value: unknown): Promise<void>;
  delete(key: string): Promise<void>;
  clear(): Promise<void>;
  entries(): Promise<Array<[string, unknown]>>;
  close?(): void;
}

// --- 1. IndexedDB -----------------------------------------------------------
function openDb(): Promise<IDBDatabase> {
  return new Promise<IDBDatabase>((resolve, reject) => {
    if (typeof indexedDB === "undefined") {
      reject(new Error("IndexedDB is not available"));
      return;
    }
    const request = indexedDB.open(DB_NAME, 1);
    request.onupgradeneeded = () => {
      if (!request.result.objectStoreNames.contains(STORE)) request.result.createObjectStore(STORE);
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error ?? new Error("could not open the local database"));
    request.onblocked = () => reject(new Error("the local database is blocked by another tab"));
  });
}

async function makeIndexedDb(): Promise<KvBackend> {
  const db = await openDb();
  const tx = <T>(mode: IDBTransactionMode, run: (s: IDBObjectStore) => IDBRequest<T>): Promise<T> =>
    new Promise<T>((resolve, reject) => {
      const transaction = db.transaction(STORE, mode);
      const request = run(transaction.objectStore(STORE));
      transaction.onabort = () => reject(transaction.error ?? new Error("storage transaction aborted"));
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error ?? new Error("storage request failed"));
    });

  // Prove writes actually work (Safari can hand back a DB that then throws).
  await tx("readwrite", (s) => s.put(1, "__probe__"));
  await tx("readwrite", (s) => s.delete("__probe__"));

  return {
    name: "indexeddb",
    close: () => db.close(),
    async get(key) {
      const value = await tx<unknown>("readonly", (s) => s.get(key));
      return value === undefined ? null : value;
    },
    set: (key, value) => tx("readwrite", (s) => s.put(value, key)).then(() => undefined),
    delete: (key) => tx("readwrite", (s) => s.delete(key)).then(() => undefined),
    clear: () => tx("readwrite", (s) => s.clear()).then(() => undefined),
    entries: () =>
      new Promise((resolve, reject) => {
        const out: Array<[string, unknown]> = [];
        const cursorRequest = db.transaction(STORE, "readonly").objectStore(STORE).openCursor();
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
      }),
  };
}

// --- 2. localStorage ------------------------------------------------------------
function makeLocalStorage(): KvBackend {
  const probe = `${LS_PREFIX}__probe__`;
  localStorage.setItem(probe, "1"); // throws in Private Browsing / when cookies are blocked
  localStorage.removeItem(probe);

  const keys = () =>
    Object.keys(localStorage)
      .filter((k) => k.startsWith(LS_PREFIX))
      .map((k) => k.slice(LS_PREFIX.length));

  return {
    name: "localstorage",
    get: (key) => {
      const raw = localStorage.getItem(LS_PREFIX + key);
      return Promise.resolve(raw === null ? null : (JSON.parse(raw) as unknown));
    },
    set: (key, value) => {
      localStorage.setItem(LS_PREFIX + key, JSON.stringify(value));
      return Promise.resolve();
    },
    delete: (key) => {
      localStorage.removeItem(LS_PREFIX + key);
      return Promise.resolve();
    },
    clear: () => {
      for (const key of keys()) localStorage.removeItem(LS_PREFIX + key);
      return Promise.resolve();
    },
    entries: () =>
      Promise.resolve(
        keys()
          .sort()
          .map((key) => [key, JSON.parse(localStorage.getItem(LS_PREFIX + key) as string)] as [string, unknown]),
      ),
  };
}

// --- 3. in-memory ------------------------------------------------------------
function makeMemory(): KvBackend {
  const map = new Map<string, unknown>();
  const clone = (v: unknown) => (v === null || typeof v !== "object" ? v : JSON.parse(JSON.stringify(v)));
  return {
    name: "memory",
    get: (key) => Promise.resolve(map.has(key) ? clone(map.get(key)) : null),
    set: (key, value) => {
      map.set(key, clone(value));
      return Promise.resolve();
    },
    delete: (key) => {
      map.delete(key);
      return Promise.resolve();
    },
    clear: () => {
      map.clear();
      return Promise.resolve();
    },
    entries: () =>
      Promise.resolve([...map.keys()].sort().map((key) => [key, clone(map.get(key))] as [string, unknown])),
  };
}

// --- backend resolution ------------------------------------------------------
let backendPromise: Promise<KvBackend> | null = null;

function backend(): Promise<KvBackend> {
  if (backendPromise) return backendPromise;
  backendPromise = (async () => {
    try {
      return await makeIndexedDb();
    } catch {
      /* fall through */
    }
    try {
      return makeLocalStorage();
    } catch {
      /* fall through */
    }
    console.warn(
      "Colosseum: no persistent storage is available (private browsing or blocked site data?). " +
        "The app will work, but nothing will be saved between reloads.",
    );
    return makeMemory();
  })();
  return backendPromise;
}

/** Low-level accessors, shared with the model port (./model.ts). */
export async function storageGet(key: string): Promise<unknown> {
  return (await backend()).get(key);
}
export async function storageSet(key: string, value: unknown): Promise<void> {
  return (await backend()).set(key, value);
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
    await (await backend()).delete(String(args.key));
    return null;
  },
  storage_clear: async () => {
    await (await backend()).clear();
    return null;
  },
  storage_entries: async () => (await backend()).entries(),
};

/** Which backend is in use (for diagnostics). */
export async function storageBackendName(): Promise<KvBackend["name"]> {
  return (await backend()).name;
}

/**
 * Test-only: close the current backend and drop it so a fresh environment (e.g.
 * a new fake-indexeddb, or one about to be `deleteDatabase`d) is picked up. An
 * open IndexedDB connection would otherwise block `deleteDatabase`.
 */
export async function __resetStorage(): Promise<void> {
  const pending = backendPromise;
  backendPromise = null;
  if (pending) {
    try {
      (await pending).close?.();
    } catch {
      /* already closed / failed to open */
    }
  }
}
