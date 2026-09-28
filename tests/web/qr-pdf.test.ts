import { describe, expect, it } from "vitest";

import { encodeFrames } from "$lib/native/web/qr";
import { largePlan, standardPlan } from "$lib/native/web/pdf";

// Ported from src-tauri/src/helpers/qr.rs and pdf.rs test suites.
// (QR *import* was removed — only the encode side remains.)

const rejection = (fn: () => unknown): string | undefined => {
  try {
    fn();
    return undefined;
  } catch (error) {
    return error as string;
  }
};

describe("web qr encode port", () => {
  it("treats an empty payload as one headered frame", () => {
    expect(encodeFrames("")).toEqual(["00000001"]);
  });

  it("round trips a unicode payload into one frame with a legacy header", () => {
    const frames = encodeFrames('{"team":"Méga 🤖","score":42}');
    expect(frames).toHaveLength(1);
    expect(frames[0].slice(0, 8)).toBe("00000001");
  });

  it("splits a long payload into 200-char base64 chunks with IIIITTTT headers", () => {
    const frames = encodeFrames("x".repeat(400));
    expect(frames).toHaveLength(3);
    expect(frames[0].slice(0, 8)).toBe("00000003");
    expect(frames.every((f) => f.length <= 8 + 200)).toBe(true);
  });

  it("rejects a stream that would need more than 9999 chunks", () => {
    expect(rejection(() => encodeFrames("x".repeat(200 * 3 * 10000)))).toMatch(/maximum is 9999/);
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
