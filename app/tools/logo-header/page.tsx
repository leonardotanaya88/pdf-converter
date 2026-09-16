"use client";

import { useEffect, useRef, useState } from "react";
import { Stamp } from "lucide-react";

import { ToolLayout } from "@/components/shared/ToolLayout";
import { FileDropzone } from "@/components/shared/FileDropzone";
import { ProcessButton } from "@/components/shared/ProcessButton";
import { DownloadResult } from "@/components/shared/DownloadResult";
import {
  OverlayPreview,
  type DragTarget,
} from "@/components/shared/OverlayPreview";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Slider } from "@/components/ui/slider";
import { Switch } from "@/components/ui/switch";
import { Checkbox } from "@/components/ui/checkbox";
import { Button } from "@/components/ui/button";
import { useFileStore } from "@/store/useFileStore";
import {
  addLogoHeader,
  computeHeaderLayout,
  clampLogoToFit,
  clampTextToFit,
  HEADER_PADDING,
  TEXT_ASCENT,
  type FreePosition,
} from "@/lib/pdf/logoHeader";
import { parseRanges } from "@/lib/pdf/split";
import { loadPdfDocument } from "@/lib/pdf/preview";
import { cn } from "@/lib/utils";
import { bytesToBlob } from "@/lib/utils/download";

function SectionTitle({ children }: { children: React.ReactNode }) {
  return (
    <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
      {children}
    </p>
  );
}

function clampValue(v: number, min: number, max: number) {
  return Math.min(Math.max(v, min), max);
}

