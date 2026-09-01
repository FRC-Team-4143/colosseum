import type { WebCommandHandler } from "./index";

/**
 * Browser port of `qr_encode` (helpers/qr.rs). Only the encode side is kept —
 * QR *import* (camera scanning) was removed. Wire format per frame is
 * `IIIITTTT<payload>`: a zero-padded 4-digit chunk index, a 4-digit total, then
 * up to 200 chars of base64 of the payload's UTF-8 bytes (200 is a multiple of
 * 4, so a chunk boundary never splits a base64 group).
 */
const MAX_CHUNK_PAYLOAD = 200;

function pad4(n: number): string {
  return String(n).padStart(4, "0");
}

function b64encode(text: string): string {
  const bytes = new TextEncoder().encode(text);
  let binary = "";
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary);
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

export const qrCommands: Record<string, WebCommandHandler> = {
  qr_encode: (args) => encodeFrames(String(args.payload ?? "")),
};
