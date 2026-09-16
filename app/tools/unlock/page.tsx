"use client";

import { useState } from "react";

import { ToolLayout } from "@/components/shared/ToolLayout";
import { FileDropzone } from "@/components/shared/FileDropzone";
import { ProcessButton } from "@/components/shared/ProcessButton";
import { DownloadResult } from "@/components/shared/DownloadResult";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { useFileStore } from "@/store/useFileStore";
import { callPdfServer } from "@/lib/utils/serverCall";

export default function UnlockPage() {
  const { files, status, error, setStatus, setError } = useFileStore();
  const file = files[0]?.file;

  const [password, setPassword] = useState("");
  const [result, setResult] = useState<{ name: string; blob: Blob } | null>(null);

  const handleProcess = async () => {
    if (!file) return;
    setResult(null);
    setStatus("processing");
    setError(null);
    try {
      const fd = new FormData();
      fd.append("file", file);
      fd.append("password", password);
      const { blob, filename } = await callPdfServer("/api/unlock", fd);
      setResult({ name: filename, blob });
      setStatus("done");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Terjadi kesalahan saat buka kunci.");
      setStatus("error");
    }
  };

  return (
    <ToolLayout
      title="Buka Kunci PDF"
      description="Hapus kata sandi dari file milik Anda (enkripsi akan dihapus dari salinan hasil)."
      serverSide
    >
      <div className="flex flex-col gap-4">
        <FileDropzone
          accept={["application/pdf"]}
          multiple={false}
          hint="Satu file PDF • maks 200 MB"
        />

        <div className="flex flex-col gap-1.5 rounded-[10px] border border-border bg-white p-5 shadow-soft">
          <Label htmlFor="unlock-pw">Kata sandi file</Label>
          <Input
            id="unlock-pw"
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="••••••••"
            className="max-w-xs"
          />
          <p className="text-xs text-muted-foreground">
            Hanya gunakan untuk file yang Anda miliki atau berhak buka (scope §7:
            disclaimer legal).
          </p>
        </div>

        <ProcessButton
          label="Buka kunci"
          onClick={handleProcess}
          loading={status === "processing"}
          disabled={!file || password.length === 0}
          error={error}
        />
        <DownloadResult single={result ?? undefined} summary="Kata sandi dihapus" />
      </div>
    </ToolLayout>
  );
}
