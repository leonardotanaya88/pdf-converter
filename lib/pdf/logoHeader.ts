import { StandardFonts, rgb } from "pdf-lib";

import { loadPdfSource } from "./load";
import { parseRanges } from "./split";

/**
 * Posisi bebas dalam satuan pt, koordinat PDF (origin kiri-bawah).
 * Logo: x,y = sudut kiri-bawah logo. Teks: x,y = baseline.
 */
export interface FreePosition {
  x: number;
  y: number;
}

export interface LogoHeaderOptions {
  logo?: File | null; // JPG/PNG; null = tanpa logo
  logoHeight: number; // pt target tinggi logo
  logoOpacity: number; // 0..1
  logoPos: FreePosition | null; // null = auto (kiri, tengah strip)
  text: string; // "" = tanpa teks
  textFontSize: number; // pt
  textColor: string; // hex "#rrggbb"
  textBold: boolean;
  textItalic: boolean;
  textPos: FreePosition | null; // null = auto (kanan, tengah strip)
  backgroundEnabled: boolean;
  backgroundColor: string; // hex
  backgroundOpacity: number; // 0..1
  excludeFirst: boolean; // kecuali halaman 1
  excludeRanges: string; // "1-3,5" (1-based); "" = tidak ada
}

export const HEADER_PADDING = 10; // pt inset strip + margin horizontal

export interface HeaderLayout {
  stripY: number; // tepi bawah strip, koordinat PDF (origin kiri-bawah)
  stripHeight: number;
  stripWidth: number; // selalu = pageWidth
  logo: { x: number; y: number; width: number; height: number } | null;
  text: { x: number; y: number } | null; // y = baseline
}

/** Setengah dari (ascent − descent) Helvetica: (0.718 − 0.207) / 2. */
const HALF_ASCENT_DESCENT = 0.2555;
/** Ascent Helvetica (em di atas baseline) — batas atas baseline teks. */
export const TEXT_ASCENT = 0.718;

/**
 * Layout strip header dalam koordinat PDF (origin kiri-bawah, satuan pt).
 * Fungsi murni — dipakai pdf-lib (proses) DAN canvas (preview live)
 * supaya preview dan hasil akhir identik.
 *
 * Posisi logo/teks bebas (pt). Kalau null → auto di dalam strip:
 * logo kiri, teks kanan, keduanya di tengah vertikal. Kalau eksplisit →
 * di-clamp ke dalam halaman (logo: tepi halaman; teks: baseline dijamin
 * tidak terpotong tepi atas/bawah).
 */
export function computeHeaderLayout(args: {
  pageWidth: number;
  pageHeight: number;
  logoWidth: number; // sudah di-clamp per halaman
  logoHeight: number;
  textWidth: number; // diukur caller (Helvetica vs Inter boleh beda tipis)
  fontSize: number; // sudah di-clamp
  logoPos: FreePosition | null;
  textPos: FreePosition | null;
  hasLogo: boolean;
  hasText: boolean;
  padding?: number;
}): HeaderLayout {
  const padding = args.padding ?? HEADER_PADDING;
  const { pageWidth: W, pageHeight: H, hasLogo, hasText } = args;

  const stripHeight =
    padding * 2 +
    Math.max(hasLogo ? args.logoHeight : 0, hasText ? args.fontSize : 0);
  const stripY = H - stripHeight;

  // Amankan kalau item lebih lebar dari halaman (caller sudah clamp,
  // tapi fungsi ini harus aman dipakai langsung juga).
  const xMax = (itemWidth: number) => Math.max(padding, W - itemWidth - padding);
  const clamp = (v: number, min: number, max: number) =>
    Math.min(Math.max(v, min), Math.max(min, max));

  let logo: HeaderLayout["logo"] = null;
  let text: HeaderLayout["text"] = null;

  if (hasLogo) {
    const pos = args.logoPos ?? {
      x: padding,
      y: stripY + (stripHeight - args.logoHeight) / 2,
    };
    logo = {
      x: clamp(pos.x, padding, xMax(args.logoWidth)),
      y: clamp(pos.y, 0, H - args.logoHeight),
      width: args.logoWidth,
      height: args.logoHeight,
    };
  }
  if (hasText) {
    const pos = args.textPos ?? {
      x: W - padding - args.textWidth,
      y: stripY + stripHeight / 2 + args.fontSize * HALF_ASCENT_DESCENT,
    };
    text = {
      x: clamp(pos.x, padding, xMax(args.textWidth)),
      // Baseline minimal = fontSize (ruang descender di tepi bawah),
      // maksimal = H − ascent supaya huruf tidak terpotong tepi atas.
      y: clamp(pos.y, args.fontSize, H - args.fontSize * TEXT_ASCENT),
    };
  }

  return { stripY, stripHeight, stripWidth: W, logo, text };
}

