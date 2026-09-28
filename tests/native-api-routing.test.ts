import { describe, expect, it } from "vitest";

import { NativeCommandError, native } from "$lib/native/api";
import type { CreateMatchInput } from "$lib/native/types";

// The only seam between the Svelte frontend and the backend command surface is
// `call()` in src/lib/native/api.ts. Colosseum has no Rust backend: every
// command routes to the browser implementation in src/lib/native/web, and a
// failure there is wrapped in NativeCommandError carrying the command name.
describe("native command routing", () => {
  it("routes commands to the web implementation", async () => {
    const config = await native.config.current();
    expect(config).toMatchObject({ fieldPngPixelWidth: 3510 });
  });

  it("forwards arguments to the web handler", async () => {
    const packet = await native.matches.createPacket({
      matchName: "Quals 1",
      redTeams: ["111", "222", "333"],
      blueTeams: ["444", "555", "666"],
    });
    expect(packet[0]).toBe("Quals 1");
    expect(packet.slice(1, 7)).toEqual(["111", "222", "333", "444", "555", "666"]);
  });

  it("wraps a rejecting command in NativeCommandError", async () => {
    const bad = { matchName: "x", redTeams: ["1", "2"], blueTeams: ["3", "4", "5"] } as unknown as CreateMatchInput;
    await expect(native.matches.createPacket(bad)).rejects.toBeInstanceOf(NativeCommandError);
    await expect(native.matches.createPacket(bad)).rejects.toMatchObject({ command: "match_create_packet" });
  });
});
