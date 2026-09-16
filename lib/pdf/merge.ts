import { PDFDocument } from "pdf-lib";

import { loadPdfSource } from "./load";

/** Gabung banyak PDF berurutan → satu PDF. */
export async function mergePdfs(files: File[]): Promise<Uint8Array> {
  if (files.length < 2) {
    throw new Error("Pilih minimal 2 file PDF untuk digabung.");
  }

  const out = await PDFDocument.create();
  for (const file of files) {
    const src = await loadPdfSource(file);
    const pages = await out.copyPages(src, src.getPageIndices());
    pages.forEach((p) => out.addPage(p));
  }
  return out.save();
}
