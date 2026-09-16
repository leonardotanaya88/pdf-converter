/**
 * Logika pencarian teks PDF — murni, tanpa DOM, tanpa import pdfjs.
 *
 * Input runs adalah item `page.getTextContent().items` (pdf.js) dalam bentuk
 * structural { str, transform, width, height }. Karena tidak bergantung pada
 * tipe pdfjs, file ini bisa dikompilasi dan ditest langsung di Node.
 *
 * Koordinat rect di sini adalah koordinat HALAMAN (PDF pt, origin kiri-bawah);
 * konversi ke layar dilakukan via `toViewportRect` dengan viewport dari
 * `page.getViewport({ scale })`.
 */

export interface TextRun {
  str: string;
  /** Matriks transform pdf.js: [a, b, c, d, e, f] — e = x, f = y (origin kiri-bawah). */
  transform: number[];
  width: number;
  height: number;
}

export interface PageTextIndex {
  page: number;
  runs: TextRun[];
  /** Semua teks halaman digabung, whitespace dinormalisasi jadi satu spasi. */
  text: string;
  /** Offset (char) awal tiap run di dalam `text`. */
  runStart: number[];
}

export interface MatchRect {
  x: number;
  y: number;
  w: number;
  h: number;
}

export interface TextMatch {
  page: number;
  runIndex: number;
  startOffset: number;
  endOffset: number;
  rect: MatchRect;
}

/** Gabung runs satu halaman jadi satu string yang bisa dicari lintas-run. */
export function indexPageText(page: number, runs: TextRun[]): PageTextIndex {
  let text = "";
  const runStart: number[] = [];
  const clean = runs.map((r) => r.str.replace(/\s+/g, " "));
  for (let i = 0; i < clean.length; i++) {
    if (i > 0) text += " ";
    runStart.push(text.length);
    text += clean[i];
  }
  return { page, runs, text, runStart };
}

export function escapeRegExp(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function runIndexAt(idx: PageTextIndex, offset: number): number {
  let r = 0;
  for (let i = 0; i < idx.runStart.length; i++) {
    if (idx.runStart[i] <= offset) r = i;
    else break;
  }
  return r;
}

function rectOfRun(run: TextRun): MatchRect {
  return {
    x: run.transform[4] ?? 0,
    y: run.transform[5] ?? 0,
    w: run.width || 0,
    h: run.height || Math.abs(run.transform[3] ?? 10) || 10,
  };
}

/** Bounding box rentang [start, end) dalam teks gabungan halaman. */
function rectForSpan(idx: PageTextIndex, start: number, end: number): MatchRect {
  const first = runIndexAt(idx, start);
  const last = runIndexAt(idx, Math.max(start, end - 1));
  const rects: MatchRect[] = [];
  for (let r = first; r <= last; r++) {
    const runText = idx.runs[r].str.replace(/\s+/g, " ");
    const from = Math.max(start, idx.runStart[r]) - idx.runStart[r];
    const to = Math.min(end, idx.runStart[r] + runText.length) - idx.runStart[r];
    if (to <= from) continue;
    const base = rectOfRun(idx.runs[r]);
    const ratio = runText.length > 0 ? base.w / runText.length : 0;
    rects.push({
      x: base.x + from * ratio,
      y: base.y,
      w: Math.max((to - from) * ratio, 1),
      h: base.h,
    });
  }
  if (rects.length === 0) return { x: 0, y: 0, w: 1, h: 1 };
  const x0 = Math.min(...rects.map((r) => r.x));
  const x1 = Math.max(...rects.map((r) => r.x + r.w));
  const y0 = Math.min(...rects.map((r) => r.y));
  const y1 = Math.max(...rects.map((r) => r.y + r.h));
  return { x: x0, y: y0, w: x1 - x0, h: y1 - y0 };
}

/** Cari query (case-insensitive) di semua halaman yang sudah di-index. */
export function findMatches(
  indexes: PageTextIndex[],
  query: string
): TextMatch[] {
  const q = query.trim();
  if (!q) return [];
  const re = new RegExp(escapeRegExp(q), "gi");
  const out: TextMatch[] = [];
  for (const idx of indexes) {
    let m: RegExpExecArray | null;
    while ((m = re.exec(idx.text)) !== null) {
      const start = m.index;
      const end = start + m[0].length;
      out.push({
        page: idx.page,
        runIndex: runIndexAt(idx, start),
        startOffset: start,
        endOffset: end,
        rect: rectForSpan(idx, start, end),
      });
    }
  }
  return out;
}

export interface ViewportLike {
  convertToViewportPoint(x: number, y: number): [number, number];
}

/** Konversi rect koordinat halaman → koordinat viewport (y ke bawah, siap canvas). */
export function toViewportRect(
  rect: MatchRect,
  viewport: ViewportLike
): { x: number; y: number; w: number; h: number } {
  const [x1, y1] = viewport.convertToViewportPoint(rect.x, rect.y);
  const [x2, y2] = viewport.convertToViewportPoint(
    rect.x + rect.w,
    rect.y + rect.h
  );
  return {
    x: Math.min(x1, x2),
    y: Math.min(y1, y2),
    w: Math.abs(x2 - x1),
    h: Math.abs(y2 - y1),
  };
}
