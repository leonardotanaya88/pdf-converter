import { loadPdfDocument, renderPageToCanvas, yieldToMain } from "./preview";

export interface JpgOutput {
  name: string;
  blob: Blob;
}

/**
 * Setiap halaman PDF → JPEG via canvas.toBlob.
 * `scale` menentukan resolusi (1 ≈ 72 DPI, 2 ≈ 144 DPI).
 */
export async function pdfToJpgs(
  file: File,
  quality: number,
  scale = 2
): Promise<JpgOutput[]> {
  const doc = await loadPdfDocument(file);
  const base = file.name.replace(/\.pdf$/i, "");
  const out: JpgOutput[] = [];

  try {
    for (let p = 1; p <= doc.numPages; p++) {
      const canvas = await renderPageToCanvas(doc, p, scale);
      const blob = await new Promise<Blob>((resolve, reject) => {
        canvas.toBlob(
          (b) => (b ? resolve(b) : reject(new Error(`Gagal render halaman ${p}.`))),
          "image/jpeg",
          quality
        );
      });
      out.push({ name: `${base}-page-${p}.jpg`, blob });
      if (p % 3 === 0) await yieldToMain();
    }
  } finally {
    doc.destroy();
  }

  return out;
}
