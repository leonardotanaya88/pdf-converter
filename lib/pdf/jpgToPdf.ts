import { PDFDocument, PageSizes } from "pdf-lib";

export type JpgToPdfPageSize = "a4" | "fit";

export interface JpgToPdfOptions {
  pageSize: JpgToPdfPageSize;
  landscape: boolean; // hanya berlaku untuk a4
}

/** Gambar JPG/PNG → PDF, 1 gambar per halaman. */
export async function jpgsToPdf(
  files: File[],
  opts: JpgToPdfOptions
): Promise<Uint8Array> {
  if (!files.length) {
    throw new Error("Pilih minimal 1 gambar.");
  }

  const doc = await PDFDocument.create();

  for (const f of files) {
    const bytes = await f.arrayBuffer();
    const image =
      f.type === "image/png" ? await doc.embedPng(bytes) : await doc.embedJpg(bytes);

    if (opts.pageSize === "fit") {
      doc.addPage([image.width, image.height]);
      continue;
    }

    let [w, h] = PageSizes.A4;
    if (opts.landscape) [w, h] = [h, w];
    const scale = Math.min(w / image.width, h / image.height);
    const iw = image.width * scale;
    const ih = image.height * scale;
    const page = doc.addPage([w, h]);
    page.drawImage(image, { x: (w - iw) / 2, y: (h - ih) / 2, width: iw, height: ih });
  }

  return doc.save();
}
