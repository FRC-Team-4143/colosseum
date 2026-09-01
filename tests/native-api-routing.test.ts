import { beforeEach, describe, expect, it, vi } from "vitest";

// The only seam between the Svelte frontend and the native backend is
// `call()` in src/lib/native/api.ts. Phase 0 adds a browser branch to it; these
// tests pin that the Tauri path is byte-for-byte what it was before, and that
// the browser path never reaches `invoke`.
vi.mock("@tauri-apps/api/core", () => ({
  invoke: vi.fn(),
  isTauri: vi.fn(),
}));

import { invoke, isTauri } from "@tauri-apps/api/core";

import { NativeCommandError, native } from "$lib/native/api";

const invokeMock = vi.mocked(invoke);
const isTauriMock = vi.mocked(isTauri);

beforeEach(() => {
  invokeMock.mockReset();
  isTauriMock.mockReset();
});

describe("native command routing", () => {
  it("calls Tauri invoke unchanged when a native backend is present", async () => {
    isTauriMock.mockReturnValue(true);
    invokeMock.mockResolvedValue({ ok: true });

    const result = await native.config.current();

    expect(invokeMock).toHaveBeenCalledTimes(1);
    expect(invokeMock).toHaveBeenCalledWith("config_current", undefined);
    expect(result).toEqual({ ok: true });
  });

  it("forwards command arguments to invoke untouched", async () => {
    isTauriMock.mockReturnValue(true);
    invokeMock.mockResolvedValue(null);

    await native.storage.set("teamNumber", "4143");
    await native.model.deleteMatch("abc123");

    expect(invokeMock).toHaveBeenNthCalledWith(1, "storage_set", { key: "teamNumber", value: "4143" });
    expect(invokeMock).toHaveBeenNthCalledWith(2, "model_delete_match", { id: "abc123" });
  });

  it("wraps a failed invoke in NativeCommandError (Tauri path, unchanged)", async () => {
    isTauriMock.mockReturnValue(true);
    invokeMock.mockRejectedValue("boom");

    await expect(native.model.loadPackets()).rejects.toBeInstanceOf(NativeCommandError);
    await expect(native.model.loadPackets()).rejects.toMatchObject({ command: "model_load_packets" });
  });

  it("routes to the web implementation and never touches invoke when there is no backend", async () => {
    isTauriMock.mockReturnValue(false);

    const config = await native.config.current();

    expect(config).toMatchObject({ fieldPngPixelWidth: 3510 });
    expect(invokeMock).not.toHaveBeenCalled();
  });
});