export default function LogoHeaderPage() {
  const { files, status, error, setStatus, setError } = useFileStore();
  const file = files[0]?.file;

  const [result, setResult] = useState<{ name: string; blob: Blob } | null>(null);

  // ── Logo ──
  const [logo, setLogo] = useState<File | null>(null);
  const [logoLoaded, setLogoLoaded] = useState(0);
  const imgRef = useRef<HTMLImageElement | null>(null);
  const [logoHeight, setLogoHeight] = useState(32);
  const [logoOpacity, setLogoOpacity] = useState(1);
  // null = auto (kiri, tengah strip); non-null = posisi drag dalam pt.
  const [logoPos, setLogoPos] = useState<FreePosition | null>(null);

  // ── Teks ──
  const [text, setText] = useState("");
  const [textFontSize, setTextFontSize] = useState(14);
  const [textColor, setTextColor] = useState("#1F2937");
  const [textBold, setTextBold] = useState(false);
  const [textItalic, setTextItalic] = useState(false);
  // null = auto (kanan, tengah strip); non-null = posisi drag (baseline, pt).
  const [textPos, setTextPos] = useState<FreePosition | null>(null);

  // Lebar teks diukur di canvas offscreen (efek), sama dengan draw dulu.
  const [textMetrics, setTextMetrics] = useState<{
    tw: number;
    fontSize: number;
  }>({ tw: 0, fontSize: textFontSize });

  // ── Latar belakang ──
  const [backgroundEnabled, setBackgroundEnabled] = useState(true);
  const [backgroundColor, setBackgroundColor] = useState("#FFFFFF");
  const [backgroundOpacity, setBackgroundOpacity] = useState(1);

  // ── Halaman ──
  const [excludeFirst, setExcludeFirst] = useState(false);
  const [excludeRanges, setExcludeRanges] = useState("");
  const [pageCount, setPageCount] = useState(0);
  // Ukuran halaman 1 (pt) dari preview — basis hit-test drag.
  const [previewDims, setPreviewDims] = useState<{ w: number; h: number } | null>(
    null
  );

  useEffect(() => {
    if (!logo) {
      imgRef.current = null;
      setLogoLoaded(0);
      return;
    }
    const url = URL.createObjectURL(logo);
    const img = new Image();
    img.onload = () => {
      imgRef.current = img;
      setLogoLoaded((n) => n + 1);
    };
    img.src = url;
    return () => URL.revokeObjectURL(url);
  }, [logo]);

  useEffect(() => {
    setPageCount(0);
    setPreviewDims(null);
    if (!file) return;
    let cancelled = false;
    loadPdfDocument(file)
      .then((doc) => {
        if (!cancelled) setPageCount(doc.numPages);
        doc.destroy();
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, [file]);

  const textTrimmed = text.trim();

  // Ukur lebar teks (pt) dengan canvas offscreen; hasilnya dipakai draw
  // DAN hit-test drag sekaligus supaya tidak ada perbedaan.
  useEffect(() => {
    const maxW = previewDims ? previewDims.w - 2 * HEADER_PADDING : 0;
    if (!textTrimmed || maxW <= 0) {
      setTextMetrics({ tw: 0, fontSize: textFontSize });
      return;
    }
    const ctx = document.createElement("canvas").getContext("2d");
    if (!ctx) return;
    ctx.font = `${textItalic ? "italic " : ""}${textBold ? "bold " : ""}${textFontSize}px Inter, sans-serif`;
    const c = clampTextToFit(
      textFontSize,
      ctx.measureText(textTrimmed).width,
      maxW
    );
    setTextMetrics({ tw: c.textWidth, fontSize: c.fontSize });
  }, [textTrimmed, textFontSize, textBold, textItalic, previewDims]);

  /**
   * Nilai efektif (sudah di-clamp) + layout header untuk ukuran halaman
   * tertentu. Satu-satunya sumber kebenaran untuk draw DAN dragTargets.
   */
  const computeEffective = (w: number, h: number) => {
    const img = imgRef.current;
    const hasLogo = !!img && !!logo;
    const hasText = textTrimmed.length > 0;
    if (w <= 0 || (!hasLogo && !hasText)) {
      return {
        hasLogo,
        hasText,
        lw: 0,
        lh: 0,
        fontSize: textFontSize,
        tw: 0,
        layout: null as ReturnType<typeof computeHeaderLayout> | null,
        textRect: null as DragTarget["rect"],
      };
    }
    const maxW = w - 2 * HEADER_PADDING;
    let lw = 0;
    let lh = 0;
    if (hasLogo) {
      lh = logoHeight;
      lw = (lh * img.naturalWidth) / img.naturalHeight;
      ({ logoWidth: lw, logoHeight: lh } = clampLogoToFit(lw, lh, maxW));
    }
    const fontSize = textMetrics.fontSize;
    const tw = textMetrics.tw;
    const layout = computeHeaderLayout({
      pageWidth: w,
      pageHeight: h,
      logoWidth: lw,
      logoHeight: lh,
      textWidth: tw,
      fontSize,
      logoPos,
      textPos,
      hasLogo,
      hasText,
    });
    const textRect: DragTarget["rect"] = layout?.text
      ? {
          x: layout.text.x,
          y: layout.text.y - fontSize,
          width: tw,
          height: fontSize,
        }
      : null;
    return { hasLogo, hasText, lw, lh, fontSize, tw, layout, textRect };
  };

  const eff = computeEffective(previewDims?.w ?? 0, previewDims?.h ?? 0);
  const dragTargets: DragTarget[] = [
    { id: "logo", rect: eff.layout?.logo ?? null },
    { id: "text", rect: eff.textRect },
  ];

  const handleTargetDrag = (id: string, dx: number, dy: number) => {
    const W = previewDims?.w ?? 0;
    const H = previewDims?.h ?? 0;
    if (W <= 0) return;
    if (id === "logo") {
      setLogoPos((prev) => {
        // Materialisasi dari auto → mulai dari posisi efektif saat ini.
        const base =
          prev ??
          eff.layout?.logo ?? { x: HEADER_PADDING, y: 0 };
        return {
          x: clampValue(
            base.x + dx,
            HEADER_PADDING,
            Math.max(HEADER_PADDING, W - eff.lw - HEADER_PADDING)
          ),
          y: clampValue(base.y + dy, 0, H - eff.lh),
        };
      });
    } else if (id === "text") {
      setTextPos((prev) => {
        const base = prev ?? eff.layout?.text ?? { x: HEADER_PADDING, y: 0 };
        return {
          x: clampValue(
            base.x + dx,
            HEADER_PADDING,
            Math.max(HEADER_PADDING, W - eff.tw - HEADER_PADDING)
          ),
          y: clampValue(
            base.y + dy,
            eff.fontSize,
            H - eff.fontSize * TEXT_ASCENT
          ),
        };
      });
    }
  };

  const rangesError =
    pageCount > 0 && excludeRanges.trim()
      ? (() => {
          try {
            parseRanges(excludeRanges, pageCount);
            return null;
          } catch (e) {
            return e instanceof Error ? e.message : "Format rentang tidak valid.";
          }
        })()
      : null;
  const canProcess = !!file && (!!logo || !!textTrimmed) && !rangesError;

  const handleProcess = async () => {
    if (!file) return;
    setResult(null);
    setStatus("processing");
    setError(null);
    try {
      const bytes = await addLogoHeader(file, {
        logo,
        logoHeight,
        logoOpacity,
        logoPos,
        text,
        textFontSize,
        textColor,
        textBold,
        textItalic,
        textPos,
        backgroundEnabled,
        backgroundColor,
        backgroundOpacity,
        excludeFirst,
        excludeRanges,
      });
      setResult({
        name: file.name.replace(/\.pdf$/i, "") + "-logo.pdf",
        blob: bytesToBlob(bytes, "application/pdf"),
      });
      setStatus("done");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Terjadi kesalahan saat menambah header.");
      setStatus("error");
    }
  };

  const draw = (
    ctx: CanvasRenderingContext2D,
    w: number,
    h: number,
    scale: number
  ) => {
    const { hasLogo, hasText, fontSize, layout } = computeEffective(w, h);
    if (!hasLogo && !hasText) return;
    if (!layout) return;
    ctx.save();

    if (backgroundEnabled) {
      ctx.globalAlpha = backgroundOpacity;
      ctx.fillStyle = backgroundColor;
      ctx.fillRect(
        0,
        (h - layout.stripY - layout.stripHeight) * scale,
        layout.stripWidth * scale,
        layout.stripHeight * scale
      );
      ctx.globalAlpha = 1;
    }
    if (hasLogo && layout.logo) {
      ctx.globalAlpha = logoOpacity;
      ctx.drawImage(
        imgRef.current!,
        layout.logo.x * scale,
        (h - layout.logo.y - layout.logo.height) * scale,
        layout.logo.width * scale,
        layout.logo.height * scale
      );
      ctx.globalAlpha = 1;
    }
    if (hasText && layout.text) {
      ctx.fillStyle = textColor;
      ctx.font = `${textItalic ? "italic " : ""}${textBold ? "bold " : ""}${fontSize}px Inter, sans-serif`;
      ctx.textBaseline = "alphabetic";
      ctx.fillText(textTrimmed, layout.text.x * scale, (h - layout.text.y) * scale);
    }
    ctx.restore();
  };

  return (
    <ToolLayout
      title="Tambah Logo & Header"
      description="Tambahkan logo, teks, dan strip warna di halaman — seret logo/teks di pratinjau untuk mengatur posisinya."
    >
      <div className="flex flex-col gap-4">
        <FileDropzone
          accept={["application/pdf"]}
          multiple={false}
          hint="Satu file PDF • maks 200 MB"
        />

        {file && (
          <div className="flex flex-col gap-6 rounded-[10px] border border-border bg-white p-5 shadow-soft md:flex-row">
            <div className="flex flex-1 flex-col gap-5">
              {/* ── Logo ── */}
              <div className="flex flex-col gap-3">
                <SectionTitle>Logo</SectionTitle>
                <label
                  className={cn(
                    "flex cursor-pointer flex-col items-center justify-center gap-2 rounded-lg border-2 border-dashed px-4 py-4 text-center transition-colors",
                    logo
                      ? "border-primary bg-accent/50"
                      : "border-border hover:border-primary/60 hover:bg-accent/40"
                  )}
                >
                  <Stamp className="h-6 w-6 text-primary" />
                  <span className="text-xs font-medium text-foreground">
                    {logo ? logo.name : "Pilih logo JPG/PNG"}
                  </span>
                  <input
                    type="file"
                    accept="image/jpeg,image/png"
                    className="hidden"
                    onChange={(e) => {
                      const f = e.target.files?.[0];
                      if (f) setLogo(f);
                      e.target.value = "";
                    }}
                  />
                </label>
                <div className="flex flex-col gap-3">
                  <div className="flex items-center justify-between">
                    <Label htmlFor="lh-height">Tinggi logo</Label>
                    <span className="tnum text-xs font-semibold text-primary">
                      {logoHeight} pt
                    </span>
                  </div>
                  <Slider
                    id="lh-height"
                    min={8}
                    max={120}
                    step={2}
                    value={[logoHeight]}
                    onValueChange={([v]) => setLogoHeight(v)}
                  />
                </div>
                <div className="flex flex-col gap-3">
                  <div className="flex items-center justify-between">
                    <Label htmlFor="lh-logo-opacity">Transparansi</Label>
                    <span className="tnum text-xs font-semibold text-primary">
                      {Math.round(logoOpacity * 100)}%
                    </span>
                  </div>
                  <Slider
                    id="lh-logo-opacity"
                    min={0.05}
                    max={1}
                    step={0.05}
                    value={[logoOpacity]}
                    onValueChange={([v]) => setLogoOpacity(v)}
                  />
                </div>
              </div>

              {/* ── Teks ── */}
              <div className="flex flex-col gap-3 border-t border-border pt-5">
                <SectionTitle>Teks</SectionTitle>
                <div className="flex flex-col gap-1.5">
                  <Label htmlFor="lh-text">Teks header</Label>
                  <Input
                    id="lh-text"
                    value={text}
                    onChange={(e) => setText(e.target.value)}
                    placeholder="Nama perusahaan"
                    className="max-w-xs"
                  />
                </div>
                <div className="flex flex-col gap-3">
                  <div className="flex items-center justify-between">
                    <Label htmlFor="lh-fontsize">Ukuran huruf</Label>
                    <span className="tnum text-xs font-semibold text-primary">
                      {textFontSize} pt
                    </span>
                  </div>
                  <Slider
                    id="lh-fontsize"
                    min={6}
                    max={48}
                    step={1}
                    value={[textFontSize]}
                    onValueChange={([v]) => setTextFontSize(v)}
                  />
                </div>
                <div className="flex items-center gap-3">
                  <Label htmlFor="lh-color">Warna</Label>
                  <Input
                    id="lh-color"
                    type="color"
                    value={textColor}
                    onChange={(e) => setTextColor(e.target.value)}
                    className="h-9 w-16 cursor-pointer p-1"
                  />
                </div>
                <div className="flex items-center gap-6">
                  <div className="flex items-center gap-2">
                    <Switch
                      id="lh-bold"
                      checked={textBold}
                      onCheckedChange={setTextBold}
                    />
                    <Label htmlFor="lh-bold">Tebal</Label>
                  </div>
                  <div className="flex items-center gap-2">
                    <Switch
                      id="lh-italic"
                      checked={textItalic}
                      onCheckedChange={setTextItalic}
                    />
                    <Label htmlFor="lh-italic">Miring</Label>
                  </div>
                </div>
              </div>

              {/* ── Latar belakang ── */}
              <div className="flex flex-col gap-3 border-t border-border pt-5">
                <SectionTitle>Latar belakang</SectionTitle>
                <div className="flex items-center gap-2">
                  <Switch
                    id="lh-bg"
                    checked={backgroundEnabled}
                    onCheckedChange={setBackgroundEnabled}
                  />
                  <Label htmlFor="lh-bg">Aktifkan strip latar belakang</Label>
                </div>
                {backgroundEnabled && (
                  <>
                    <div className="flex items-center gap-3">
                      <Label htmlFor="lh-bg-color">Warna strip</Label>
                      <Input
                        id="lh-bg-color"
                        type="color"
                        value={backgroundColor}
                        onChange={(e) => setBackgroundColor(e.target.value)}
                        className="h-9 w-16 cursor-pointer p-1"
                      />
                    </div>
                    <div className="flex flex-col gap-3">
                      <div className="flex items-center justify-between">
                        <Label htmlFor="lh-bg-opacity">Transparansi</Label>
                        <span className="tnum text-xs font-semibold text-primary">
                          {Math.round(backgroundOpacity * 100)}%
                        </span>
                      </div>
                      <Slider
                        id="lh-bg-opacity"
                        min={0.05}
                        max={1}
                        step={0.05}
                        value={[backgroundOpacity]}
                        onValueChange={([v]) => setBackgroundOpacity(v)}
                      />
                    </div>
                  </>
                )}
              </div>

              {/* ── Halaman ── */}
              <div className="flex flex-col gap-3 border-t border-border pt-5">
                <SectionTitle>Halaman</SectionTitle>
                <div className="flex items-center gap-2">
                  <Checkbox
                    id="lh-excl-first"
                    checked={excludeFirst}
                    onCheckedChange={(v) => setExcludeFirst(v === true)}
                  />
                  <Label htmlFor="lh-excl-first">Kecuali halaman 1</Label>
                </div>
                <div className="flex flex-col gap-1.5">
                  <Label htmlFor="lh-excl-ranges">Kecualikan halaman</Label>
                  <Input
                    id="lh-excl-ranges"
                    value={excludeRanges}
                    onChange={(e) => setExcludeRanges(e.target.value)}
                    placeholder="Contoh: 1-3,5"
                    className="max-w-xs"
                  />
                  <p className="text-xs text-muted-foreground">
                    Kosongkan untuk semua halaman. Pisahkan dengan koma.
                  </p>
                  {rangesError && (
                    <p className="text-xs text-destructive">{rangesError}</p>
                  )}
                </div>
              </div>
            </div>

            <div className="flex flex-col gap-3 md:w-80">
              <div className="flex flex-col gap-2 rounded-lg border border-dashed border-border p-3">
                <p className="text-xs text-muted-foreground">
                  Seret logo atau teks langsung di pratinjau untuk mengubah
                  posisi. Berlaku untuk semua halaman (disesuaikan otomatis
                  kalau ukuran halaman berbeda).
                </p>
                <div>
                  <Button
                    variant="outline"
                    size="sm"
                    disabled={!logoPos && !textPos}
                    onClick={() => {
                      setLogoPos(null);
                      setTextPos(null);
                    }}
                  >
                    Reset posisi
                  </Button>
                </div>
              </div>
              <OverlayPreview
                file={file}
                drawDeps={[
                  logo,
                  logoLoaded,
                  logoHeight,
                  logoOpacity,
                  logoPos,
                  text,
                  textFontSize,
                  textColor,
                  textBold,
                  textItalic,
                  textPos,
                  textMetrics,
                  backgroundEnabled,
                  backgroundColor,
                  backgroundOpacity,
                ]}
                draw={draw}
                dragTargets={dragTargets}
                onTargetDrag={handleTargetDrag}
                onPageDims={(w, h) => setPreviewDims({ w, h })}
              />
            </div>
          </div>
        )}

        <ProcessButton
          label="Tambahkan logo & header"
          onClick={handleProcess}
          loading={status === "processing"}
          disabled={!canProcess}
          error={error}
        />
        <DownloadResult
          single={result ?? undefined}
          summary="Logo & header ditambahkan"
        />
      </div>
    </ToolLayout>
  );
}
