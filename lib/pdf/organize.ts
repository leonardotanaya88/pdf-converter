import { PDFDocument } from "pdf-lib";

import { loadPdfSource } from "./load";

/**
 * Susun ulang halaman: `order` = daftar nomor halaman asli (1-indexed)
 * dalam urutan akhir yang diinginkan (halaman yang dihapus cukup
 * dihilangkan dari array ini).
 */
export async function organizePdf(
  file: File,
  order: number[]
): Promise<Uint8Array> {
  if (!order.length) {
    throw new Error("Semua halaman terhapus — tidak ada yang bisa disimpan.");
  }
  const src = await loadPdfSource(file);
  const d = await PDFDocument.create();
  for (const p of order) {
    const [page] = await d.copyPages(src, [p - 1]);
    d.addPage(page);
  }
  return d.save();
}
