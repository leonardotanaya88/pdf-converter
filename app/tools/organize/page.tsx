"use client";

import { useState } from "react";

import { ToolLayout } from "@/components/shared/ToolLayout";
import { FileDropzone } from "@/components/shared/FileDropzone";
import { ProcessButton } from "@/components/shared/ProcessButton";
import { DownloadResult } from "@/components/shared/DownloadResult";
import { PagePreviewGrid } from "@/components/shared/PagePreviewGrid";
import { useFileStore } from "@/store/useFileStore";
import { organizePdf } from "@/lib/pdf/organize";
import { bytesToBlob } from "@/lib/utils/download";

export default function OrganizePage() {
  const { files, status, error, setStatus, setError } = useFileStore();
  const file = files[0]?.file;

  const [order, setOrder] = useState<number[]>([]);
  const [result, setResult] = useState<{ name: string; blob: Blob } | null>(null);

  const handleProcess = async () => {
    if (!file) return;
    setResult(null);
    setStatus("processing");
    setError(null);
    try {
      const bytes = await organizePdf(file, order);
      setResult({
        name: file.name.replace(/\.pdf$/i, "") + "-organize.pdf",
        blob: bytesToBlob(bytes, "application/pdf"),
      });
      setStatus("done");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Terjadi kesalahan saat menyusun.");
      setStatus("error");
    }
  };

  return (
    <ToolLayout
      title="Atur Halaman"
      description="Susun ulang urutan halaman dengan drag, hapus halaman yang tidak perlu."
    >
      <div className="flex flex-col gap-4">
        <FileDropzone
          accept={["application/pdf"]}
          multiple={false}
          hint="Satu file PDF • maks 200 MB"
        />

        <PagePreviewGrid
          file={file!}
          sortable
          deletable
          onOrderChange={setOrder}
        />

        <ProcessButton
          label="Simpan hasil susunan"
          onClick={handleProcess}
          loading={status === "processing"}
          disabled={!file || order.length === 0}
          error={error}
        />
        <DownloadResult
          single={result ?? undefined}
          summary={`${order.length} halaman disimpan`}
        />
      </div>
    </ToolLayout>
  );
}
