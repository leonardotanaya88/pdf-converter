"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import type { PDFDocumentProxy } from "pdfjs-dist";
import {
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  ChevronUp,
  Loader2,
  Maximize,
  Minus,
  PanelLeft,
  Plus,
  Search,
  X,
} from "lucide-react";

import {
  loadPdfDocument,
  renderPageToCanvas,
  yieldToMain,
} from "@/lib/pdf/preview";
import {
  findMatches,
  indexPageText,
  toViewportRect,
  type PageTextIndex,
  type TextMatch,
  type TextRun,
  type ViewportLike,
} from "@/lib/pdf/search";
import { Input } from "@/components/ui/input";
import { Slider } from "@/components/ui/slider";
import { cn } from "@/lib/utils";

const THUMB_W = 120;
const MIN_SCALE = 0.25;
const MAX_SCALE = 4;
const HIGHLIGHT = "rgba(253, 224, 71, 0.45)";
const HIGHLIGHT_ACTIVE = "rgba(249, 115, 22, 0.55)";

interface PdfReaderProps {
  file: File;
  onReset: () => void;
}

/** Viewer PDF: toolbar navigasi/zoom/cari + sidebar thumbnail + canvas halaman. */
export function PdfReader({ file, onReset }: PdfReaderProps) {
  const [doc, setDoc] = useState<PDFDocumentProxy | null>(null);
  const [total, setTotal] = useState(0);
  const [pageNumber, setPageNumber] = useState(1);
  const [scale, setScale] = useState(1.2);
  const [renderBusy, setRenderBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [thumbnails, setThumbnails] = useState<Map<number, string>>(new Map());
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [query, setQuery] = useState("");
  const [matches, setMatches] = useState<TextMatch[]>([]);
  const [matchIndex, setMatchIndex] = useState(0);
  const [searching, setSearching] = useState(false);

  const docRef = useRef<PDFDocumentProxy | null>(null);
  const renderId = useRef(0);
  const textCache = useRef<Map<number, PageTextIndex>>(new Map());
  const viewportRef = useRef<ViewportLike | null>(null);
  const canvasWrapRef = useRef<HTMLDivElement>(null);
  const overlayRef = useRef<HTMLCanvasElement | null>(null);
  const markerRef = useRef<HTMLDivElement>(null);
  const matchIndexRef = useRef(0);

  const goTo = useCallback(
    (p: number) => {
      setPageNumber(Math.min(Math.max(Math.round(p), 1), total || 1));
    },
    [total]
  );

  const redrawOverlay = useCallback(() => {
    const ov = overlayRef.current;
    const vp = viewportRef.current;
    if (!ov || !vp) return;
    const ctx = ov.getContext("2d");
    if (!ctx) return;
    ctx.clearRect(0, 0, ov.width, ov.height);
    const cur = matches[matchIndexRef.current];
    for (const m of matches) {
      if (m.page !== pageNumber) continue;
      const r = toViewportRect(m.rect, vp);
      ctx.fillStyle = m === cur ? HIGHLIGHT_ACTIVE : HIGHLIGHT;
      ctx.fillRect(r.x, r.y, Math.max(r.w, 1), Math.max(r.h, 1));
    }
  }, [matches, pageNumber]);

  // Load dokumen + render thumbnail berurutan (jangan banjiri main thread).
  useEffect(() => {
    let cancelled = false;
    docRef.current?.destroy();
    docRef.current = null;
    renderId.current++;
    textCache.current = new Map();
    setDoc(null);
    setTotal(0);
    setPageNumber(1);
    setError(null);
    setQuery("");
    setMatches([]);
    setMatchIndex(0);
    matchIndexRef.current = 0;
    setThumbnails(new Map());

    (async () => {
      try {
        const d = await loadPdfDocument(file);
        if (cancelled) {
          d.destroy();
          return;
        }
        docRef.current = d;
        setDoc(d);
        setTotal(d.numPages);

        const map = new Map<number, string>();
        for (let p = 1; p <= d.numPages; p++) {
          if (cancelled) break;
          try {
            const page = await d.getPage(p);
            const vp = page.getViewport({ scale: 1 });
            const canvas = await renderPageToCanvas(
              d,
              p,
              THUMB_W / vp.width
            );
            map.set(p, canvas.toDataURL("image/jpeg", 0.75));
          } catch {
            // halaman rusak — thumbnail dikosongkan
          }
          if (p % 5 === 0) {
            setThumbnails(new Map(map));
            await yieldToMain();
          }
        }
        if (!cancelled) setThumbnails(map);
      } catch (e) {
        if (!cancelled)
          setError(e instanceof Error ? e.message : "Gagal membaca PDF.");
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [file]);

  // Render halaman aktif. Guard renderId membuang hasil render basi
  // (navigasi cepat) tanpa menumpuk tugas render.
  useEffect(() => {
    const d = docRef.current;
    if (!d) return;
    const id = ++renderId.current;
    setRenderBusy(true);
    (async () => {
      try {
        const page = await d.getPage(pageNumber);
        const vp = page.getViewport({ scale });
        const canvas = await renderPageToCanvas(d, pageNumber, scale);
        if (renderId.current !== id) return; // render basi — buang
        const wrap = canvasWrapRef.current;
        if (!wrap) return;
        wrap.querySelectorAll("canvas").forEach((c) => c.remove());
        wrap.appendChild(canvas);
        const ov = document.createElement("canvas");
        ov.className = "pointer-events-none absolute inset-0";
        wrap.appendChild(ov);
        overlayRef.current = ov;
        ov.width = canvas.width;
        ov.height = canvas.height;
        viewportRef.current = vp as unknown as ViewportLike;
        redrawOverlay();

        // Lompat ke match aktif di halaman ini (penanda lalu hilang).
        const cur = matches[matchIndexRef.current];
        if (cur && cur.page === pageNumber) {
          const r = toViewportRect(cur.rect, viewportRef.current);
          const marker = markerRef.current;
          if (marker) {
            marker.style.left = `${r.x}px`;
            marker.style.top = `${r.y}px`;
            marker.style.width = `${Math.max(r.w, 2)}px`;
            marker.style.height = `${Math.max(r.h, 2)}px`;
            marker.style.display = "block";
            marker.scrollIntoView({ block: "center", behavior: "smooth" });
            setTimeout(() => {
              if (marker) marker.style.display = "none";
            }, 800);
          }
        }
      } catch (e) {
        if (renderId.current === id)
          setError(e instanceof Error ? e.message : "Gagal merender halaman.");
      } finally {
        if (renderId.current === id) setRenderBusy(false);
      }
    })();
    return () => {
      const id = renderId.current;
      renderId.current = id + 1; // batalkan render yang masih berjalan
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [doc, pageNumber, scale]);

  // Gambar ulang highlight setiap ada perubahan match / halaman / zoom.
  useEffect(() => {
    redrawOverlay();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [matches, matchIndex, pageNumber, doc]);

  // Cari teks di seluruh dokumen (index per halaman di-cache).
  useEffect(() => {
    const d = docRef.current;
    if (!d) return;
    const q = query.trim();
    if (!q) {
      setMatches([]);
      setMatchIndex(0);
      matchIndexRef.current = 0;
      return;
    }
    let cancelled = false;
    setSearching(true);
    (async () => {
      try {
        const indexes: PageTextIndex[] = [];
        for (let p = 1; p <= d.numPages; p++) {
          if (cancelled) break;
          let idx = textCache.current.get(p);
          if (!idx) {
            const page = await d.getPage(p);
            const tc = await page.getTextContent();
            const runs: TextRun[] = tc.items
              .filter(
                (it) => typeof (it as { str?: unknown }).str === "string"
              )
              .map((it) => {
                const t = it as {
                  str: string;
                  transform: number[];
                  width: number;
                  height: number;
                };
                return {
                  str: t.str,
                  transform: t.transform,
                  width: t.width,
                  height: t.height,
                };
              });
            idx = indexPageText(p, runs);
            textCache.current.set(p, idx);
          }
          indexes.push(idx);
          if (p % 10 === 0) await yieldToMain();
        }
        if (cancelled) return;
        const found = findMatches(indexes, q);
        setMatches(found);
        setMatchIndex(0);
        matchIndexRef.current = 0;
      } catch (e) {
        if (!cancelled)
          setError(e instanceof Error ? e.message : "Gagal mencari teks.");
      } finally {
        if (!cancelled) setSearching(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [query, doc]);

  const goMatch = (dir: 1 | -1) => {
    if (matches.length === 0) return;
    const next = (matchIndexRef.current + dir + matches.length) % matches.length;
    matchIndexRef.current = next;
    setMatchIndex(next);
    const m = matches[next];
    if (m.page !== pageNumber) goTo(m.page);
    else redrawOverlay();
  };

  const fitWidth = async () => {
    const d = docRef.current;
    const wrap = canvasWrapRef.current;
    if (!d || !wrap) return;
    const page = await d.getPage(pageNumber);
    const vp = page.getViewport({ scale: 1 });
    const avail = wrap.parentElement?.clientWidth ?? 600;
    setScale(Math.min(Math.max((avail - 48) / vp.width, MIN_SCALE), MAX_SCALE));
  };

  const btn =
    "grid h-7 w-7 place-items-center rounded-md text-muted-foreground transition-colors hover:bg-accent hover:text-foreground disabled:opacity-40 disabled:hover:bg-transparent disabled:hover:text-muted-foreground";

  return (
    <div className="flex flex-col gap-3">
      {/* Toolbar */}
      <div className="sticky top-14 z-30 flex flex-wrap items-center gap-x-2 gap-y-1.5 rounded-[10px] border border-border bg-white/95 p-2 shadow-soft backdrop-blur">
        <button
          type="button"
          className={cn(btn, sidebarOpen && "bg-accent text-foreground")}
          onClick={() => setSidebarOpen((o) => !o)}
          title="Daftar halaman"
          aria-label="Daftar halaman"
        >
          <PanelLeft className="h-4 w-4" />
        </button>
        <span className="hidden max-w-44 truncate text-xs font-medium sm:inline">
          {file.name}
        </span>
        <span className="tnum hidden text-xs text-muted-foreground md:inline">
          {total} hal.
        </span>

        <div className="flex items-center gap-1">
          <button
            type="button"
            className={btn}
            onClick={() => goTo(pageNumber - 1)}
            disabled={pageNumber <= 1}
            title="Halaman sebelumnya"
            aria-label="Halaman sebelumnya"
          >
            <ChevronLeft className="h-4 w-4" />
          </button>
          <Input
            type="number"
            min={1}
            max={total}
            value={pageNumber}
            onChange={(e) => goTo(parseInt(e.target.value, 10))}
            className="tnum h-7 w-12 px-1 text-center text-xs"
            aria-label="Nomor halaman"
          />
          <span className="tnum text-xs text-muted-foreground">
            / {total}
          </span>
          <button
            type="button"
            className={btn}
            onClick={() => goTo(pageNumber + 1)}
            disabled={pageNumber >= total}
            title="Halaman berikutnya"
            aria-label="Halaman berikutnya"
          >
            <ChevronRight className="h-4 w-4" />
          </button>
        </div>

        <div className="flex items-center gap-1.5">
          <button
            type="button"
            className={btn}
            onClick={() => setScale((s) => Math.max(s - 0.1, MIN_SCALE))}
            disabled={scale <= MIN_SCALE}
            title="Perkecil"
            aria-label="Perkecil"
          >
            <Minus className="h-4 w-4" />
          </button>
          <Slider
            min={MIN_SCALE}
            max={MAX_SCALE}
            step={0.05}
            value={[scale]}
            onValueChange={([v]) => setScale(v)}
            className="w-24"
            aria-label="Zoom"
          />
          <span className="tnum w-11 text-right text-xs font-semibold text-primary">
            {Math.round(scale * 100)}%
          </span>
          <button
            type="button"
            className={btn}
            onClick={() => setScale((s) => Math.min(s + 0.1, MAX_SCALE))}
            disabled={scale >= MAX_SCALE}
            title="Perbesar"
            aria-label="Perbesar"
          >
            <Plus className="h-4 w-4" />
          </button>
          <button
            type="button"
            className={btn}
            onClick={fitWidth}
            title="Sesuaikan lebar halaman"
            aria-label="Sesuaikan lebar halaman"
          >
            <Maximize className="h-4 w-4" />
          </button>
        </div>

        <div className="ml-auto flex items-center gap-1">
          <div className="relative">
            <Search className="absolute left-2 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
            <Input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Cari teks…"
              className="h-7 w-36 pl-7 text-xs md:w-52"
              aria-label="Cari teks"
            />
          </div>
          {searching && (
            <Loader2 className="h-3.5 w-3.5 animate-spin text-muted-foreground" />
          )}
          {!searching && matches.length > 0 && (
            <span className="tnum text-xs text-muted-foreground">
              {matchIndex + 1}/{matches.length}
            </span>
          )}
          <button
            type="button"
            className={btn}
            onClick={() => goMatch(-1)}
            disabled={matches.length === 0}
            title="Hasil sebelumnya"
            aria-label="Hasil sebelumnya"
          >
            <ChevronUp className="h-4 w-4" />
          </button>
          <button
            type="button"
            className={btn}
            onClick={() => goMatch(1)}
            disabled={matches.length === 0}
            title="Hasil berikutnya"
            aria-label="Hasil berikutnya"
          >
            <ChevronDown className="h-4 w-4" />
          </button>
          <button
            type="button"
            className={btn}
            onClick={onReset}
            title="Ganti file"
            aria-label="Ganti file"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
      </div>

      {error ? (
        <div className="rounded-md border border-destructive/30 bg-destructive/5 px-4 py-3 text-sm text-destructive">
          {error}
        </div>
      ) : (
        <div className="flex h-[calc(100dvh-240px)] min-h-[360px] overflow-hidden rounded-[10px] border border-border bg-white shadow-soft">
          {sidebarOpen && (
            <aside className="hidden w-40 shrink-0 overflow-y-auto border-r border-border p-2 md:block">
              {Array.from({ length: total }, (_, i) => i + 1).map((p) => (
                <button
                  key={p}
                  type="button"
                  onClick={() => goTo(p)}
                  className={cn(
                    "mb-1.5 block w-full overflow-hidden rounded-md border bg-white transition-colors",
                    p === pageNumber
                      ? "border-primary ring-2 ring-primary/60"
                      : "border-border hover:border-primary/50"
                  )}
                >
                  {thumbnails.get(p) ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={thumbnails.get(p)}
                      alt={`Halaman ${p}`}
                      className="w-full"
                    />
                  ) : (
                    <div className="flex h-24 w-full items-center justify-center bg-muted/30">
                      <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
                    </div>
                  )}
                  <span className="tnum block border-t border-border px-1 py-0.5 text-center text-[10px] font-medium text-muted-foreground">
                    {p}
                  </span>
                </button>
              ))}
            </aside>
          )}

          <div
            ref={canvasWrapRef}
            className="relative flex flex-1 items-start justify-center overflow-auto bg-[#EDEDE8] p-4"
          >
            <div className="relative">
              <div
                ref={markerRef}
                className="pointer-events-none absolute hidden rounded-sm ring-2 ring-amber-500/80"
              />
              {renderBusy && (
                <div className="absolute inset-0 flex items-center justify-center bg-white/40">
                  <Loader2 className="h-5 w-5 animate-spin text-primary" />
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
