"use client";

import { Suspense, useEffect } from "react";
import { useSearchParams } from "next/navigation";

import { FileDropzone } from "@/components/shared/FileDropzone";
import { PdfReader } from "@/components/shared/PdfReader";
import { ToolLayout } from "@/components/shared/ToolLayout";
import { useFileStore } from "@/store/useFileStore";

function ReadView() {
  const { files, clearFiles, addFiles } = useFileStore();
  const file = files[0];
  const searchParams = useSearchParams();

  // Desktop: file dibuka dari OS (double-click / "Open with" / menu Buka PDF)
  // → path dikirim via ?file= → baca lewat IPC lalu masukkan ke store.
  useEffect(() => {
    const filePath = searchParams.get("file");
    const api = window.desktop;
    if (!filePath || !api) return;
    let stale = false;
    api
      .readFile(filePath)
      .then(({ data, name }) => {
        if (stale) return;
        // addFiles menerima File[] (id dibuat store).
        addFiles([new File([data], name, { type: "application/pdf" })], true);
      })
      .catch(() => {
        // Gagal dibaca — dropzone tetap tampil, user bisa pilih manual.
      });
    return () => {
      stale = true;
    };
  }, [searchParams, addFiles]);

  return (
    <ToolLayout
      title="Baca PDF"
      description="Baca dokumen langsung di browser — navigasi halaman, zoom, dan cari teks."
      wide
    >
      {file ? (
        <PdfReader
          key={file.id}
          file={file.file}
          onReset={clearFiles}
        />
      ) : (
        <FileDropzone
          accept={["application/pdf"]}
          multiple={false}
          hint="PDF • langsung tampil tanpa proses"
        />
      )}
    </ToolLayout>
  );
}

export default function ReadPage() {
  return (
    <Suspense fallback={null}>
      <ReadView />
    </Suspense>
  );
}
