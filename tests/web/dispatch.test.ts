import { afterEach, describe, expect, it } from "vitest";

import { webCommands, webInvoke } from "$lib/native/web";

// webInvoke is the browser side of the `call()` seam in src/lib/native/api.ts.

describe("webInvoke dispatch", () => {
  const added: string[] = [];
  afterEach(() => {
    for (const key of added.splice(0)) delete webCommands[key];
  });

  it("throws a clear message for a command with no browser implementation", async () => {
    await expect(webInvoke("totally_not_a_command")).rejects.toThrow(/web build yet/);
  });

  it("passes the argument record to the handler and returns its result", async () => {
    webCommands.__test_echo = (args) => args;
    added.push("__test_echo");
    await expect(webInvoke("__test_echo", { a: 1, b: "x" })).resolves.toEqual({ a: 1, b: "x" });
  });

  it("propagates a handler's thrown value (for ../api.ts to wrap)", async () => {
    webCommands.__test_boom = () => {
      throw "kaboom";
    };
    added.push("__test_boom");
    await expect(webInvoke("__test_boom")).rejects.toBe("kaboom");
  });

  it("normalises a non-object args value to an empty record", async () => {
    webCommands.__test_args = (args) => args;
    added.push("__test_args");
    await expect(webInvoke("__test_args", [1, 2, 3] as never)).resolves.toEqual({});
  });
});
