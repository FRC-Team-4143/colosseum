import { beforeEach, describe, expect, it } from "vitest";

import { __resetQr, encodeFrames, receiveFrame, restoreMatchPacket } from "$lib/native/web/qr";
import { largePlan, standardPlan } from "$lib/native/web/pdf";

// Ported from src-tauri/src/helpers/qr.rs and pdf.rs test suites.

const rejection = (fn: () => unknown): string | undefined => {
  try {
    fn();
    return undefined;
  } catch (error) {
    return error as string;
  }
};

describe("web qr framing port", () => {
  beforeEach(() => __resetQr());

  it("round trips a unicode payload in one frame with legacy headers", () => {
    const payload = '{"team":"Méga 🤖","score":42}';
    const frames = encodeFrames(payload);
    expect(frames[0].slice(0, 8)).toBe("00000001");
    expect(receiveFrame(frames[0])).toEqual({ status: "complete", payload });
  });

  it("reassembles a multi-frame stream out of order and flags duplicates", () => {
    const frames = encodeFrames("x".repeat(400));
    expect(frames).toHaveLength(3);
    expect(receiveFrame(frames[1])).toEqual({ status: "receiving", received: 1, total: 3, duplicate: false });
    expect(receiveFrame(frames[1])).toEqual({ status: "receiving", received: 1, total: 3, duplicate: true });
    expect(receiveFrame(frames[2])).toEqual({ status: "receiving", received: 2, total: 3, duplicate: false });
    expect(receiveFrame(frames[0])).toEqual({ status: "complete", payload: "x".repeat(400) });
  });

  it("resets progress when a frame declares a different stream length", () => {
    const first = encodeFrames("x".repeat(400));
    const second = encodeFrames("new stream");
    receiveFrame(first[0]);
    expect(receiveFrame(second[0])).toEqual({ status: "complete", payload: "new stream" });
  });

  it("rejects malformed headers, out-of-range chunks and corrupt payloads", () => {
    expect(rejection(() => receiveFrame("short"))).toBe("QR frame is shorter than its header");
    expect(rejection(() => receiveFrame("abcd0001payload"))).toBe("QR frame header is not eight ASCII digits");
    expect(rejection(() => receiveFrame("00000000"))).toBe("QR frame declares zero chunks");
    expect(rejection(() => receiveFrame("00010001payload"))).toBe("QR chunk 1 is outside stream length 1");
    expect(rejection(() => receiveFrame("00000001%%%%"))).toBe("QR payload is not valid base64");
    expect(rejection(() => receiveFrame("00000001/w=="))).toBe("QR payload is not UTF-8");
  });

  it("treats an empty payload as one valid frame", () => {
    expect(encodeFrames("")).toEqual(["00000001"]);
    expect(receiveFrame("00000001")).toEqual({ status: "complete", payload: "" });
  });

  it("restores the dropped local-id slot", () => {
    const packet = restoreMatchPacket("[0,1,2,3,4,5,6,8]");
    expect(packet[7]).toBeNull();
    expect(packet[8]).toBe(8);
    expect(rejection(() => restoreMatchPacket("{}"))).toBe("QR match packet is not an array");
    expect(rejection(() => restoreMatchPacket("not json"))).toMatch(/^QR payload is not JSON/);
  });
});

describe("web pdf layout port", () => {
  it("standard: A4 capacity, header sizing, empty intro page", () => {
    const plan = standardPlan(["one", "two", "three"], "Match 1");
    expect([plan.widthMm, plan.heightMm]).toEqual([210, 297]);
    expect(plan.pages).toHaveLength(2);
    expect(plan.pages[0].texts[0].value).toBe("Match 1");
    expect(plan.pages[0].texts[0].fontSizePt).toBe(20);
    expect(plan.pages[0].texts[1].value).toBe("Scan each QR code in order (3 total)");
    expect(plan.pages[1].texts).toHaveLength(1);
    expect(plan.pages[1].texts[0].fontSizePt).toBe(16);

    const empty = standardPlan([], "Empty match");
    expect(empty.pages).toHaveLength(1);
    expect(empty.pages[0].qrCodes).toHaveLength(0);
    expect(empty.pages[0].texts[1].value).toBe("Scan each QR code in order (0 total)");
  });

  it("standard: places and labels QR codes in reading order", () => {
    const codes = standardPlan(["a", "b"], "M").pages[0].qrCodes;
    expect(codes).toHaveLength(2);
    expect([codes[0].xMm, codes[0].yMm, codes[0].sizeMm]).toEqual([20, 40, 80]);
    expect([codes[1].xMm, codes[1].yMm]).toEqual([20, 135]);
    expect(codes[0].label?.value).toBe("1 of 2");
    expect(codes[1].label?.value).toBe("2 of 2");
  });

  it("large: one centered code per page; empty has none", () => {
    const plan = largePlan(["a", "b"], "Finals");
    expect(plan.pages).toHaveLength(2);
    plan.pages.forEach((page, index) => {
      expect(page.qrCodes).toHaveLength(1);
      expect([page.qrCodes[0].xMm, page.qrCodes[0].yMm, page.qrCodes[0].sizeMm]).toEqual([30, 73.5, 150]);
      expect(page.qrCodes[0].label).toBeNull();
      expect(page.texts[1].value).toBe(`QR Code ${index + 1} of 2`);
      expect(page.texts[2].value).toBe("Scan this code, then move to the next page");
    });
    expect(largePlan([], "Empty").pages).toHaveLength(0);
  });
});
