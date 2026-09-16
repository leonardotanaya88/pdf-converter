/**
 * Helper pdf.js — render & preview halaman. Hanya boleh diimport
 * dari client components ("use client").
 *
 * Worker pdf.js disalin ke /public oleh script postinstall
 * (node_modules/pdfjs-dist/build/pdf.worker.min.mjs → public/).
 */
import * as pdfjsLib from "pdfjs-dist";
import type { PDFDocumentProxy } from "pdfjs-dist";

if (typeof window !== "undefined") {
  pdfjsLib.GlobalWorkerOptions.workerSrc = "/pdf.worker.min.mjs";
}

export async function loadPdfDocument(
  file: File | ArrayBuffer
): Promise<PDFDocumentProxy> {
  if (!file) throw new Error("File tidak tersedia.");
  const data = file instanceof File ? await file.arrayBuffer() : file;
  return pdfjsLib.getDocument({ data }).promise;
}

export async function renderPageToCanvas(
  doc: PDFDocumentProxy,
  pageNumber: number,
  scale: number
): Promise<HTMLCanvasElement> {
  const page = await doc.getPage(pageNumber);
  const viewport = page.getViewport({ scale });
  const canvas = document.createElement("canvas");
  canvas.width = Math.ceil(viewport.width);
  canvas.height = Math.ceil(viewport.height);
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("Canvas tidak didukung browser ini.");
  await page.render({ canvasContext: ctx, viewport }).promise;
  return canvas;
}

/** Beri kesempatan main thread bernapas (jebakan scope §10.1). */
export function yieldToMain(): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, 0));
}
