import { native } from "$lib/native/api";
import type { MatchPacket } from "$lib/native/types";

const DEFAULT_FRAME_DURATION_MS = 600;
const DEFAULT_QR_SIZE = 480;

type QrCodeModule = typeof import("qrcode");

let qrCodeModule: Promise<QrCodeModule> | null = null;

function loadQrCode(): Promise<QrCodeModule> {
  qrCodeModule ??= import("qrcode");
  return qrCodeModule;
}

export interface QrAnimationStatus {
  frameIndex: number;
  total: number;
  progress: number;
}

/**
 * QR canvas rendering is lazily loaded and memoized by frame and pixel size.
 * This keeps the QR library out of startup and avoids regenerating a matrix on
 * every animation tick.
 */
export class QrFrameRenderer {
  #cache = new Map<string, Promise<HTMLCanvasElement>>();

  async render(frame: string, size = DEFAULT_QR_SIZE): Promise<HTMLCanvasElement> {
    const pixelSize = Math.max(160, Math.round(size));
    const key = `${pixelSize}\u0000${frame}`;
    let render = this.#cache.get(key);
    if (!render) {
      render = (async () => {
        const canvas = document.createElement("canvas");
        const QRCode = await loadQrCode();
        await QRCode.toCanvas(canvas, frame, {
          errorCorrectionLevel: "M",
          margin: 1,
          width: pixelSize,
        });
        canvas.setAttribute("role", "img");
        return canvas;
      })();
      this.#cache.set(key, render);
      void render.catch(() => {
        // Do not pin a transient canvas/WebGL failure for the life of a modal.
        if (this.#cache.get(key) === render) this.#cache.delete(key);
      });
    }
    const source = await render;
    // cloneNode does not retain a canvas bitmap. Copy pixels into a new canvas
    // so independently mounted slots never erase or resize the cached source.
    const canvas = document.createElement("canvas");
    canvas.width = source.width;
    canvas.height = source.height;
    const context = canvas.getContext("2d");
    if (!context) throw new Error("Canvas rendering is unavailable");
    context.drawImage(source, 0, 0);
    for (const attribute of source.getAttributeNames()) {
      const value = source.getAttribute(attribute);
      if (value !== null) canvas.setAttribute(attribute, value);
    }
    return canvas;
  }

  clear(): void {
    this.#cache.clear();
  }
}

/**
 * Owns exactly one interval and never queues rendering work inside it. The
 * first three frames are pre-rendered and the following canvas is prepared
 * before it becomes visible, eliminating the old flicker/race pattern.
 */
export class QrFramePlayer {
  readonly frames: readonly string[];
  readonly renderer: QrFrameRenderer;
  #timer: number | null = null;
  #slots: HTMLElement[] = [];
  #frameIndex = 0;
  #size = DEFAULT_QR_SIZE;
  #onStatus?: (status: QrAnimationStatus) => void;
  #advancing = false;

  constructor(frames: readonly string[], renderer = new QrFrameRenderer()) {
    if (frames.length === 0) throw new Error("Cannot animate an empty QR stream");
    this.frames = frames;
    this.renderer = renderer;
  }

  static async fromPayload(payload: string): Promise<QrFramePlayer> {
    return new QrFramePlayer(await native.qr.encode(payload));
  }

  /** Preserves the established portable wire format (the local ID is omitted). */
  static async fromPacket(packet: MatchPacket): Promise<QrFramePlayer> {
    const portablePacket = [...packet];
    portablePacket.splice(7, 1);
    return this.fromPayload(JSON.stringify(portablePacket));
  }

  async attach(slots: HTMLElement[], size = DEFAULT_QR_SIZE): Promise<void> {
    if (slots.length === 0) throw new Error("QR animation requires at least one display slot");
    this.stop();
    this.#slots = slots;
    this.#size = size;
    this.#frameIndex = 0;
    await Promise.all(slots.map((slot, index) => this.#paint(slot, index % this.frames.length)));
    this.#showSlot(0);
    this.#emitStatus();
  }

  start(onStatus?: (status: QrAnimationStatus) => void, durationMs = DEFAULT_FRAME_DURATION_MS): void {
    if (this.#slots.length === 0) throw new Error("Attach QR display slots before starting");
    this.stop();
    this.#onStatus = onStatus;
    this.#emitStatus();
    if (this.frames.length === 1) return;
    this.#timer = window.setInterval(() => { void this.#advance(); }, Math.max(250, durationMs));
  }

  stop(): void {
    if (this.#timer !== null) window.clearInterval(this.#timer);
    this.#timer = null;
  }

  dispose(): void {
    this.stop();
    this.#slots = [];
    this.renderer.clear();
  }

  async #advance(): Promise<void> {
    if (this.#slots.length === 0 || this.#advancing) return;
    this.#advancing = true;
    try {
      const nextFrame = (this.#frameIndex + 1) % this.frames.length;
      const nextSlot = nextFrame % this.#slots.length;
      await this.#paint(this.#slots[nextSlot], nextFrame);
      this.#frameIndex = nextFrame;
      this.#showSlot(nextSlot);
      this.#emitStatus();
    } finally {
      this.#advancing = false;
    }
  }

  async #paint(slot: HTMLElement, frameIndex: number): Promise<void> {
    const canvas = await this.renderer.render(this.frames[frameIndex], this.#size);
    canvas.setAttribute("aria-label", `QR export page ${frameIndex + 1} of ${this.frames.length}`);
    slot.replaceChildren(canvas);
  }

  #showSlot(activeIndex: number): void {
    this.#slots.forEach((slot, index) => {
      slot.hidden = index !== activeIndex;
      slot.setAttribute("aria-hidden", index === activeIndex ? "false" : "true");
    });
  }

  #emitStatus(): void {
    this.#onStatus?.({
      frameIndex: this.#frameIndex,
      total: this.frames.length,
      progress: Math.round(((this.#frameIndex + 1) / this.frames.length) * 100),
    });
  }
}
