import { PDFDocument, StandardFonts, rgb, degrees } from "pdf-lib";

import { loadPdfSource } from "./load";

export type WatermarkMode = "center" | "tile";

export interface TextWatermarkOptions {
  text: string;
  opacity: number; // 0..1
  rotation: number; // derajat
  color: string; // hex "#rrggbb"
  mode: WatermarkMode;
  fontSize: number;
}

export interface ImageWatermarkOptions {
  image: File;
  opacity: number; // 0..1
  mode: WatermarkMode;
  scale: number; // relatif terhadap ukuran asli gambar
}

function hexToRgb(hex: string) {
  const h = hex.replace("#", "");
  return rgb(
    parseInt(h.slice(0, 2), 16) / 255,
    parseInt(h.slice(2, 4), 16) / 255,
    parseInt(h.slice(4, 6), 16) / 255
  );
}

export async function addTextWatermark(
  file: File,
  opts: TextWatermarkOptions
): Promise<Uint8Array> {
  const text = opts.text.trim();
  if (!text) {
    throw new Error("Tulis teks watermark dulu.");
  }

  const src = await loadPdfSource(file);
  const font = await src.embedFont(StandardFonts.HelveticaBold);
  const { opacity, rotation, color, mode, fontSize } = opts;
  const textWidth = font.widthOfTextAtSize(text, fontSize);

  for (const page of src.getPages()) {
    const W = page.getWidth();
    const H = page.getHeight();
    const draw = (x: number, y: number) =>
      page.drawText(text, {
        x,
        y,
        size: fontSize,
        font,
        color: hexToRgb(color),
        opacity,
        rotate: degrees(rotation),
      });

    if (mode === "tile") {
      const stepX = textWidth + 140;
      const stepY = fontSize * 2.8;
      for (let y = -H; y < H * 2; y += stepY) {
        for (let x = -W; x < W * 2; x += stepX) draw(x, y);
      }
    } else {
      draw((W - textWidth) / 2, (H - fontSize) / 2);
    }
  }

  return src.save();
}

export async function addImageWatermark(
  file: File,
  opts: ImageWatermarkOptions
): Promise<Uint8Array> {
  const src = await loadPdfSource(file);
  const bytes = await opts.image.arrayBuffer();
  const image = await src.embedJpg(bytes).catch(() => src.embedPng(bytes));
  const { opacity, mode, scale } = opts;
  const iw = image.width * scale;
  const ih = image.height * scale;

  for (const page of src.getPages()) {
    const W = page.getWidth();
    const H = page.getHeight();
    const draw = (x: number, y: number) =>
      page.drawImage(image, { x, y, width: iw, height: ih, opacity });

    if (mode === "tile") {
      const stepX = iw + 100;
      const stepY = ih + 100;
      for (let y = -H; y < H * 2; y += stepY) {
        for (let x = -W; x < W * 2; x += stepX) draw(x, y);
      }
    } else {
      draw((W - iw) / 2, (H - ih) / 2);
    }
  }

  return src.save();
}
