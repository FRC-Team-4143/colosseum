import type { InvokeArgs } from "@tauri-apps/api/core";

/**
 * Browser implementations of the native (Tauri) command surface, used by the
 * static web build where there is no Rust backend.
 *
 * This module is only imported when `isTauri()` is false (see `../api.ts`), so
 * it is code-split out of the desktop bundle entirely. It is filled in over
 * phases:
 *   - Phase 1: config, field, platform, storage, board
 *   - Phase 2: qr, pdf, fuzzy search
 *   - Phase 3: tba, statbotics, github
 * Until a command is ported here it throws, rather than resolving to undefined.
 */
export type WebCommandHandler = (args: Record<string, unknown>) => unknown | Promise<unknown>;

/** command name -> browser implementation. Populated by the phase modules. */
export const webCommands: Record<string, WebCommandHandler> = {};

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
