"use client";

import { useEffect, useState } from "react";

import { ToolLayout } from "@/components/shared/ToolLayout";
import { FileDropzone } from "@/components/shared/FileDropzone";
import { ProcessButton } from "@/components/shared/ProcessButton";
import { DownloadResult } from "@/components/shared/DownloadResult";
import { OverlayPreview } from "@/components/shared/OverlayPreview";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Slider } from "@/components/ui/slider";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { useFileStore } from "@/store/useFileStore";
import {
  addPageNumbers,
  getPageNumberPosition,
  getPageNumberText,
  type PageNumberFormat,
  type PageNumberPosition,
} from "@/lib/pdf/pageNumbers";
import { loadPdfDocument } from "@/lib/pdf/preview";
import { cn } from "@/lib/utils";
import { bytesToBlob } from "@/lib/utils/download";

const POSITIONS: { value: PageNumberPosition; label: string }[] = [
  { value: "top-left", label: "Kiri" },
  { value: "top-center", label: "Tengah" },
  { value: "top-right", label: "Kanan" },
  { value: "middle-left", label: "Kiri" },
  { value: "middle-center", label: "Tengah" },
  { value: "middle-right", label: "Kanan" },
  { value: "bottom-left", label: "Kiri" },
  { value: "bottom-center", label: "Tengah" },
  { value: "bottom-right", label: "Kanan" },
];

const POSITION_ROW: Record<string, string> = {
  top: "Atas",
  middle: "Tengah",
  bottom: "Bawah",
};

export default function PageNumbersPage() {
  const { files, status, error, setStatus, setError } = useFileStore();
  const file = files[0]?.file;

  const [position, setPosition] = useState<PageNumberPosition>("bottom-center");
  const [format, setFormat] = useState<PageNumberFormat>("number");
  const [fontSize, setFontSize] = useState(14);
  const [margin, setMargin] = useState(24);
  const [startAt, setStartAt] = useState(1);
  const [pageCount, setPageCount] = useState(0);
  const [result, setResult] = useState<{ name: string; blob: Blob } | null>(null);

  useEffect(() => {
    setPageCount(0);
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

  const handleProcess = async () => {
    if (!file) return;
    setResult(null);
    setStatus("processing");
    setError(null);
    try {
      const bytes = await addPageNumbers(file, {
        position,
        format,
        fontSize,
        margin,
        startAt,
      });
      setResult({
        name: file.name.replace(/\.pdf$/i, "") + "-numbered.pdf",
        blob: bytesToBlob(bytes, "application/pdf"),
      });
      setStatus("done");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Terjadi kesalahan saat menambah nomor.");
      setStatus("error");
    }
  };

  return (
    <ToolLayout
      title="Nomor Halaman"
      description="Tambahkan nomor halaman di posisi mana pun, dengan preview langsung."
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
              <div className="flex flex-col gap-2">
                <Label>Posisi nomor</Label>
                <RadioGroup
                  value={position}
                  onValueChange={(v) => setPosition(v as PageNumberPosition)}
                >
                  {(["top", "middle", "bottom"] as const).map((row) => (
                    <div key={row} className="grid grid-cols-3 gap-2">
                      {POSITIONS.filter((p) => p.value.startsWith(row)).map(
                        (p) => (
                          <RadioGroupItem
                            key={p.value}
                            value={p.value}
                            id={`pos-${p.value}`}
                            className={cn(
                              "h-auto w-full rounded-md border px-2 py-1.5 text-center text-xs font-medium transition-colors",
                              position === p.value
                                ? "border-primary bg-accent text-accent-foreground"
                                : "border-border text-muted-foreground"
                            )}
                          >
                            {POSITION_ROW[row]}
                          </RadioGroupItem>
                        )
                      )}
                    </div>
                  ))}
                </RadioGroup>
              </div>

              <div className="flex flex-col gap-2">
                <Label>Format</Label>
                <RadioGroup
                  value={format}
                  onValueChange={(v) => setFormat(v as PageNumberFormat)}
                  className="flex gap-4"
                >
                  {(
                    [
                      { v: "number", t: "1" },
                      { v: "page-n", t: "Page 1" },
                      { v: "n-of-n", t: "1 of 10" },
                    ] as const
                  ).map((o) => (
                    <div key={o.v} className="flex items-center gap-2">
                      <RadioGroupItem value={o.v} id={`fmt-${o.v}`} />
                      <Label htmlFor={`fmt-${o.v}`}>{o.t}</Label>
                    </div>
                  ))}
                </RadioGroup>
              </div>

              <div className="flex flex-col gap-3">
                <div className="flex items-center justify-between">
                  <Label htmlFor="fontsize">Ukuran huruf</Label>
                  <span className="tnum text-xs font-semibold text-primary">
                    {fontSize} pt
                  </span>
                </div>
                <Slider
                  id="fontsize"
                  min={8}
                  max={48}
                  step={1}
                  value={[fontSize]}
                  onValueChange={([v]) => setFontSize(v)}
                />
              </div>

              <div className="flex flex-col gap-3">
                <div className="flex items-center justify-between">
                  <Label htmlFor="margin">Jarak dari tepi</Label>
                  <span className="tnum text-xs font-semibold text-primary">
                    {margin} pt
                  </span>
                </div>
                <Slider
                  id="margin"
                  min={8}
                  max={60}
                  step={1}
                  value={[margin]}
                  onValueChange={([v]) => setMargin(v)}
                />
              </div>

              <div className="flex flex-col gap-1.5">
                <Label htmlFor="startat">Mulai dari angka</Label>
                <Input
                  id="startat"
                  type="number"
                  min={1}
                  value={startAt}
                  onChange={(e) => setStartAt(Math.max(1, Number(e.target.value) || 1))}
                  className="max-w-[120px]"
                />
              </div>
            </div>

            <div className="flex flex-col gap-3 md:w-80">
              <OverlayPreview
                file={file}
                drawDeps={[position, format, fontSize, margin, startAt, pageCount]}
                draw={(ctx, w, h, scale) => {
                  if (!pageCount) return;
                  const text = getPageNumberText(0, pageCount, format, startAt);
                  ctx.font = `${fontSize}px Inter, sans-serif`;
                  const textWidthPt = ctx.measureText(text).width / scale;
                  const { x, y } = getPageNumberPosition(
                    w,
                    h,
                    textWidthPt,
                    fontSize,
                    position,
                    margin
                  );
                  ctx.fillStyle = "#1a1a1a";
                  ctx.textBaseline = "alphabetic";
                  ctx.fillText(text, x * scale, (h - y) * scale);
                }}
              />
            </div>
          </div>
        )}

        <ProcessButton
          label="Tambahkan nomor halaman"
          onClick={handleProcess}
          loading={status === "processing"}
          disabled={!file}
          error={error}
        />
        <DownloadResult
          single={result ?? undefined}
          summary="Nomor halaman ditambahkan"
        />
      </div>
    </ToolLayout>
  );
}
