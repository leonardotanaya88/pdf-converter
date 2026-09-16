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

export default function ProtectPage() {
  const { files, status, error, setStatus, setError } = useFileStore();
  const file = files[0]?.file;

  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [result, setResult] = useState<{ name: string; blob: Blob } | null>(null);

  const mismatch = confirm.length > 0 && password !== confirm;
  const canProcess = !!file && password.length >= 4 && !mismatch;

  const handleProcess = async () => {
    if (!file) return;
    setResult(null);
    setStatus("processing");
    setError(null);
    try {
      const fd = new FormData();
      fd.append("file", file);
      fd.append("password", password);
      const { blob, filename } = await callPdfServer("/api/protect", fd);
      setResult({ name: filename, blob });
      setStatus("done");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Terjadi kesalahan saat proteksi.");
      setStatus("error");
    }
  };

  return (
    <ToolLayout
      title="Lindungi PDF"
      description="Kunci file dengan kata sandi (enkripsi AES-256) — hanya pemilik kata sandi yang bisa membuka."
      serverSide
    >
      <div className="flex flex-col gap-4">
        <FileDropzone
          accept={["application/pdf"]}
          multiple={false}
          hint="Satu file PDF • maks 200 MB"
        />

        <div className="flex flex-col gap-4 rounded-[10px] border border-border bg-white p-5 shadow-soft">
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="protect-pw">Kata sandi (minimal 4 karakter)</Label>
            <Input
              id="protect-pw"
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="••••••••"
              className="max-w-xs"
            />
          </div>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="protect-confirm">Ulangi kata sandi</Label>
            <Input
              id="protect-confirm"
              type="password"
              value={confirm}
              onChange={(e) => setConfirm(e.target.value)}
              placeholder="••••••••"
              className="max-w-xs"
            />
            {mismatch && (
              <p className="text-xs text-destructive">Kata sandi tidak sama.</p>
            )}
          </div>
        </div>

        <ProcessButton
          label="Lindungi PDF"
          onClick={handleProcess}
          loading={status === "processing"}
          disabled={!canProcess}
          error={error}
        />
        <DownloadResult single={result ?? undefined} summary="File sudah dilindungi" />
      </div>
    </ToolLayout>
  );
}
