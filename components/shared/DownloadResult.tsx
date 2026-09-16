"use client";

import { useRouter } from "next/navigation";
import { ArrowRight, CheckCircle2, Download, RotateCcw } from "lucide-react";

import { Button } from "@/components/ui/button";
import { useFileStore } from "@/store/useFileStore";
import { downloadBlob, downloadZip } from "@/lib/utils/download";

export interface DownloadItem {
  name: string;
  blob: Blob;
}

/** Target pipeline default: semua tool yang menerima input PDF. */
const DEFAULT_PIPELINE_TARGETS = [
  { href: "/tools/merge", label: "Gabung" },
  { href: "/tools/split", label: "Pisah" },
  { href: "/tools/rotate", label: "Putar" },
  { href: "/tools/organize", label: "Atur" },
  { href: "/tools/extract", label: "Ekstrak" },
  { href: "/tools/page-numbers", label: "Nomor Halaman" },
  { href: "/tools/watermark", label: "Watermark" },
];

interface DownloadResultProps {
  /** Hasil tunggal (1 file) — satu-satunya bentuk yang bisa masuk pipeline. */
  single?: DownloadItem;
  /** Banyak file → dibungkus ZIP. */
  items?: DownloadItem[];
  zipName?: string;
  summary?: string;
  onReset?: () => void;
  /** null = nonaktifkan pipeline; undefined = daftar default. */
  pipelineTargets?: { href: string; label: string }[] | null;
}

export function DownloadResult({
  single,
  items,
  zipName = "hasil.zip",
  summary,
  onReset,
  pipelineTargets = DEFAULT_PIPELINE_TARGETS,
}: DownloadResultProps) {
  const router = useRouter();
  const addFiles = useFileStore((s) => s.addFiles);

  if (!single && (!items || items.length === 0)) return null;

  const count = single ? 1 : items!.length;
  const handleDownload = () => {
    if (single) {
      downloadBlob(single.blob, single.name);
    } else if (items && items.length) {
      downloadZip(items, zipName);
    }
  };

  /** Pipeline: hasil → File → replace store → pindah ke tool target. */
  const continueTo = (href: string) => {
    if (!single) return;
    const file = new File([single.blob], single.name, {
      type: "application/pdf",
    });
    addFiles([file], true);
    router.push(href);
  };

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-col gap-4 rounded-[10px] border border-success/30 bg-[#EAF3DE] p-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-start gap-3">
          <CheckCircle2 className="mt-0.5 h-5 w-5 shrink-0 text-success" />
          <div>
            <p className="text-sm font-semibold text-success">
              Selesai — {summary ?? "hasil siap diunduh"}
            </p>
            <p className="tnum mt-0.5 text-xs text-success/80">
              {single ? single.name : `${count} file → ${zipName}`}
            </p>
          </div>
        </div>
        <div className="flex shrink-0 gap-2">
          <Button variant="success" onClick={handleDownload}>
            <Download className="h-4 w-4" />
            Unduh {single ? "" : "ZIP"}
          </Button>
          {onReset && (
            <Button variant="outline" onClick={onReset}>
              <RotateCcw className="h-4 w-4" />
              Proses lagi
            </Button>
          )}
        </div>
      </div>

      {single && pipelineTargets && pipelineTargets.length > 0 && (
        <div className="flex flex-wrap items-center gap-2 rounded-[10px] border border-border bg-white p-4 shadow-soft">
          <span className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
            Lanjutkan ke tool lain
          </span>
          {pipelineTargets.map((t) => (
            <Button
              key={t.href}
              variant="outline"
              size="sm"
              onClick={() => continueTo(t.href)}
            >
              {t.label}
              <ArrowRight className="h-3.5 w-3.5" />
            </Button>
          ))}
        </div>
      )}
    </div>
  );
}
