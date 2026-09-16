"use client";

import { useEffect, useState } from "react";
import { RotateCw } from "lucide-react";

import { ToolLayout } from "@/components/shared/ToolLayout";
import { FileDropzone } from "@/components/shared/FileDropzone";
import { ProcessButton } from "@/components/shared/ProcessButton";
import { DownloadResult } from "@/components/shared/DownloadResult";
import { PagePreviewGrid } from "@/components/shared/PagePreviewGrid";
import { Label } from "@/components/ui/label";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Button } from "@/components/ui/button";
import { useFileStore } from "@/store/useFileStore";
import { rotatePdf, type Rotation } from "@/lib/pdf/rotate";
import { loadPdfDocument } from "@/lib/pdf/preview";
import { bytesToBlob } from "@/lib/utils/download";

type Direction = "90" | "180" | "270";

export default function RotatePage() {
  const { files, status, error, setStatus, setError } = useFileStore();
  const file = files[0]?.file;

  const [total, setTotal] = useState(0);
  /** page (1-indexed) → total delta rotasi (90/180/270). */
  const [rotations, setRotations] = useState<Record<number, number>>({});
  const [direction, setDirection] = useState<Direction>("90");
  const [result, setResult] = useState<{ name: string; blob: Blob } | null>(null);

  // Reset saat file berganti; ambil jumlah halaman untuk "putar semua".
  useEffect(() => {
    setRotations({});
    setTotal(0);
    if (!file) return;
    let cancelled = false;
    loadPdfDocument(file)
      .then((doc) => {
        if (!cancelled) setTotal(doc.numPages);
        doc.destroy();
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, [file]);

  const rotateOne = (page: number) =>
    setRotations((r) => ({
      ...r,
      [page]: ((r[page] ?? 0) + 90) % 360,
    }));

  const rotateAll = () => {
    const delta = parseInt(direction, 10);
    const all: Record<number, number> = {};
    for (let p = 1; p <= total; p++) all[p] = (all[p] ?? 0) + delta;
    setRotations((r) => {
      const merged = { ...r };
      Object.keys(all).forEach((k) => {
        const p = Number(k);
        merged[p] = (merged[p] ?? 0) + delta;
      });
      return merged;
    });
  };

  const handleProcess = async () => {
    if (!file) return;
    setResult(null);
    setStatus("processing");
    setError(null);
    try {
      const entries = Object.entries(rotations)
        .filter(([, delta]) => delta % 360 !== 0)
        .map(([page, delta]) => ({
          page: Number(page),
          delta: delta as Rotation,
        }));
      const bytes = await rotatePdf(file, entries);
      setResult({
        name: file.name.replace(/\.pdf$/i, "") + "-rotated.pdf",
        blob: bytesToBlob(bytes, "application/pdf"),
      });
      setStatus("done");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Terjadi kesalahan saat memutar.");
      setStatus("error");
    }
  };

  return (
    <ToolLayout
      title="Putar PDF"
      description="Rotasi halaman 90°, 180°, atau 270° — per halaman atau sekaligus."
    >
      <div className="flex flex-col gap-4">
        <FileDropzone
          accept={["application/pdf"]}
          multiple={false}
          hint="Satu file PDF • maks 200 MB"
        />

        {file && total > 0 && (
          <div className="flex flex-wrap items-end gap-4 rounded-[10px] border border-border bg-white p-5 shadow-soft">
            <div className="flex flex-col gap-2">
              <Label>Putar semua halaman</Label>
              <RadioGroup
                value={direction}
                onValueChange={(v) => setDirection(v as Direction)}
                className="flex gap-4"
              >
                {(["90", "180", "270"] as Direction[]).map((d) => (
                  <div key={d} className="flex items-center gap-1.5">
                    <RadioGroupItem value={d} id={`dir-${d}`} />
                    <Label htmlFor={`dir-${d}`}>{d}°</Label>
                  </div>
                ))}
              </RadioGroup>
            </div>
            <Button variant="outline" onClick={rotateAll}>
              <RotateCw className="h-4 w-4" />
              Putar semua {direction}°
            </Button>
            <p className="w-full text-xs text-muted-foreground">
              Klik tombol putar pada setiap halaman untuk rotasi individual.
            </p>
          </div>
        )}

        <PagePreviewGrid
          file={file!}
          pageActions={(page) => (
            <button
              onClick={() => rotateOne(page)}
              aria-label={`Putar halaman ${page} 90°`}
              className="rounded p-1 text-muted-foreground transition-colors hover:bg-accent hover:text-accent-foreground"
            >
              <RotateCw className="h-3.5 w-3.5" />
            </button>
          )}
        />

        <ProcessButton
          label="Putar & simpan"
          onClick={handleProcess}
          loading={status === "processing"}
          disabled={!file}
          error={error}
        />
        <DownloadResult single={result ?? undefined} summary="Rotasi diterapkan" />
      </div>
    </ToolLayout>
  );
}