/** Kecilkan logo secara proporsional kalau melebihi maxWidth. */
export function clampLogoToFit(
  logoWidth: number,
  logoHeight: number,
  maxWidth: number
): { logoWidth: number; logoHeight: number } {
  if (logoWidth <= maxWidth) return { logoWidth, logoHeight };
  const s = maxWidth / logoWidth;
  return { logoWidth: maxWidth, logoHeight: logoHeight * s };
}

/** Kecilkan font secara linier kalau teks melebihi maxWidth. */
export function clampTextToFit(
  fontSize: number,
  textWidth: number,
  maxWidth: number
): { fontSize: number; textWidth: number } {
  if (textWidth <= maxWidth) return { fontSize, textWidth };
  const s = maxWidth / textWidth;
  return { fontSize: fontSize * s, textWidth: maxWidth };
}

/**
 * Union halaman 1 (jika excludeFirst) + hasil parseRanges.
 * parseRanges fail-loudly dengan pesan Bahasa Indonesia.
 */
export function buildExcludedPages(
  excludeFirst: boolean,
  excludeRanges: string,
  pageCount: number
): Set<number> {
  const s = new Set<number>();
  if (excludeFirst) s.add(1);
  if (excludeRanges.trim()) {
    parseRanges(excludeRanges, pageCount).forEach((p) => s.add(p));
  }
  return s;
}

export function shouldApplyToPage(
  pageNumber1Based: number,
  excluded: ReadonlySet<number>
): boolean {
  return !excluded.has(pageNumber1Based);
}

const FONT_MAP = {
  "false-false": StandardFonts.Helvetica,
  "true-false": StandardFonts.HelveticaBold,
  "false-true": StandardFonts.HelveticaOblique,
  "true-true": StandardFonts.HelveticaBoldOblique,
} as const;

export function pickHeaderFont(bold: boolean, italic: boolean): StandardFonts {
  return FONT_MAP[`${bold}-${italic}` as keyof typeof FONT_MAP];
}

function hexToRgb(hex: string) {
  const h = hex.replace("#", "");
  return rgb(
    parseInt(h.slice(0, 2), 16) / 255,
    parseInt(h.slice(2, 4), 16) / 255,
    parseInt(h.slice(4, 6), 16) / 255
  );
}

export async function addLogoHeader(
  file: File,
  opts: LogoHeaderOptions
): Promise<Uint8Array> {
  const text = opts.text.replace(/\n/g, " ").trim();
  if (!opts.logo && !text) {
    throw new Error("Tambahkan logo atau teks header dulu.");
  }

  const src = await loadPdfSource(file);
  const excluded = buildExcludedPages(
    opts.excludeFirst,
    opts.excludeRanges,
    src.getPageCount()
  );

  const font = text
    ? await src.embedFont(pickHeaderFont(opts.textBold, opts.textItalic))
    : null;

  let image: Awaited<ReturnType<typeof src.embedJpg>> | null = null;
  let baseLogoWidth = 0;
  let baseLogoHeight = 0;
  if (opts.logo) {
    const bytes = await opts.logo.arrayBuffer();
    image = await src.embedJpg(bytes).catch(() => src.embedPng(bytes));
    baseLogoHeight = opts.logoHeight;
    baseLogoWidth = (baseLogoHeight * image.width) / image.height;
  }

  src.getPages().forEach((page, idx) => {
    const pageNumber = idx + 1; // 1-based
    if (!shouldApplyToPage(pageNumber, excluded)) return;
    const W = page.getWidth();
    const maxW = W - 2 * HEADER_PADDING;

    // Clamp per halaman (halaman bisa beda ukuran dalam satu dokumen).
    let lw = 0;
    let lh = 0;
    if (image) {
      ({ logoWidth: lw, logoHeight: lh } = clampLogoToFit(
        baseLogoWidth,
        baseLogoHeight,
        maxW
      ));
    }
    let fontSize = opts.textFontSize;
    let textWidth = 0;
    if (font) {
      textWidth = font.widthOfTextAtSize(text, opts.textFontSize);
      ({ fontSize, textWidth } = clampTextToFit(
        opts.textFontSize,
        textWidth,
        maxW
      ));
    }

    const layout = computeHeaderLayout({
      pageWidth: W,
      pageHeight: page.getHeight(),
      logoWidth: lw,
      logoHeight: lh,
      textWidth,
      fontSize,
      logoPos: opts.logoPos,
      textPos: opts.textPos,
      hasLogo: !!image,
      hasText: !!font,
    });

    // Urutan gambar: ① strip latar → ② logo → ③ teks.
    if (opts.backgroundEnabled) {
      page.drawRectangle({
        x: 0,
        y: layout.stripY,
        width: layout.stripWidth,
        height: layout.stripHeight,
        color: hexToRgb(opts.backgroundColor),
        opacity: opts.backgroundOpacity,
      });
    }
    if (image && layout.logo) {
      page.drawImage(image, { ...layout.logo, opacity: opts.logoOpacity });
    }
    if (font && layout.text) {
      page.drawText(text, {
        x: layout.text.x,
        y: layout.text.y,
        size: fontSize,
        font,
        color: hexToRgb(opts.textColor),
      });
    }
  });

  return src.save();
}
