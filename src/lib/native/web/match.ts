import { robotPositionsForYear } from "./field";

/**
 * Browser port of `helpers/match_model.rs` — the positional packet codec shared
 * with the desktop build and with QR / PDF exports. The packet layout is:
 *
 *   [ name, r1, r2, r3, b1, b2, b3, id,
 *     [ dims,                       // [[w,h] x6], from the auto phase
 *       autoPhase, teleopPhase, endgamePhase, notesPhase, transitionPhase ],
 *     tbaEventKey|null, tbaMatchKey|null, tbaYear|null, fieldMetadata|null ]
 *
 *   phase = [ pose x6, drawing, drawingBbox, checkboxes ]   pose = [x, y, r]
 *
 * Fidelity notes:
 *   - `jsToFixed` reimplements the Rust reimplementation of JS `Number.toFixed`
 *     (round-half-away-from-zero, but read off the *true* f64 decimal expansion),
 *     so w/h/r round exactly as they do on the desktop. Native `toFixed` matches
 *     for every case in the Rust test suite except exact negative binary halves
 *     like -0.125 -> the port keeps the Rust result (-0.12).
 *   - Error message strings match Rust's `PacketError` verbatim.
 */

const DEFAULT_ROBOT_WIDTH = 152.4;
const DEFAULT_ROBOT_HEIGHT = 152.4;

export interface RobotBox {
  x: number;
  y: number;
  w: number;
  h: number;
  r: number;
}
export interface Phase {
  redOneRobot: RobotBox;
  redTwoRobot: RobotBox;
  redThreeRobot: RobotBox;
  blueOneRobot: RobotBox;
  blueTwoRobot: RobotBox;
  blueThreeRobot: RobotBox;
  drawing: unknown;
  drawingBbox: unknown;
  checkboxes: unknown;
}
export interface MatchModel {
  matchName: string;
  redOne: string;
  redTwo: string;
  redThree: string;
  blueOne: string;
  blueTwo: string;
  blueThree: string;
  id: string;
  tbaEventKey: string | null;
  tbaMatchKey: string | null;
  tbaYear: number | null;
  fieldMetadata: unknown;
  auto: Phase;
  teleop: Phase;
  transition: Phase;
  endgame: Phase;
  notes: Phase;
}

/**
 * A random id for a new match. `crypto.randomUUID()` is only defined in a secure
 * context, so it's absent on an iPad hitting `http://<lan-ip>` — fall back to a
 * v4 UUID from `crypto.getRandomValues` (which works everywhere), then to
 * `Math.random` as a last resort. Ids only need to be unique strings.
 */
