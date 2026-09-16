import { PDFDocument, degrees } from "pdf-lib";

import { loadPdfSource } from "./load";

export type Rotation = 90 | 180 | 270;

export interface PageRotation {
  page: number; // 1-indexed
  delta: Rotation;
}

/** Rotasi per-halaman (delta relatif), bisa campuran 90/180/270. */
export async function rotatePdf(
  file: File,
  rotations: PageRotation[]
): Promise<Uint8Array> {
  if (!rotations.length) {
    throw new Error("Pilih halaman yang akan diputar.");
  }
  const src = await loadPdfSource(file);
  for (const r of rotations) {
    const page = src.getPage(r.page - 1);
    page.setRotation(degrees((page.getRotation().angle + r.delta) % 360));
  }
  return src.save();
}
