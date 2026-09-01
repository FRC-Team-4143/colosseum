import { boardCommands } from "./board";
import { configCommands } from "./config";
import { fieldCommands } from "./field";
import { matchCommands } from "./model";
import { pdfCommands } from "./pdf";
import { platformCommands } from "./platform";
import { qrCommands } from "./qr";
import { searchCommands } from "./search";
import { storageCommands } from "./storage";
import { tbaCommands } from "./tba";

/**
 * Browser implementations of the command surface behind `native.*` (see
 * `../api.ts`): config, field, platform, storage, board, match_*, qr_*, pdf_*,
 * fuzzy_*, and tba_*. (Board persistence — the old model_* — moved to the
 * FastAPI backend; see `src/lib/api/whiteboards.ts`.)
 */
export type InvokeArgs = Record<string, unknown> | undefined;
export type WebCommandHandler = (args: Record<string, unknown>) => unknown | Promise<unknown>;

/** command name -> browser implementation. */
export const webCommands: Record<string, WebCommandHandler> = {
  ...configCommands,
  ...fieldCommands,
  ...platformCommands,
  ...storageCommands,
  ...boardCommands,
  ...matchCommands,
  ...qrCommands,
  ...pdfCommands,
  ...searchCommands,
  ...tbaCommands,
};

function toArgRecord(args: InvokeArgs): Record<string, unknown> {
  return args && typeof args === "object" && !Array.isArray(args) ? args : {};
}

export async function webInvoke<TResult>(command: string, args?: InvokeArgs): Promise<TResult> {
  const handler = webCommands[command];
  if (!handler) {
    // Thrown as a string so the `NativeCommandError` wrapper in ../api.ts
    // surfaces it verbatim as the message.
    throw `"${command}" is not implemented.`;
  }
  return (await handler(toArgRecord(args))) as TResult;
}
