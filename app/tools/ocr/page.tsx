"use client";

import { useState } from "react";
import { Copy, Download } from "lucide-react";

import { ToolLayout } from "@/components/shared/ToolLayout";
import { FileDropzone } from "@/components/shared/FileDropzone";
import { ProcessButton } from "@/components/shared/ProcessButton";
import { DownloadResult } from "@/components/shared/DownloadResult";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { useFileStore } from "@/store/useFileStore";
import { callPdfServer, callPdfServerJson } from "@/lib/utils/serverCall";
import { downloadBlob } from "@/lib/utils/download";

type OcrMode = "searchable" | "text";

export default function OcrPage() {
  const { files, status, error, setStatus, setError } = useFileStore();
  const file = files[0]?.file;

  const [mode, setMode] = useState<OcrMode>("searchable");
  const [result, setResult] = useState<{ name: string; blob: Blob } | null>(null);
  const [pages, setPages] = useState<string[] | null>(null);
  const [copied, setCopied] = useState(false);

  const handleProcess = async () => {
    if (!file) return;
    setResult(null);
    setPages(null);
    setStatus("processing");
    setError(null);
    try {
      const fd = new FormData();
      fd.append("file", file);
      fd.append("mode", mode);
      if (mode === "searchable") {
        const { blob, filename } = await callPdfServer("/api/ocr", fd);
        setResult({ name: filename, blob });
      } else {
        const json = (await callPdfServerJson("/api/ocr", fd)) as { pages: string[] };
        setPages(json.pages);
      }
      setStatus("done");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Terjadi kesalahan saat OCR.");
      setStatus("error");
    }
  };

  const copyAll = async () => {
    if (!pages) return;
    await navigator.clipboard.writeText(pages.join("\n\n"));
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const downloadTxt = () => {
    if (!pages) return;
    const text = pages
      .map((p, i) => `--- Halaman ${i + 1} ---\n${p}`)
      .join("\n\n");
    downloadBlob(new Blob([text], { type: "text/plain;charset=utf-8" }), "ocr-text.txt");
  };

  return (
    <ToolLayout
      title="OCR PDF"
      description="Baca teks dari dokumen scan: jadikan PDF yang bisa dicari, atau ekstrak teksnya."
      serverSide
    >
      <div className="flex flex-col gap-4">
        <FileDropzone
          accept={["application/pdf"]}
          multiple={false}
          hint="Satu file PDF (scan) • maks 200 MB"
        />

        <div className="flex flex-col gap-3 rounded-[10px] border border-border bg-white p-5 shadow-soft">
          <Label>Mode hasil</Label>
          <RadioGroup
            value={mode}
            onValueChange={(v) => setMode(v as OcrMode)}
            className="flex flex-col gap-3 sm:flex-row sm:gap-6"
          >
            <div className="flex items-center gap-2">
              <RadioGroupItem value="searchable" id="ocr-searchable" />
              <Label htmlFor="ocr-searchable">
                PDF bisa dicari — teks tersembunyi di atas halaman gambar
              </Label>
            </div>
            <div className="flex items-center gap-2">
              <RadioGroupItem value="text" id="ocr-text" />
              <Label htmlFor="ocr-text">Ekstrak teks saja (TXT)</Label>
            </div>
          </RadioGroup>
          <p className="text-xs text-muted-foreground">
            Catatan jujur: halaman PDF hasil mode &quot;bisa dicari&quot; menjadi
            gambar (ukuran lebih besar), dan akurasi OCR bergantung kualitas
            scan. Mesin OCR lokal (PaddleOCR-v3 via ONNX) — teks Latin
            termasuk Indonesia. Proses pertama kali lebih lambat (model
            dimuat).
          </p>
        </div>

        <ProcessButton
          label="Jalankan OCR"
          onClick={handleProcess}
          loading={status === "processing"}
          disabled={!file}
          error={error}
        />

        {pages && (
          <div className="flex flex-col gap-3 rounded-[10px] border border-border bg-white p-5 shadow-soft">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <p className="text-sm font-semibold">
                Teks terdeteksi — {pages.length} halaman
              </p>
              <div className="flex gap-2">
                <Button variant="outline" size="sm" onClick={copyAll}>
                  <Copy className="h-3.5 w-3.5" />
                  {copied ? "Tersalin!" : "Salin semua"}
                </Button>
                <Button variant="success" size="sm" onClick={downloadTxt}>
                  <Download className="h-3.5 w-3.5" />
                  Unduh TXT
                </Button>
              </div>
            </div>
            {pages.map((p, i) => (
              <div key={i} className="flex flex-col gap-1">
                <p className="tnum text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                  Halaman {i + 1}
                </p>
                <pre className="whitespace-pre-wrap rounded-md bg-background p-3 text-xs leading-relaxed">
                  {p.trim() || "(tidak ada teks terdeteksi)"}
                </pre>
              </div>
            ))}
          </div>
        )}

        <DownloadResult single={result ?? undefined} summary="OCR selesai" />
      </div>
    </ToolLayout>
  );
}
