import type { WebCommandHandler } from "./index";

/**
 * Browser port of `helpers/qr.rs` — the QR transport framing. Wire format per
 * frame is `IIIITTTT<payload>`: a zero-padded 4-digit chunk index, a 4-digit
 * total, then up to 200 chars of base64. The base64 is of the payload's UTF-8
 * bytes (standard alphabet, `=` padded), and 200 is a multiple of 4 so a chunk
 * boundary never splits a base64 group. Error strings match `QrError`'s Display.
 */
const MAX_CHUNK_PAYLOAD = 200;
const HEADER = 8;

function pad4(n: number): string {
  return String(n).padStart(4, "0");
}

function b64encode(text: string): string {
  const bytes = new TextEncoder().encode(text);
  let binary = "";
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary);
}

function b64decode(b64: string): string {
  if (b64.length % 4 !== 0) throw "QR payload is not valid base64";
  let binary: string;
  try {
    binary = atob(b64);
  } catch {
    throw "QR payload is not valid base64";
  }
  const bytes = Uint8Array.from(binary, (character) => character.charCodeAt(0));
  try {
    return new TextDecoder("utf-8", { fatal: true }).decode(bytes);
  } catch {
    throw "QR payload is not UTF-8";
  }
}

export function encodeFrames(payload: string): string[] {
  const encoded = b64encode(payload);
  const chunks: string[] = [];
  if (encoded === "") {
    chunks.push("");
  } else {
    for (let i = 0; i < encoded.length; i += MAX_CHUNK_PAYLOAD) {
      chunks.push(encoded.slice(i, i + MAX_CHUNK_PAYLOAD));
    }
  }
  if (chunks.length > 9999) throw `QR stream has ${chunks.length} chunks; maximum is 9999`;
  const total = chunks.length;
  return chunks.map((chunk, index) => `${pad4(index)}${pad4(total)}${chunk}`);
}

// ---- import state machine (singleton, like the Rust Mutex<QrImportState>) ----
const state = { expectedTotal: null as number | null, received: new Map<number, string>() };

function reset(): void {
  state.expectedTotal = null;
  state.received.clear();
}

function parseFrame(frame: string): [number, number, string] {
  if (frame.length < HEADER) throw "QR frame is shorter than its header";
  const header = frame.slice(0, HEADER);
  if (!/^[0-9]{8}$/.test(header)) throw "QR frame header is not eight ASCII digits";
  const index = Number(header.slice(0, 4));
  const total = Number(header.slice(4, 8));
  if (total === 0) throw "QR frame declares zero chunks";
  return [index, total, frame.slice(HEADER)];
}

interface Receiving {
  status: "receiving";
  received: number;
  total: number;
  duplicate: boolean;
}
interface Complete {
  status: "complete";
  payload: string;
}

export function receiveFrame(frame: string): Receiving | Complete {
  const [index, total, payload] = parseFrame(frame);
  if (state.expectedTotal !== null && state.expectedTotal !== total) reset();
  if (state.expectedTotal === null) state.expectedTotal = total;
  if (index >= total) throw `QR chunk ${index} is outside stream length ${total}`;

  const duplicate = state.received.has(index);
  state.received.set(index, payload);
  const received = state.received.size;
  if (received !== total) return { status: "receiving", received, total, duplicate };

  let encoded = "";
  for (let i = 0; i < total; i += 1) {
    const chunk = state.received.get(i);
    if (chunk === undefined) {
      reset();
      throw `QR chunk ${i} is outside stream length ${total}`;
    }
    encoded += chunk;
  }
  reset();
  return { status: "complete", payload: b64decode(encoded) };
}

/** Re-inserts the local id slot the exporter drops at index 7. */
export function restoreMatchPacket(payload: string): unknown[] {
  let value: unknown;
  try {
    value = JSON.parse(payload);
  } catch (error) {
    throw `QR payload is not JSON: ${(error as Error).message}`;
  }
  if (!Array.isArray(value)) throw "QR match packet is not an array";
  value.splice(Math.min(value.length, 7), 0, null);
  return value;
}

/** Test-only: reset the import state machine. */
export function __resetQr(): void {
  reset();
}

export const qrCommands: Record<string, WebCommandHandler> = {
  qr_encode: (args) => encodeFrames(String(args.payload ?? "")),
  qr_reset: () => {
    reset();
    return null;
  },
  qr_receive: (args) => receiveFrame(String(args.frame ?? "")),
  qr_restore_packet: (args) => restoreMatchPacket(String(args.payload ?? "")),
};
