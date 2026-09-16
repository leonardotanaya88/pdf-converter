"use client";

import { useEffect, useRef, useState } from "react";
import { Loader2 } from "lucide-react";

import { loadPdfDocument, renderPageToCanvas } from "@/lib/pdf/preview";

/**
 * Target yang bisa diseret di atas pratinjau.
 * `rect` dalam satuan pt, koordinat PDF (origin kiri-bawah) — sama dengan
 * yang dipakai `draw`, jadi hit-test dan gambar selalu cocok.
 */
export interface DragTarget {
  id: string;
  rect: { x: number; y: number; width: number; height: number } | null;
}

interface OverlayPreviewProps {
  file: File;
  /**
   * Gambar overlay (misal teks nomor halaman / watermark) di atas halaman 1.
   * Koordinat dalam satuan pt (origin kiri-bawah, sama dengan pdf-lib)
   * sehingga preview identik dengan hasil akhir.
   */
  draw: (
    ctx: CanvasRenderingContext2D,
    pageWidthPt: number,
    pageHeightPt: number,
    scale: number
  ) => void;
  /** Nilai yang memicu redraw overlay (opsi user) tanpa render ulang halaman. */
  drawDeps?: unknown[];
  maxWidth?: number;
  label?: string;
  /** Target drag opsional; tanpa ini komponen berperilaku seperti sebelumnya. */
  dragTargets?: DragTarget[] | null;
  /**
   * Dipanggil saat pointer digeser di atas target yang sedang di-drag.
   * Delta dalam pt (dx ke kanan+, dy ke atas+) — parent yang menambahkannya
   * ke posisi saat ini (parent boleh materialisasi dari auto).
   */
  onTargetDrag?: (id: string, dx: number, dy: number) => void;
  /** Dimensi halaman 1 (pt) saat berhasil ter-render — untuk hit-test parent. */
  onPageDims?: (widthPt: number, heightPt: number) => void;
}

