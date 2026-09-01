import type { WebCommandHandler } from "./index";

/**
 * Browser port of `platform_validate_url` / `platform_open_url`
 * (src-tauri/src/helpers/platform.rs). The validation mirrors
 * `validate_external_url` in intent — reject anything that is not an absolute
 * http(s) URL with a plausible host — so the web build refuses the same links
 * the desktop build refuses. Error strings match the Rust `Display` impl so
 * `NativeCommandError` surfaces identical text on both platforms.
 *
 * Whitespace/control detection uses JS `\s` plus the C0/C1 control ranges; this
 * is a hair broader than Rust's `char::is_whitespace | is_control` (it also
 * catches U+FEFF), which only ever means rejecting a slightly larger set.
 */
// eslint-disable-next-line no-control-regex
const WS_OR_CONTROL = /[\s\u0000-\u001f\u007f-\u009f]/;
const HOST_CHARS = /^[A-Za-z0-9.-]+$/;

function isValidPort(port: string): boolean {
  return /^\d+$/.test(port) && Number(port) <= 65535;
}

/** Lenient IPv6 check: hex groups separated by ':', at most one '::' elision. */
function isIpv6(inner: string): boolean {
  if (inner.length === 0 || !/^[0-9A-Fa-f:]+$/.test(inner)) return false;
  const doubleColons = inner.match(/::/g);
  if (doubleColons && doubleColons.length > 1) return false;
  const groups = inner.split(":").filter((group) => group.length > 0);
  if (groups.some((group) => group.length > 4)) return false;
  return doubleColons ? groups.length <= 7 : groups.length === 8;
}

export function validateExternalUrl(url: string): string {
  if (url.length === 0) throw "external URL is empty";
  if (WS_OR_CONTROL.test(url)) throw "external URL contains whitespace or control characters";

  const sep = url.indexOf("://");
  if (sep < 0) throw "only http and https URLs may be opened externally";
  const scheme = url.slice(0, sep).toLowerCase();
  if (scheme !== "http" && scheme !== "https") {
    throw "only http and https URLs may be opened externally";
  }

  const afterScheme = url.slice(sep + 3);
  const authority = afterScheme.split(/[/?#]/, 1)[0] ?? "";
  if (authority.length === 0) throw "external URL has no host";
  if (authority.includes("@") || authority.startsWith(".") || authority.endsWith(".")) {
    throw "external URL host is malformed";
  }

  if (authority.startsWith("[")) {
    const end = authority.indexOf("]");
    if (end < 0 || !isIpv6(authority.slice(1, end))) throw "external URL host is malformed";
    const suffix = authority.slice(end + 1);
    if (suffix.length > 0 && !(suffix.startsWith(":") && isValidPort(suffix.slice(1)))) {
      throw "external URL host is malformed";
    }
  } else {
    const colon = authority.indexOf(":");
    const host = colon < 0 ? authority : authority.slice(0, colon);
    if (host.length === 0 || !HOST_CHARS.test(host)) throw "external URL host is malformed";
    if (colon >= 0 && !isValidPort(authority.slice(colon + 1))) {
      throw "external URL host is malformed";
    }
  }

  return url;
}

export const platformCommands: Record<string, WebCommandHandler> = {
  platform_validate_url: (args) => validateExternalUrl(String(args.url ?? "")),
  platform_open_url: (args) => {
    const url = validateExternalUrl(String(args.url ?? ""));
    window.open(url, "_blank", "noopener,noreferrer");
  },
};
