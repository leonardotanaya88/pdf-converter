export interface RgbaPixel {
  r: number;
  g: number;
  b: number;
}

export interface RemoveBackgroundOptions {
  /** Warna target yang dihapus. */
  color: RgbaPixel;
  /** 0..255 — jarak maksimal per kanal (Chebyshev) untuk dianggap "match". */
  tolerance: number;
  /**
   * "edges" = flood fill dari tepi gambar (area match yang tersembunyi di
   * tengah, mis. putih di dalam logo, dipertahankan); "global" = semua piksel
   * match dihapus.
   */
  mode: "edges" | "global";
  /**
   * Hapus halo anti-aliasing: piksel dengan jarak tol..tol×1.7 diberi alpha
   * parsial. Default true.
   */
  feather?: boolean;
}

/**
 * Salin ulang { data, width, height } (structural — ImageData cocok tanpa
 * import DOM) dan hilangkan latar belakang berbasis warna. Input tidak
 * dimutasi; hasil alpha dikalikan alpha asli (PNG yang sudah transparan
 * tetap dihormati).
 */
export function removeBackgroundColor(
  source: { data: Uint8ClampedArray; width: number; height: number },
  opts: RemoveBackgroundOptions
): Uint8ClampedArray {
  const { width, height } = source;
  const src = source.data;
  const out = new Uint8ClampedArray(src);
  const tol = Math.min(Math.max(opts.tolerance, 0), 255);
  const feather = opts.feather !== false;
  const hard = tol;
  const soft = tol * 1.7; // batas feather; tol 0 → soft 0 (tidak pernah dipakai)

  /** Jarak Chebyshev ke warna target. */
  const dist = (i: number) =>
    Math.max(
      Math.abs(src[i] - opts.color.r),
      Math.abs(src[i + 1] - opts.color.g),
      Math.abs(src[i + 2] - opts.color.b)
    );

  /** Set alpha hasil (dikalikan alpha asli). */
  const setAlpha = (i: number, a: number) => {
    out[i + 3] = Math.round((a * src[i + 3]) / 255);
  };

  /** Alpha parsial untuk zona feather: 0 di tol, 255 di tol×1.7. */
  const featherAlpha = (d: number) => {
    if (d <= hard) return 0;
    if (feather && d <= soft) {
      return Math.round(((d - hard) / (soft - hard)) * 255);
    }
    return null;
  };

  if (opts.mode === "global") {
    for (let i = 0; i < src.length; i += 4) {
      const a = featherAlpha(dist(i));
      if (a !== null) setAlpha(i, a);
    }
    return out;
  }

  // edges: BFS iteratif dari semua piksel tepi yang match (hard/soft).
  // Queue & visited dengan array berukuran tetap — aman untuk gambar besar
  // tanpa rekursi.
  const visited = new Uint8Array(width * height);
  const queue = new Int32Array(width * height);
  let head = 0;
  let tail = 0;

  const seed = (p: number) => {
    if (visited[p]) return;
    visited[p] = 1;
    if (featherAlpha(dist(p * 4)) !== null) queue[tail++] = p;
  };

  for (let y = 0; y < height; y++) {
    seed(y * width);
    seed(y * width + width - 1);
  }
  for (let x = 0; x < width; x++) {
    seed(x);
    seed((height - 1) * width + x);
  }

  while (head < tail) {
    const p = queue[head++];
    const a = featherAlpha(dist(p * 4));
    if (a !== null) setAlpha(p * 4, a);

    const px = p % width;
    if (px > 0 && !visited[p - 1]) seed(p - 1);
    if (px < width - 1 && !visited[p + 1]) seed(p + 1);
    if (p >= width && !visited[p - width]) seed(p - width);
    if (p < width * height - width && !visited[p + width]) seed(p + width);
  }

  return out;
}
