"use client";

import { useState } from "react";

import { ToolLayout } from "@/components/shared/ToolLayout";
import { FileDropzone } from "@/components/shared/FileDropzone";
import { ProcessButton } from "@/components/shared/ProcessButton";
import { DownloadResult } from "@/components/shared/DownloadResult";
import { Label } from "@/components/ui/label";
import { Slider } from "@/components/ui/slider";
import { useFileStore } from "@/store/useFileStore";
import { pdfToJpgs } from "@/lib/pdf/pdfToJpg";
import type { DownloadItem } from "@/components/shared/DownloadResult";

export default function PdfToJpgPage() {
  const { files, status, error, setStatus, setError } = useFileStore();
  const file = files[0]?.file;
  const base = file ? file.name.replace(/\.pdf$/i, "") : "pdf";

  const [quality, setQuality] = useState(0.8);
  const [items, setItems] = useState<DownloadItem[] | null>(null);

  const handleProcess = async () => {
    if (!file) return;
    setItems(null);
    setStatus("processing");
    setError(null);
    try {
      const jpgs = await pdfToJpgs(file, quality);
      setItems(
        jpgs.map((j) => ({ name: j.name, blob: j.blob }))
      );
      setStatus("done");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Terjadi kesalahan saat konversi.");
      setStatus("error");
    }
  };

  return (
    <ToolLayout
      title="PDF → JPG"
      description="Ubah setiap halaman PDF menjadi gambar JPG — beberapa halaman dibungkus ZIP."
    >
      <div className="flex flex-col gap-4">
        <FileDropzone
          accept={["application/pdf"]}
          multiple={false}
          hint="Satu file PDF • maks 200 MB"
        />

        <div className="flex flex-col gap-3 rounded-[10px] border border-border bg-white p-5 shadow-soft">
          <div className="flex items-center justify-between">
            <Label htmlFor="jpg-quality">Kualitas JPG</Label>
            <span className="tnum text-xs font-semibold text-primary">
              {Math.round(quality * 100)}%
            </span>
          </div>
          <Slider
            id="jpg-quality"
            min={0.6}
            max={1}
            step={0.05}
            value={[quality]}
            onValueChange={([v]) => setQuality(v)}
          />
          <p className="text-xs text-muted-foreground">
            Semakin tinggi kualitas, semakin besar ukuran file.
          </p>
        </div>

        <ProcessButton
          label="Konversi ke JPG"
          onClick={handleProcess}
          loading={status === "processing"}
          disabled={!file}
          error={error}
        />
        <DownloadResult
          items={items ?? undefined}
          zipName={`${base}-jpg.zip`}
          summary="Konversi selesai"
        />
      </div>
    </ToolLayout>
  );
}
