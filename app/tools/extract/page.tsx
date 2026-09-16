"use client";

import { useState } from "react";

import { ToolLayout } from "@/components/shared/ToolLayout";
import { FileDropzone } from "@/components/shared/FileDropzone";
import { ProcessButton } from "@/components/shared/ProcessButton";
import { DownloadResult } from "@/components/shared/DownloadResult";
import { PagePreviewGrid } from "@/components/shared/PagePreviewGrid";
import { useFileStore } from "@/store/useFileStore";
import { extractPages } from "@/lib/pdf/split";
import { bytesToBlob } from "@/lib/utils/download";

export default function ExtractPage() {
  const { files, status, error, setStatus, setError } = useFileStore();
  const file = files[0]?.file;

  const [selected, setSelected] = useState<number[]>([]);
  const [result, setResult] = useState<{ name: string; blob: Blob } | null>(null);

  const handleProcess = async () => {
    if (!file) return;
    setResult(null);
    setStatus("processing");
    setError(null);
    try {
      const bytes = await extractPages(file, selected);
      setResult({
        name: file.name.replace(/\.pdf$/i, "") + "-extract.pdf",
        blob: bytesToBlob(bytes, "application/pdf"),
      });
      setStatus("done");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Terjadi kesalahan saat ekstrak.");
      setStatus("error");
    }
  };

  return (
    <ToolLayout
      title="Ekstrak Halaman"
      description="Pilih halaman yang diinginkan, jadikan satu PDF baru."
    >
      <div className="flex flex-col gap-4">
        <FileDropzone
          accept={["application/pdf"]}
          multiple={false}
          hint="Satu file PDF • maks 200 MB"
        />

        <PagePreviewGrid
          file={file!}
          selectable
          onSelectionChange={setSelected}
        />

        <ProcessButton
          label="Ekstrak halaman terpilih"
          onClick={handleProcess}
          loading={status === "processing"}
          disabled={!file || selected.length === 0}
          error={error}
        />
        <DownloadResult
          single={result ?? undefined}
          summary={`${selected.length} halaman diekstrak`}
        />
      </div>
    </ToolLayout>
  );
}
