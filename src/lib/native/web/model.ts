import type { WebCommandHandler } from "./index";
import { createMatch, matchFromPacket, matchToPacket } from "./match";

/**
 * The `match_*` commands: pure packet construction and codec round-trips (the positional
 * `MatchPacket` <-> `Match` model, including the `jsToFixed` number canonicalisation that
 * keeps QR / PDF exports byte-stable). Persistence of boards moved to the backend — see
 * `src/lib/api/whiteboards.ts` and `src/lib/stores/app.svelte.ts`.
 */
export const matchCommands: Record<string, WebCommandHandler> = {
  match_create_packet: (args) => {
    const red = Array.isArray(args.redTeams) ? args.redTeams : [];
    const blue = Array.isArray(args.blueTeams) ? args.blueTeams : [];
    if (red.length !== 3 || blue.length !== 3) {
      throw "a match requires exactly three red and three blue teams";
    }
    const model = createMatch(
      String(args.matchName ?? ""),
      red.map(String) as [string, string, string],
      blue.map(String) as [string, string, string],
      null,
      null,
      (args.tbaEventKey as string | undefined) ?? null,
      (args.tbaMatchKey as string | undefined) ?? null,
      (args.tbaYear as number | undefined) ?? null,
    );
    return matchToPacket(model);
  },
  match_normalize_packet: (args) => matchToPacket(matchFromPacket(args.packet)),
};
