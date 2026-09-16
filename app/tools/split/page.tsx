"use client";

import { useState } from "react";

import { ToolLayout } from "@/components/shared/ToolLayout";
import { FileDropzone } from "@/components/shared/FileDropzone";
import { ProcessButton } from "@/components/shared/ProcessButton";
import { DownloadResult } from "@/components/shared/DownloadResult";
import { PagePreviewGrid } from "@/components/shared/PagePreviewGrid";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { useFileStore } from "@/store/useFileStore";
import { splitEveryPage, splitByRanges } from "@/lib/pdf/split";
import { bytesToBlob } from "@/lib/utils/download";
import type { DownloadItem } from "@/components/shared/DownloadResult";

type SplitMode = "every" | "ranges";

export default function SplitPage() {
  const { files, status, error, setStatus, setError } = useFileStore();
  const file = files[0]?.file;
  const base = file ? file.name.replace(/\.pdf$/i, "") : "split";

  const [mode, setMode] = useState<SplitMode>("every");
  const [ranges, setRanges] = useState("");
  const [items, setItems] = useState<DownloadItem[] | null>(null);

  const handleProcess = async () => {
    if (!file) return;
    setItems(null);
    setStatus("processing");
    setError(null);
    try {
      if (mode === "every") {
        const parts = await splitEveryPage(file);
        setItems(
          parts.map((bytes, i) => ({
            name: `${base}-page-${i + 1}.pdf`,
            blob: bytesToBlob(bytes, "application/pdf"),
          }))
        );
      } else {
        const parts = await splitByRanges(file, ranges);
        setItems(
          parts.map((bytes, i) => ({
            name: `${base}-bagian-${i + 1}.pdf`,
            blob: bytesToBlob(bytes, "application/pdf"),
          }))
        );
      }
      setStatus("done");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Terjadi kesalahan saat memisah.");
      setStatus("error");
    }
  };

  return (
    <ToolLayout
      title="Pisah PDF"
      description="Pecah PDF menjadi beberapa file — per halaman atau berdasarkan rentang."
    >
      <div className="flex flex-col gap-4">
        <FileDropzone
          accept={["application/pdf"]}
          multiple={false}
          hint="Satu file PDF • maks 200 MB"
        />

        {file && (
          <div className="flex flex-col gap-4 rounded-[10px] border border-border bg-white p-5 shadow-soft">
            <RadioGroup
              value={mode}
              onValueChange={(v) => setMode(v as SplitMode)}
              className="flex gap-6"
            >
              <div className="flex items-center gap-2">
                <RadioGroupItem value="every" id="split-every" />
                <Label htmlFor="split-every">Setiap halaman jadi file terpisah</Label>
              </div>
              <div className="flex items-center gap-2">
                <RadioGroupItem value="ranges" id="split-ranges" />
                <Label htmlFor="split-ranges">Pisah berdasarkan rentang</Label>
              </div>
            </RadioGroup>

            {mode === "ranges" && (
              <div className="flex flex-col gap-1.5">
                <Label htmlFor="split-range-input">
                  Rentang halaman
                  <span className="mt-0.5 block text-xs font-normal text-muted-foreground">
                    Contoh: 1-3,5,7-9 — setiap grup berurutan menjadi satu file
                  </span>
                </Label>
                <Input
                  id="split-range-input"
                  value={ranges}
                  onChange={(e) => setRanges(e.target.value)}
                  placeholder="1-3,5,7-9"
                  className="max-w-xs"
                />
              </div>
            )}
          </div>
        )}

        <PagePreviewGrid file={file!} />

        <ProcessButton
          label={mode === "every" ? "Pisah per halaman" : "Pisah per rentang"}
          onClick={handleProcess}
          loading={status === "processing"}
          disabled={!file || (mode === "ranges" && !ranges.trim())}
          error={error}
        />
        <DownloadResult
          items={items ?? undefined}
          zipName={`${base}-split.zip`}
          summary="PDF berhasil dipisah"
        />
      </div>
    </ToolLayout>
  );
}