export function OverlayPreview({
  file,
  draw,
  drawDeps = [],
  maxWidth = 520,
  label = "Pratinjau halaman 1",
  dragTargets = null,
  onTargetDrag,
  onPageDims,
}: OverlayPreviewProps) {
  const baseRef = useRef<HTMLCanvasElement>(null);
  const overlayRef = useRef<HTMLCanvasElement>(null);
  const drawRef = useRef(draw);
  drawRef.current = draw;
  const onTargetDragRef = useRef(onTargetDrag);
  onTargetDragRef.current = onTargetDrag;
  const onPageDimsRef = useRef(onPageDims);
  onPageDimsRef.current = onPageDims;

  const [dims, setDims] = useState<{
    width: number;
    height: number;
    scale: number;
  } | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // State drag: koordinat pointer disimpan di ref (berubah tiap move),
  // id di state hanya untuk cursor.
  const dragRef = useRef<{ id: string; startX: number; startY: number } | null>(
    null
  );
  const [dragId, setDragId] = useState<string | null>(null);
  const [hoverId, setHoverId] = useState<string | null>(null);

  // Render halaman 1 sekali per file.
  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError(null);
    setDims(null);
    dragRef.current = null;
    setDragId(null);
    setHoverId(null);

    (async () => {
      try {
        const doc = await loadPdfDocument(file);
        const page = await doc.getPage(1);
        const vp1 = page.getViewport({ scale: 1 });
        const scale = maxWidth / vp1.width;
        const canvas = await renderPageToCanvas(doc, 1, scale);
        if (cancelled) {
          doc.destroy();
          return;
        }
        const base = baseRef.current;
        const overlay = overlayRef.current;
        if (base && overlay) {
          base.width = canvas.width;
          base.height = canvas.height;
          overlay.width = canvas.width;
          overlay.height = canvas.height;
          base.getContext("2d")!.drawImage(canvas, 0, 0);
        }
        setDims({ width: vp1.width, height: vp1.height, scale });
        onPageDimsRef.current?.(vp1.width, vp1.height);
        doc.destroy();
      } catch (e) {
        if (!cancelled)
          setError(e instanceof Error ? e.message : "Gagal render pratinjau.");
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [file, maxWidth]);

  // Gambar ulang overlay setiap kali opsi berubah.
  useEffect(() => {
    const overlay = overlayRef.current;
    if (!overlay || !dims) return;
    const ctx = overlay.getContext("2d");
    if (!ctx) return;
    ctx.clearRect(0, 0, overlay.width, overlay.height);
    drawRef.current(ctx, dims.width, dims.height, dims.scale);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [dims, ...drawDeps]);

  /** Konversi posisi pointer → pt (PDF coords) dan hit-test terhadap targets. */
  const hitTest = (clientX: number, clientY: number) => {
    const canvas = overlayRef.current;
    if (!canvas || !dims || !dragTargets) return null;
    const rect = canvas.getBoundingClientRect();
    if (rect.width === 0 || rect.height === 0) return null;
    // Canvas bisa ter-CSS-downscale (max-w-full) — konversi dua tahap.
    const cssScale = rect.width / canvas.width;
    const ptX = (clientX - rect.left) / cssScale / dims.scale;
    const ptY = dims.height - (clientY - rect.top) / cssScale / dims.scale;
    for (const t of dragTargets) {
      if (!t.rect) continue;
      const { x, y, width, height } = t.rect;
      if (ptX >= x && ptX <= x + width && ptY >= y && ptY <= y + height) {
        return t;
      }
    }
    return null;
  };

  const handlePointerDown = (e: React.PointerEvent<HTMLDivElement>) => {
    const hit = hitTest(e.clientX, e.clientY);
    if (!hit) return;
    e.preventDefault();
    e.currentTarget.setPointerCapture(e.pointerId);
    dragRef.current = { id: hit.id, startX: e.clientX, startY: e.clientY };
    setDragId(hit.id);
  };

  const handlePointerMove = (e: React.PointerEvent<HTMLDivElement>) => {
    const drag = dragRef.current;
    const canvas = overlayRef.current;
    if (drag && canvas && dims) {
      const rect = canvas.getBoundingClientRect();
      if (rect.width === 0 || rect.height === 0) return;
      const cssScale = rect.width / canvas.width;
      const dx = (e.clientX - drag.startX) / cssScale / dims.scale;
      const dy = -(e.clientY - drag.startY) / cssScale / dims.scale; // flip Y
      if (dx !== 0 || dy !== 0) {
        dragRef.current = {
          id: drag.id,
          startX: e.clientX,
          startY: e.clientY,
        };
        onTargetDragRef.current?.(drag.id, dx, dy);
      }
      return;
    }
    // Tanpa drag: cursor "grab" saat hover di atas target.
    const hit = hitTest(e.clientX, e.clientY);
    setHoverId(hit?.id ?? null);
  };

  const handlePointerEnd = (e: React.PointerEvent<HTMLDivElement>) => {
    if (!dragRef.current) return;
    dragRef.current = null;
    setDragId(null);
    try {
      e.currentTarget.releasePointerCapture(e.pointerId);
    } catch {
      // Capture sudah lepas — abaikan.
    }
  };

  const cursor = dragId ? "grabbing" : hoverId ? "grab" : undefined;

  return (
    <div className="flex flex-col gap-2">
      {label && (
        <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
          {label}
        </p>
      )}
      <div
        className="relative inline-block overflow-hidden rounded-lg border border-border bg-white shadow-soft"
        style={{ touchAction: "none", cursor }}
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={handlePointerEnd}
        onPointerCancel={handlePointerEnd}
        onLostPointerCapture={handlePointerEnd}
      >
        <canvas ref={baseRef} className="block max-w-full" />
        <canvas ref={overlayRef} className="absolute inset-0 h-full w-full" />
        {loading && (
          <div className="absolute inset-0 flex items-center justify-center gap-2 bg-white/80 text-sm text-muted-foreground">
            <Loader2 className="h-4 w-4 animate-spin" /> Merender pratinjau…
          </div>
        )}
      </div>
      {error && <p className="text-xs text-destructive">{error}</p>}
    </div>
  );
}
