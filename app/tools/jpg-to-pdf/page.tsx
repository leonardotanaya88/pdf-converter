"use client";

import { useState } from "react";

import { ToolLayout } from "@/components/shared/ToolLayout";
import { FileDropzone } from "@/components/shared/FileDropzone";
import { ProcessButton } from "@/components/shared/ProcessButton";
import { DownloadResult } from "@/components/shared/DownloadResult";
import { Label } from "@/components/ui/label";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Switch } from "@/components/ui/switch";
import { useFileStore } from "@/store/useFileStore";
import { jpgsToPdf, type JpgToPdfPageSize } from "@/lib/pdf/jpgToPdf";
import { bytesToBlob } from "@/lib/utils/download";

export default function JpgToPdfPage() {
  const { files, status, error, setStatus, setError } = useFileStore();
  const [pageSize, setPageSize] = useState<JpgToPdfPageSize>("a4");
  const [landscape, setLandscape] = useState(false);
  const [result, setResult] = useState<{ name: string; blob: Blob } | null>(null);

  const base = files[0]?.file.name.replace(/\.[^.]+$/, "") ?? "gambar";

  const handleProcess = async () => {
    setResult(null);
    setStatus("processing");
    setError(null);
    try {
      const bytes = await jpgsToPdf(
        files.map((f) => f.file),
        { pageSize, landscape }
      );
      setResult({
        name: `${base}-to-pdf.pdf`,
        blob: bytesToBlob(bytes, "application/pdf"),
      });
      setStatus("done");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Terjadi kesalahan saat konversi.");
      setStatus("error");
    }
  };

  return (
    <ToolLayout
      title="JPG → PDF"
      description="Gabungkan gambar JPG/PNG menjadi satu PDF — satu gambar per halaman."
    >
      <div className="flex flex-col gap-4">
        <FileDropzone
          accept={["image/jpeg", "image/png"]}
          multiple
          sortable
          maxSizeMB={50}
          hint="JPG/PNG • maks 50 MB per gambar"
        />

        {files.length > 0 && (
          <div className="flex flex-wrap items-center gap-x-8 gap-y-4 rounded-[10px] border border-border bg-white p-5 shadow-soft">
            <RadioGroup
              value={pageSize}
              onValueChange={(v) => setPageSize(v as JpgToPdfPageSize)}
              className="flex gap-6"
            >
              <div className="flex items-center gap-2">
                <RadioGroupItem value="a4" id="size-a4" />
                <Label htmlFor="size-a4">Halaman A4 (gambar disesuaikan)</Label>
              </div>
              <div className="flex items-center gap-2">
                <RadioGroupItem value="fit" id="size-fit" />
                <Label htmlFor="size-fit">Sesuai ukuran gambar</Label>
              </div>
            </RadioGroup>

            {pageSize === "a4" && (
              <div className="flex items-center gap-2">
                <Switch
                  id="landscape"
                  checked={landscape}
                  onCheckedChange={setLandscape}
                />
                <Label htmlFor="landscape">Lanskap</Label>
              </div>
            )}
          </div>
        )}

        <ProcessButton
          label="Buat PDF"
          onClick={handleProcess}
          loading={status === "processing"}
          disabled={files.length === 0}
          error={error}
        />
        <DownloadResult
          single={result ?? undefined}
          summary={`${files.length} gambar → PDF`}
        />
      </div>
    </ToolLayout>
  );
}
