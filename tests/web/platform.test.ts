import { describe, expect, it } from "vitest";

import { validateExternalUrl } from "$lib/native/web/platform";

// Ported from the tests in src-tauri/src/helpers/platform.rs so the web build
// accepts/rejects exactly what the desktop build does.

/** validateExternalUrl throws a string (Tauri `invoke` rejection shape). */
function rejection(url: string): string | undefined {
  try {
    validateExternalUrl(url);
    return undefined;
  } catch (error) {
    return error as string;
  }
}

describe("web platform URL validation port", () => {
  it("accepts absolute http and https URLs unchanged", () => {
    expect(validateExternalUrl("https://www.thebluealliance.com/event/2026miket")).toBe(
      "https://www.thebluealliance.com/event/2026miket",
    );
    expect(rejection("HTTP://localhost:8005/path?mode=dev#section")).toBeUndefined();
    expect(rejection("https://[::1]:8005/")).toBeUndefined();
  });

  it("rejects non-external or ambiguous schemes", () => {
    for (const value of [
      "",
      "/relative",
      "javascript:alert(1)",
      "tauri://open",
      "https:javascript:alert(1)",
      "ftp://example.com",
    ]) {
      expect(rejection(value), value).toBeDefined();
    }
  });

  it("rejects a missing or malformed authority", () => {
    for (const value of [
      "https://",
      "https:///path",
      "https://user@example.com",
      "https://.example.com",
      "https://example.com.",
      "https://exa mple.com",
      "https://example.com\n/path",
      "https://[::1/path",
      "https://example.com:not-a-port",
      "https://example.com:99999",
    ]) {
      expect(rejection(value), value).toBeDefined();
    }
  });

  it("throws the same message strings as the Rust Display impl", () => {
    expect(rejection("")).toBe("external URL is empty");
    expect(rejection("ftp://example.com")).toBe("only http and https URLs may be opened externally");
    expect(rejection("https:///path")).toBe("external URL has no host");
    expect(rejection("https://.example.com")).toBe("external URL host is malformed");
  });
});
