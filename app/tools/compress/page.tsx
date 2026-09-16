"use client";

import { useState } from "react";

import { ToolLayout } from "@/components/shared/ToolLayout";
import { FileDropzone } from "@/components/shared/FileDropzone";
import { ProcessButton } from "@/components/shared/ProcessButton";
import { DownloadResult } from "@/components/shared/DownloadResult";
import { Label } from "@/components/ui/label";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { useFileStore } from "@/store/useFileStore";
import { callPdfServer } from "@/lib/utils/serverCall";

type CompressQuality = "low" | "medium" | "high";

export default function CompressPage() {
  const { files, status, error, setStatus, setError } = useFileStore();
  const file = files[0]?.file;

  const [quality, setQuality] = useState<CompressQuality>("medium");
  const [result, setResult] = useState<{ name: string; blob: Blob } | null>(null);

  const handleProcess = async () => {
    if (!file) return;
    setResult(null);
    setStatus("processing");
    setError(null);
    try {
      const fd = new FormData();
      fd.append("file", file);
      fd.append("quality", quality);
      const { blob, filename } = await callPdfServer("/api/compress", fd);
      setResult({ name: filename, blob });
      setStatus("done");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Terjadi kesalahan saat kompresi.");
      setStatus("error");
    }
  };

  return (
    <ToolLayout
      title="Kompres PDF"
      description="Kecilkan ukuran file dengan menurunkan resolusi gambar — kualitas sesuai pilihan."
      serverSide
    >
      <div className="flex flex-col gap-4">
        <FileDropzone
          accept={["application/pdf"]}
          multiple={false}
          hint="Satu file PDF • maks 200 MB"
        />

        <div className="flex flex-col gap-3 rounded-[10px] border border-border bg-white p-5 shadow-soft">
          <Label>Kualitas hasil</Label>
          <RadioGroup
            value={quality}
            onValueChange={(v) => setQuality(v as CompressQuality)}
            className="flex gap-6"
          >
            {(
              [
                { v: "low", t: "Rendah — file paling kecil" },
                { v: "medium", t: "Sedang (disarankan)" },
                { v: "high", t: "Tinggi — kualitas hampir asli" },
              ] as const
            ).map((o) => (
              <div key={o.v} className="flex items-center gap-2">
                <RadioGroupItem value={o.v} id={`cq-${o.v}`} />
                <Label htmlFor={`cq-${o.v}`}>{o.t}</Label>
              </div>
            ))}
          </RadioGroup>
          <p className="text-xs text-muted-foreground">
            Hasil kompresi bergantung isi PDF — dokumen yang banyak gambar akan
            menyusut paling besar.
          </p>
        </div>

        <ProcessButton
          label="Kompres"
          onClick={handleProcess}
          loading={status === "processing"}
          disabled={!file}
          error={error}
        />
        <DownloadResult single={result ?? undefined} summary="Kompresi selesai" />
      </div>
    </ToolLayout>
  );
}
