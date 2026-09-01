import type { InvokeArgs } from "@tauri-apps/api/core";

import { boardCommands } from "./board";
import { configCommands } from "./config";
import { fieldCommands } from "./field";
import { modelCommands } from "./model";
import { pdfCommands } from "./pdf";
import { platformCommands } from "./platform";
import { qrCommands } from "./qr";
import { searchCommands } from "./search";
import { storageCommands } from "./storage";

/**
 * Browser implementations of the native (Tauri) command surface, used by the
 * static web build where there is no Rust backend.
 *
 * This module is only imported when `isTauri()` is false (see `../api.ts`), so
 * it is code-split out of the desktop bundle entirely. Ported so far:
 *   - Phase 1: config, field, platform, storage, board
 *   - Phase 2: model_*, match_* (packet codec), qr_*, pdf_*, fuzzy_*
 * Still pending (throw until ported):
 *   - Phase 3: tba, statbotics, github
 */
export type WebCommandHandler = (args: Record<string, unknown>) => unknown | Promise<unknown>;

/** command name -> browser implementation. */
export const webCommands: Record<string, WebCommandHandler> = {
  ...configCommands,
  ...fieldCommands,
  ...platformCommands,
  ...storageCommands,
  ...boardCommands,
  ...modelCommands,
  ...qrCommands,
  ...pdfCommands,
  ...searchCommands,
};

function toArgRecord(args: InvokeArgs | undefined): Record<string, unknown> {
  return args && typeof args === "object" && !Array.isArray(args)
    && !(args instanceof ArrayBuffer) && !ArrayBuffer.isView(args)
    ? (args as Record<string, unknown>)
    : {};
}

export async function webInvoke<TResult>(command: string, args?: InvokeArgs): Promise<TResult> {
  const handler = webCommands[command];
  if (!handler) {
    // Thrown as a string to match Tauri's `invoke` rejection shape, which the
    // `NativeCommandError` wrapper in ../api.ts surfaces verbatim as the message.
    throw `"${command}" is not available in the Colosseum web build yet (no native backend).`;
  }
  return (await handler(toArgRecord(args))) as TResult;
}
