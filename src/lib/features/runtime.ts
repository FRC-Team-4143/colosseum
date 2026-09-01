/**
 * Deep-clone a match packet (or any pure-JSON value). A JSON round trip is used
 * rather than `structuredClone` because packets in the Svelte stores are
 * `$state` proxies, and `structuredClone` throws `DataCloneError` on any Proxy
 * (per the HTML spec — in every engine). Packets are always plain JSON.
 */
export function clonePacket<T>(value: T): T {
  return JSON.parse(JSON.stringify(value)) as T;
}

export function safeFilename(value: string, fallback = "colosseum"): string {
  const cleaned = value
    .trim()
    .replace(/[\\/:*?"<>|\u0000-\u001f]/g, "-")
    .replace(/\s+/g, " ")
    .replace(/^\.+|\.+$/g, "")
    .slice(0, 100);
  return cleaned || fallback;
}

export function dataUrlToBytes(dataUrl: string): Uint8Array {
  const comma = dataUrl.indexOf(",");
  if (comma < 0) throw new Error("Expected a data URL");
  const binary = atob(dataUrl.slice(comma + 1));
  const output = new Uint8Array(binary.length);
  for (let index = 0; index < binary.length; index += 1) output[index] = binary.charCodeAt(index);
  return output;
}
