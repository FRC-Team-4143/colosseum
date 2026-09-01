import { beforeEach, describe, expect, it } from "vitest";

import { __resetBoard, boardCommands } from "$lib/native/web/board";

// Faithfulness check against src-tauri/src/helpers/board.rs.

const state = () => boardCommands.board_state({}) as Record<string, unknown>;
const setMode = (mode: string) => boardCommands.board_set_mode({ mode });
const setColor = (color: number) => boardCommands.board_set_color({ color });
const record = (action: string) => boardCommands.board_record_action({ action });
const undo = () => boardCommands.board_undo({});
const redo = () => boardCommands.board_redo({});

beforeEach(() => __resetBoard());

describe("web board port", () => {
  it("starts in the same state as Board::default", () => {
    expect(state()).toEqual({ mode: "auto", tool: "marker", color: 0, canUndo: false, canRedo: false });
  });

  it("drives mode, tool and colour through the command surface", () => {
    for (const mode of ["teleop", "transition", "endgame", "notes", "statbotics"]) {
      expect((boardCommands.board_set_mode({ mode }) as { mode: string }).mode).toBe(mode);
    }
    expect((boardCommands.board_set_tool({ tool: "eraser" }) as { tool: string }).tool).toBe("eraser");
    expect((setColor(3) as { color: number }).color).toBe(3);
  });

  it("ignores out-of-range colours", () => {
    setColor(9);
    setColor(-1);
    expect(state().color).toBe(0);
  });

  it("scopes undo/redo availability to the active mode", () => {
    record("stroke-1");
    expect(state().canUndo).toBe(true);
    expect(state().canRedo).toBe(false);
    expect(undo()).toBe("stroke-1");
    expect(state().canUndo).toBe(false);
    expect(state().canRedo).toBe(true);

    setMode("teleop");
    expect(state().canUndo).toBe(false);
    expect(state().canRedo).toBe(false);

    setMode("auto");
    expect(state().canRedo).toBe(true);
    expect(redo()).toBe("stroke-1");
  });

  it("returns null from undo/redo when the active stack is empty", () => {
    expect(undo()).toBeNull();
    expect(redo()).toBeNull();
  });

  it("bounds history at 100 entries like the legacy whiteboard", () => {
    for (let i = 0; i <= 100; i += 1) record(String(i));
    for (let i = 0; i < 100; i += 1) expect(undo()).not.toBeNull();
    expect(undo()).toBeNull();
  });

  it("recording a new action clears the redo stack for that mode", () => {
    record("a");
    undo();
    expect(state().canRedo).toBe(true);
    record("b");
    expect(state().canRedo).toBe(false);
  });
});