function randomId(): string {
  const c = globalThis.crypto as Crypto | undefined;
  if (c?.randomUUID) return c.randomUUID();
  const bytes = new Uint8Array(16);
  if (c?.getRandomValues) c.getRandomValues(bytes);
  else for (let i = 0; i < 16; i += 1) bytes[i] = Math.floor(Math.random() * 256);
  bytes[6] = (bytes[6] & 0x0f) | 0x40;
  bytes[8] = (bytes[8] & 0x3f) | 0x80;
  const hex = [...bytes].map((b) => b.toString(16).padStart(2, "0")).join("");
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`;
}

const ROBOT_KEYS = [
  "redOneRobot",
  "redTwoRobot",
  "redThreeRobot",
  "blueOneRobot",
  "blueTwoRobot",
  "blueThreeRobot",
] as const;

// ---------------------------------------------------------------------------
// jsToFixed — faithful port of `match_model::js_to_fixed`.
// ---------------------------------------------------------------------------
export function jsToFixed(x: number, digits: number): number {
  if (!Number.isFinite(x) || x === 0 || Math.abs(x) >= 1e15) return x;
  const negative = x < 0;
  const s = Math.abs(x).toFixed(60);
  const dot = s.indexOf(".");
  const intPart = s.slice(0, dot);
  const fracPart = s.slice(dot + 1);
  const nextDigit = digits < fracPart.length ? fracPart.charCodeAt(digits) - 48 : 0;
  const rest = fracPart.length > digits + 1 && /[1-9]/.test(fracPart.slice(digits + 1));
  let mantissa = BigInt(intPart + fracPart.slice(0, Math.min(digits, fracPart.length)));
  if (nextDigit > 5 || (nextDigit === 5 && (rest || !negative))) mantissa += 1n;
  const output = Number(mantissa) / 10 ** digits;
  return negative ? -output : output;
}

// ---------------------------------------------------------------------------
// packet parse helpers — mirror the `fn number/string/array/...` in Rust.
// ---------------------------------------------------------------------------
function fail(context: string, kind: string): never {
  throw `invalid match packet: ${context} is not ${kind}`;
}
function asArray(value: unknown, context: string): unknown[] {
  if (!Array.isArray(value)) fail(context, "an array");
  return value;
}
function asNumber(value: unknown, context: string): number {
  if (typeof value !== "number") fail(context, "a number");
  return value;
}
function asString(value: unknown, context: string): string {
  if (typeof value !== "string") fail(context, "a string");
  return value;
}
function optionalString(value: unknown, context: string): string | null {
  return value === null || value === undefined ? null : asString(value, context);
}
function optionalNumber(value: unknown, context: string): number | null {
  return value === null || value === undefined ? null : asNumber(value, context);
}
function at(values: unknown[], index: number): unknown {
  return values[index] ?? null;
}
function truthy(value: unknown): boolean {
  if (value === null || value === undefined) return false;
  if (typeof value === "boolean") return value;
  if (typeof value === "number") return value !== 0 && !Number.isNaN(value);
  if (typeof value === "string") return value.length > 0;
  return true;
}
/**
 * Deep-clone a JSON value. Uses a JSON round trip rather than `structuredClone`
 * so it reads transparently through Svelte 5 `$state` proxies (which
 * `structuredClone` rejects) — and it's the same shape the desktop's Tauri IPC
 * puts these values through. drawing / bbox / checkboxes / fieldMetadata are
 * always plain JSON, so nothing is lost.
 */
function clone<T>(value: T): T {
  return value === null || typeof value !== "object" ? value : (JSON.parse(JSON.stringify(value)) as T);
}

interface Pose {
  x: number;
  y: number;
  r: number;
}
interface Dim {
  w: number;
  h: number;
}
interface PhaseOptions {
  poses: [Pose, Pose, Pose, Pose, Pose, Pose];
  drawing: unknown;
  drawingBbox: unknown;
  checkboxes: unknown | null;
}

function parsePose(value: unknown, context: string): Pose {
  const a = asArray(value, context);
  return {
    x: asNumber(at(a, 0), "robot"),
    y: asNumber(at(a, 1), "robot"),
    r: asNumber(at(a, 2), "robot"),
  };
}
function parseDim(value: unknown): Dim {
  const a = asArray(value, "dimensions");
  return { w: asNumber(at(a, 0), "dimension width"), h: asNumber(at(a, 1), "dimension height") };
}
function parsePhaseOptions(value: unknown, context: string): PhaseOptions {
  const a = asArray(value, context);
  return {
    poses: [0, 1, 2, 3, 4, 5].map((i) => parsePose(at(a, i), context)) as PhaseOptions["poses"],
    drawing: at(a, 6),
    drawingBbox: at(a, 7),
    checkboxes: at(a, 8) === null ? null : at(a, 8),
  };
}

// ---------------------------------------------------------------------------
// construction — mirror `Match::new` + `default_phase` + `apply_phase`.
// ---------------------------------------------------------------------------
function defaultPhase(positions: ReturnType<typeof robotPositionsForYear>): Phase {
  const box = (p: { x: number; y: number }): RobotBox => ({
    x: p.x,
    y: p.y,
    w: DEFAULT_ROBOT_WIDTH,
    h: DEFAULT_ROBOT_HEIGHT,
    r: 0,
  });
  return {
    redOneRobot: box(positions.red.one),
    redTwoRobot: box(positions.red.two),
    redThreeRobot: box(positions.red.three),
    blueOneRobot: box(positions.blue.one),
    blueTwoRobot: box(positions.blue.two),
    blueThreeRobot: box(positions.blue.three),
    drawing: [],
    drawingBbox: [],
    checkboxes: [],
  };
}
function applyPhase(target: Phase, source: PhaseOptions, dims: [Dim, Dim, Dim, Dim, Dim, Dim]): void {
  ROBOT_KEYS.forEach((key, i) => {
    target[key] = {
      x: source.poses[i].x,
      y: source.poses[i].y,
      r: source.poses[i].r,
      w: dims[i].w,
      h: dims[i].h,
    };
  });
  target.drawing = clone(source.drawing);
  target.drawingBbox = clone(source.drawingBbox);
  target.checkboxes = source.checkboxes === null ? [] : clone(source.checkboxes);
}

interface MatchOptions {
  dims: [Dim, Dim, Dim, Dim, Dim, Dim];
  auto: PhaseOptions;
  teleop: PhaseOptions;
  endgame: PhaseOptions;
  notes: PhaseOptions | null;
  transition: PhaseOptions | null;
}

export function createMatch(
  matchName: string,
  red: [string, string, string],
  blue: [string, string, string],
  id: string | null,
  options: MatchOptions | null,
  tbaEventKey: string | null,
  tbaMatchKey: string | null,
  tbaYear: number | null,
): MatchModel {
  const positions = robotPositionsForYear(tbaYear ?? undefined);
  const model: MatchModel = {
    matchName,
    redOne: red[0],
    redTwo: red[1],
    redThree: red[2],
    blueOne: blue[0],
    blueTwo: blue[1],
    blueThree: blue[2],
    id: id ?? randomId(),
    tbaEventKey,
    tbaMatchKey,
    tbaYear,
    fieldMetadata: null,
    auto: defaultPhase(positions),
    teleop: defaultPhase(positions),
    transition: defaultPhase(positions),
    endgame: defaultPhase(positions),
    notes: defaultPhase(positions),
  };
  if (options) {
    applyPhase(model.auto, options.auto, options.dims);
    applyPhase(model.teleop, options.teleop, options.dims);
    applyPhase(model.endgame, options.endgame, options.dims);
    if (options.notes) applyPhase(model.notes, options.notes, options.dims);
    if (options.transition) applyPhase(model.transition, options.transition, options.dims);
  }
  return model;
}

// ---------------------------------------------------------------------------
// matchFromPacket / matchToPacket — mirror `from_packet` / `get_as_packet`.
// ---------------------------------------------------------------------------
export function matchFromPacket(packet: unknown): MatchModel {
  const p = asArray(packet, "packet");
  const body = asArray(at(p, 8), "packet[8]");
  const dimsRaw = asArray(at(body, 0), "dimensions");
  const dims = [0, 1, 2, 3, 4, 5].map((i) => parseDim(at(dimsRaw, i))) as MatchOptions["dims"];

  const options: MatchOptions = {
    dims,
    auto: parsePhaseOptions(at(body, 1), "auto"),
    teleop: parsePhaseOptions(at(body, 2), "teleop"),
    endgame: parsePhaseOptions(at(body, 3), "endgame"),
    notes: truthy(at(body, 4)) ? parsePhaseOptions(at(body, 4), "notes") : null,
    transition: truthy(at(body, 5)) ? parsePhaseOptions(at(body, 5), "transition") : null,
  };

  const model = createMatch(
    asString(at(p, 0), "matchName"),
    [
      asString(at(p, 1), "redOne"),
      asString(at(p, 2), "redTwo"),
      asString(at(p, 3), "redThree"),
    ],
    [
      asString(at(p, 4), "blueOne"),
      asString(at(p, 5), "blueTwo"),
      asString(at(p, 6), "blueThree"),
    ],
    optionalString(at(p, 7), "id"),
    options,
    optionalString(at(p, 9), "tbaEventKey"),
    optionalString(at(p, 10), "tbaMatchKey"),
    optionalNumber(at(p, 11), "tbaYear"),
  );
  model.fieldMetadata = at(p, 12) === null ? null : clone(at(p, 12));
  return model;
}

function phasePacket(phase: Phase): unknown[] {
  const pose = (r: RobotBox) => [r.x, r.y, jsToFixed(r.r, 2)];
  return [
    ...ROBOT_KEYS.map((key) => pose(phase[key])),
    clone(phase.drawing),
    clone(phase.drawingBbox),
    clone(phase.checkboxes),
  ];
}

export function matchToPacket(model: MatchModel): unknown[] {
  const dims = ROBOT_KEYS.map((key) => [
    jsToFixed(model.auto[key].w, 1),
    jsToFixed(model.auto[key].h, 1),
  ]);
  return [
    model.matchName,
    model.redOne,
    model.redTwo,
    model.redThree,
    model.blueOne,
    model.blueTwo,
    model.blueThree,
    model.id,
    [
      dims,
      phasePacket(model.auto),
      phasePacket(model.teleop),
      phasePacket(model.endgame),
      phasePacket(model.notes),
      phasePacket(model.transition),
    ],
    model.tbaEventKey,
    model.tbaMatchKey,
    model.tbaYear,
    model.fieldMetadata === null || model.fieldMetadata === undefined
      ? null
      : clone(model.fieldMetadata),
  ];
}
