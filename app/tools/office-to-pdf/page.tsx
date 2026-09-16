"use client";

import { useState } from "react";

import { ToolLayout } from "@/components/shared/ToolLayout";
import { FileDropzone } from "@/components/shared/FileDropzone";
import { ProcessButton } from "@/components/shared/ProcessButton";
import { DownloadResult } from "@/components/shared/DownloadResult";
import { useFileStore } from "@/store/useFileStore";
import { callPdfServer } from "@/lib/utils/serverCall";

export default function OfficeToPdfPage() {
  const { files, status, error, setStatus, setError } = useFileStore();
  const file = files[0]?.file;

  const [result, setResult] = useState<{ name: string; blob: Blob } | null>(null);

  const handleProcess = async () => {
    if (!file) return;
    setResult(null);
    setStatus("processing");
    setError(null);
    try {
      const fd = new FormData();
      fd.append("file", file);
      const { blob, filename } = await callPdfServer("/api/office2pdf", fd);
      setResult({ name: filename, blob });
      setStatus("done");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Terjadi kesalahan saat konversi.");
      setStatus("error");
    }
  };

  return (
    <ToolLayout
      title="Office → PDF"
      description="Ubah dokumen Word, Excel, atau PowerPoint menjadi PDF — memakai Microsoft Office di komputer Anda."
      serverSide
    >
      <div className="flex flex-col gap-4">
        <FileDropzone
          accept={[
            "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
            "application/msword",
            "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
            "application/vnd.ms-excel",
            "application/vnd.openxmlformats-officedocument.presentationml.presentation",
            "application/vnd.ms-powerpoint",
            ".docx",
            ".doc",
            ".xlsx",
            ".xls",
            ".pptx",
            ".ppt",
          ]}
          multiple={false}
          maxSizeMB={100}
          hint="Word/Excel/PowerPoint • maks 100 MB"
        />
        <p className="text-xs text-muted-foreground">
          Konversi berjalan di komputer ini melalui Microsoft Office — dokumen
          tidak dikirim ke mana pun. Layout halaman mengikuti aplikasi Office
          masing-masing.
        </p>

        <ProcessButton
          label="Konversi ke PDF"
          onClick={handleProcess}
          loading={status === "processing"}
          disabled={!file}
          error={error}
        />
        <DownloadResult single={result ?? undefined} summary="Konversi selesai" />
      </div>
    </ToolLayout>
  );
}
