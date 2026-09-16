import { PDFDocument, StandardFonts, rgb } from "pdf-lib";

import { loadPdfSource } from "./load";

export type PageNumberPosition =
  | "top-left"
  | "top-center"
  | "top-right"
  | "middle-left"
  | "middle-center"
  | "middle-right"
  | "bottom-left"
  | "bottom-center"
  | "bottom-right";

export type PageNumberFormat = "number" | "page-n" | "n-of-n";

export interface PageNumberOptions {
  position: PageNumberPosition;
  format: PageNumberFormat;
  fontSize: number;
  margin: number; // titik (pt) dari tepi halaman
  startAt?: number;
}

export function getPageNumberText(
  pageIndex: number,
  total: number,
  format: PageNumberFormat,
  startAt = 1
): string {
  const n = pageIndex + startAt;
  switch (format) {
    case "page-n":
      return `Page ${n}`;
    case "n-of-n":
      return `${n} of ${total}`;
    default:
      return String(n);
  }
}

/**
 * Posisi teks dalam koordinat PDF (origin kiri-bawah, satuan pt).
 * Fungsi murni — dipakai pdf-lib (proses) DAN canvas (preview live)
 * supaya preview dan hasil akhir identik.
 */
export function getPageNumberPosition(
  pageWidth: number,
  pageHeight: number,
  textWidth: number,
  fontSize: number,
  position: PageNumberPosition,
  margin: number
): { x: number; y: number } {
  const [vert, horiz] = position.split("-");
  const x =
    horiz === "left"
      ? margin
      : horiz === "right"
        ? pageWidth - margin - textWidth
        : (pageWidth - textWidth) / 2;
  const y =
    vert === "top"
      ? pageHeight - margin - fontSize
      : vert === "bottom"
        ? margin
        : (pageHeight - fontSize) / 2;
  return { x, y };
}

export async function addPageNumbers(
  file: File,
  opts: PageNumberOptions
): Promise<Uint8Array> {
  const src = await loadPdfSource(file);
  const font = await src.embedFont(StandardFonts.Helvetica);
  const total = src.getPageCount();
  const { position, format, fontSize, margin, startAt = 1 } = opts;

  src.getPages().forEach((page, idx) => {
    const text = getPageNumberText(idx, total, format, startAt);
    const textWidth = font.widthOfTextAtSize(text, fontSize);
    const { x, y } = getPageNumberPosition(
      page.getWidth(),
      page.getHeight(),
      textWidth,
      fontSize,
      position,
      margin
    );
    page.drawText(text, {
      x,
      y,
      size: fontSize,
      font,
      color: rgb(0.12, 0.12, 0.12),
    });
  });

  return src.save();
}
