import type { WebCommandHandler } from "./index";

/**
 * Browser port of `helpers/board.rs` — the whiteboard's UI control state
 * (mode / tool / colour) plus a per-mode undo/redo stack of opaque action ids.
 * A module-level singleton stands in for the Rust `Mutex<Board>` held in
 * `RuntimeState`, so state persists across calls for the life of the page.
 *
 * The Rust `Board` also has a listener/notify mechanism; the command layer
 * never uses it (each handler just mutates then returns `state()`), so it is
 * intentionally omitted here.
 */
type BoardMode = "auto" | "teleop" | "transition" | "endgame" | "notes" | "statbotics";
type BoardTool = "marker" | "eraser";

interface BoardState {
  mode: BoardMode;
  tool: BoardTool;
  color: number;
  canUndo: boolean;
  canRedo: boolean;
}

const MAX_HISTORY_SIZE = 100;

const state = {
  mode: "auto" as BoardMode,
  tool: "marker" as BoardTool,
  color: 0,
  undo: new Map<BoardMode, string[]>(),
  redo: new Map<BoardMode, string[]>(),
};

function stack(map: Map<BoardMode, string[]>, mode: BoardMode): string[] {
  let entry = map.get(mode);
  if (!entry) {
    entry = [];
    map.set(mode, entry);
  }
  return entry;
}

function snapshot(): BoardState {
  return {
    mode: state.mode,
    tool: state.tool,
    color: state.color,
    canUndo: (state.undo.get(state.mode)?.length ?? 0) > 0,
    canRedo: (state.redo.get(state.mode)?.length ?? 0) > 0,
  };
}

function setMode(mode: BoardMode): void {
  state.mode = mode;
}

function setTool(tool: BoardTool): void {
  state.tool = tool;
}

function setColor(color: number): void {
  // Matches `Board::set_color`: ignore anything outside 0..=4 (and no-ops are
  // harmless). `board.svelte.ts` only ever sends an index it computed itself.
  if (Number.isInteger(color) && color >= 0 && color <= 4) {
    state.color = color;
  }
}

function recordAction(action: string): void {
  state.redo.delete(state.mode);
  const history = stack(state.undo, state.mode);
  history.push(action);
  if (history.length > MAX_HISTORY_SIZE) history.shift();
}

function undo(): string | null {
  const action = stack(state.undo, state.mode).pop();
  if (action === undefined) return null;
  stack(state.redo, state.mode).push(action);
  return action;
}

function redo(): string | null {
  const action = stack(state.redo, state.mode).pop();
  if (action === undefined) return null;
  stack(state.undo, state.mode).push(action);
  return action;
}

/** Test-only: reset the singleton between cases. */
export function __resetBoard(): void {
  state.mode = "auto";
  state.tool = "marker";
  state.color = 0;
  state.undo.clear();
  state.redo.clear();
}

export const boardCommands: Record<string, WebCommandHandler> = {
  board_state: () => snapshot(),
  board_set_mode: (args) => {
    setMode(args.mode as BoardMode);
    return snapshot();
  },
  board_set_tool: (args) => {
    setTool(args.tool as BoardTool);
    return snapshot();
  },
  board_set_color: (args) => {
    setColor(Number(args.color));
    return snapshot();
  },
  board_record_action: (args) => {
    recordAction(String(args.action));
    return snapshot();
  },
  board_undo: () => undo(),
  board_redo: () => redo(),
};
