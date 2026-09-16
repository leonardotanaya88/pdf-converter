"use client";

import { useState } from "react";

import { ToolLayout } from "@/components/shared/ToolLayout";
import { FileDropzone } from "@/components/shared/FileDropzone";
import { ProcessButton } from "@/components/shared/ProcessButton";
import { DownloadResult } from "@/components/shared/DownloadResult";
import { useFileStore } from "@/store/useFileStore";
import { mergePdfs } from "@/lib/pdf/merge";
import { bytesToBlob } from "@/lib/utils/download";

export default function MergePage() {
  const { files, status, error, setStatus, setError } = useFileStore();
  const [result, setResult] = useState<{ name: string; blob: Blob } | null>(null);

  const handleProcess = async () => {
    setResult(null);
    if (files.length < 2) {
      setError("Pilih minimal 2 file PDF.");
      setStatus("error");
      return;
    }
    setStatus("processing");
    setError(null);
    try {
      const bytes = await mergePdfs(files.map((f) => f.file));
      setResult({
        name: "merged.pdf",
        blob: bytesToBlob(bytes, "application/pdf"),
      });
      setStatus("done");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Terjadi kesalahan saat menggabungkan.");
      setStatus("error");
    }
  };

  return (
    <ToolLayout
      title="Gabung PDF"
      description="Gabungkan beberapa PDF menjadi satu file — urutan daftar menentukan urutan hasil."
    >
      <div className="flex flex-col gap-4">
        <FileDropzone
          accept={["application/pdf"]}
          multiple
          sortable
          hint="PDF • maks 200 MB per file"
        />
        <ProcessButton
          label="Gabung PDF"
          onClick={handleProcess}
          loading={status === "processing"}
          disabled={files.length < 2}
          error={error}
        />
        <DownloadResult
          single={result ?? undefined}
          summary={`${files.length} file digabung`}
        />
      </div>
    </ToolLayout>
  );
}
