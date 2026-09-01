import type { WebCommandHandler } from "./index";

/**
 * Browser port of `helpers/pdf.rs` — the deterministic PDF layout plan (in mm)
 * that `src/lib/features/pdf.ts` renders with pdf-lib. No PDF is produced here.
 * Values are exact (integers / halves), so f32-vs-f64 never bites.
 */
const A4_W = 210;
const A4_H = 297;
const STD_MARGIN = 20;
const STD_QR = 80;
const STD_SPACING = 15;
const LARGE_QR = 150;

interface PdfText {
  value: string;
  xMm: number;
  yMm: number;
  fontSizePt: number;
  bold: boolean;
}
interface QrPlacement {
  payload: string;
  ordinal: number;
  total: number;
  xMm: number;
  yMm: number;
  sizeMm: number;
  label: PdfText | null;
}
interface PdfPagePlan {
  pageIndex: number;
  texts: PdfText[];
  qrCodes: QrPlacement[];
}
interface PdfDocumentPlan {
  widthMm: number;
  heightMm: number;
  pages: PdfPagePlan[];
}

const centeredAt = (
  value: string,
  xMm: number,
  yMm: number,
  fontSizePt: number,
  bold: boolean,
): PdfText => ({ value, xMm, yMm, fontSizePt, bold });
const centered = (value: string, yMm: number, fontSizePt: number, bold: boolean): PdfText =>
  centeredAt(value, A4_W / 2, yMm, fontSizePt, bold);

export function standardPlan(data: string[], matchName: string): PdfDocumentPlan {
  const codesPerRow = Math.floor((A4_W - 2 * STD_MARGIN) / (STD_QR + STD_SPACING));
  const codesPerColumn = Math.floor((A4_H - 2 * STD_MARGIN - 30) / (STD_QR + STD_SPACING));
  const codesPerPage = codesPerRow * codesPerColumn;
  const pageCount = Math.ceil(Math.max(data.length, 1) / codesPerPage);

  const pages: PdfPagePlan[] = [];
  for (let pageIndex = 0; pageIndex < pageCount; pageIndex += 1) {
    const texts: PdfText[] = [centered(matchName, STD_MARGIN, pageIndex === 0 ? 20 : 16, true)];
    if (pageIndex === 0) {
      texts.push(
        centered(`Scan each QR code in order (${data.length} total)`, STD_MARGIN + 10, 12, false),
      );
    }
    const qrCodes: QrPlacement[] = [];
    const start = pageIndex * codesPerPage;
    const end = Math.min(start + codesPerPage, data.length);
    for (let ordinal = start; ordinal < end; ordinal += 1) {
      const positionOnPage = ordinal - start;
      const row = Math.floor(positionOnPage / codesPerRow);
      const column = positionOnPage % codesPerRow;
      const xMm = STD_MARGIN + column * (STD_QR + STD_SPACING);
      const yMm = STD_MARGIN + 20 + row * (STD_QR + STD_SPACING);
      qrCodes.push({
        payload: data[ordinal],
        ordinal: ordinal + 1,
        total: data.length,
        xMm,
        yMm,
        sizeMm: STD_QR,
        label: centeredAt(
          `${ordinal + 1} of ${data.length}`,
          xMm + STD_QR / 2,
          yMm + STD_QR + 5,
          10,
          false,
        ),
      });
    }
    pages.push({ pageIndex, texts, qrCodes });
  }
  return { widthMm: A4_W, heightMm: A4_H, pages };
}

export function largePlan(data: string[], matchName: string): PdfDocumentPlan {
  const xMm = (A4_W - LARGE_QR) / 2;
  const yMm = (A4_H - LARGE_QR) / 2;
  const pages = data.map((payload, pageIndex): PdfPagePlan => {
    const ordinal = pageIndex + 1;
    return {
      pageIndex,
      texts: [
        centered(matchName, 30, 24, true),
        centered(`QR Code ${ordinal} of ${data.length}`, 45, 16, false),
        centered("Scan this code, then move to the next page", A4_H - 30, 14, false),
      ],
      qrCodes: [
        { payload, ordinal, total: data.length, xMm, yMm, sizeMm: LARGE_QR, label: null },
      ],
    };
  });
  return { widthMm: A4_W, heightMm: A4_H, pages };
}

export const pdfCommands: Record<string, WebCommandHandler> = {
  pdf_standard_plan: (args) =>
    standardPlan((args.frames as string[]) ?? [], String(args.matchName ?? "")),
  pdf_large_plan: (args) =>
    largePlan((args.frames as string[]) ?? [], String(args.matchName ?? "")),
};
