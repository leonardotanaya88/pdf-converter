import { PDFDocument } from "pdf-lib";

import { loadPdfSource } from "./load";

/** "1-3,5,7-9" → [1,2,3,5,7,8,9]. Validasi bounds & format, fail-loudly. */
export function parseRanges(input: string, pageCount: number): number[] {
  const parts = input
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);

  if (parts.length === 0) {
    throw new Error("Isi rentang halaman dulu. Contoh: 1-3,5,7-9");
  }

  const pages: number[] = [];
  for (const part of parts) {
    const m = part.match(/^(\d+)(?:\s*-\s*(\d+))?$/);
    if (!m) {
      throw new Error(`Format rentang tidak valid: "${part}". Contoh: 1-3,5,7-9`);
    }
    const a = parseInt(m[1], 10);
    const b = m[2] ? parseInt(m[2], 10) : a;
    if (a < 1 || b > pageCount || a > b) {
      throw new Error(`Rentang ${a}-${b} di luar 1..${pageCount}.`);
    }
    for (let i = a; i <= b; i++) pages.push(i);
  }
  return pages;
}

/** Satu PDF per halaman. */
export async function splitEveryPage(file: File): Promise<Uint8Array[]> {
  const src = await loadPdfSource(file);
  const out: Uint8Array[] = [];
  for (let i = 1; i <= src.getPageCount(); i++) {
    const d = await PDFDocument.create();
    const [page] = await d.copyPages(src, [i - 1]);
    d.addPage(page);
    out.push(await d.save());
  }
  return out;
}

/** Kelompokkan rentang menjadi grup berurutan → satu PDF per grup. */
export async function splitByRanges(
  file: File,
  ranges: string
): Promise<Uint8Array[]> {
  const src = await loadPdfSource(file);
  const pages = parseRanges(ranges, src.getPageCount());

  const groups: number[][] = [];
  let cur: number[] = [];
  pages.forEach((p, idx) => {
    if (idx === 0 || p === pages[idx - 1] + 1) {
      cur.push(p);
    } else {
      groups.push(cur);
      cur = [p];
    }
  });
  if (cur.length) groups.push(cur);

  const out: Uint8Array[] = [];
  for (const g of groups) {
    const d = await PDFDocument.create();
    for (const p of g) {
      const [page] = await d.copyPages(src, [p - 1]);
      d.addPage(page);
    }
    out.push(await d.save());
  }
  return out;
}

/** Halaman terpilih (urut sesuai urutan pilihan) → 1 PDF. Dipakai juga oleh Extract. */
export async function extractPages(
  file: File,
  pages: number[]
): Promise<Uint8Array> {
  if (!pages.length) {
    throw new Error("Pilih minimal 1 halaman.");
  }
  const src = await loadPdfSource(file);
  const d = await PDFDocument.create();
  for (const p of pages) {
    const [page] = await d.copyPages(src, [p - 1]);
    d.addPage(page);
  }
  return d.save();
}
