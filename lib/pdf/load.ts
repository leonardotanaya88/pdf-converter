import { PDFDocument } from "pdf-lib";

/**
 * Load PDF source dengan pesan error yang jelas untuk file
 * rusak/terenkripsi (jebakan scope §10.2 — jangan asumsi semua PDF
 * bisa dibuka pdf-lib).
 */
export async function loadPdfSource(file: File): Promise<PDFDocument> {
  try {
    return await PDFDocument.load(await file.arrayBuffer());
  } catch {
    throw new Error(
      `"${file.name}" tidak bisa dibaca — kemungkinan terenkripsi atau rusak.`
    );
  }
}
