"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { Eraser } from "lucide-react";

import { ToolLayout } from "@/components/shared/ToolLayout";
import { FileDropzone } from "@/components/shared/FileDropzone";
import { ProcessButton } from "@/components/shared/ProcessButton";
import { DownloadResult } from "@/components/shared/DownloadResult";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Slider } from "@/components/ui/slider";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { useFileStore } from "@/store/useFileStore";
import {
  removeBackgroundColor,
  type RgbaPixel,
} from "@/lib/pdf/removeBackground";
import { bytesToSize } from "@/lib/utils/download";

const MODES: { value: "edges" | "global"; label: string }[] = [
  { value: "edges", label: "Dari tepi gambar" },
  { value: "global", label: "Seluruh gambar" },
];

function SectionTitle({ children }: { children: React.ReactNode }) {
  return (
    <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
      {children}
    </p>
  );
}

/** Salin ke Uint8ClampedArray<ArrayBuffer> agar lolos tipe ImageData. */
function toImageData(data: Uint8ClampedArray, w: number, h: number) {
  return new ImageData(new Uint8ClampedArray(data), w, h);
}

function hexToRgb(hex: string): RgbaPixel {
  const h = hex.replace("#", "");
  return {
    r: parseInt(h.slice(0, 2), 16),
    g: parseInt(h.slice(2, 4), 16),
    b: parseInt(h.slice(4, 6), 16),
  };
}

export default function RemoveBackgroundPage() {
  const { files, status, error, setStatus, setError } = useFileStore();
  const file = files[0]?.file;

  const [result, setResult] = useState<{ name: string; blob: Blob } | null>(null);
  const [imgData, setImgData] = useState<ImageData | null>(null);
  const [imageName, setImageName] = useState("");
  const [color, setColor] = useState("#FFFFFF");
  const [tolerance, setTolerance] = useState(25);
  const [mode, setMode] = useState<"edges" | "global">("edges");

  const originalCanvasRef = useRef<HTMLCanvasElement>(null);
  const resultCanvasRef = useRef<HTMLCanvasElement>(null);

  // Muat gambar → ImageData penuh.
  useEffect(() => {
    setImgData(null);
    setImageName("");
    setResult(null);
    if (!file) return;
    const url = URL.createObjectURL(file);
    const img = new Image();
    img.onload = () => {
      const canvas = document.createElement("canvas");
      canvas.width = img.naturalWidth;
      canvas.height = img.naturalHeight;
      const ctx = canvas.getContext("2d");
      if (ctx) {
        ctx.drawImage(img, 0, 0);
        setImgData(ctx.getImageData(0, 0, canvas.width, canvas.height));
        setImageName(file.name.replace(/\.[^.]+$/, ""));
      }
      URL.revokeObjectURL(url);
    };
    img.onerror = () => URL.revokeObjectURL(url);
    img.src = url;
    return () => URL.revokeObjectURL(url);
  }, [file]);

  // Hasil transparan — dihitung ulang saat opsi berubah (live preview).
  const resultData = useMemo(() => {
    if (!imgData) return null;
    return removeBackgroundColor(imgData, {
      color: hexToRgb(color),
      tolerance,
      mode,
    });
  }, [imgData, color, tolerance, mode]);

  useEffect(() => {
    const canvas = originalCanvasRef.current;
    if (!canvas || !imgData) return;
    canvas.width = imgData.width;
    canvas.height = imgData.height;
    canvas.getContext("2d")!.putImageData(imgData, 0, 0);
  }, [imgData]);

  useEffect(() => {
    const canvas = resultCanvasRef.current;
    if (!canvas || !imgData || !resultData) return;
    canvas.width = imgData.width;
    canvas.height = imgData.height;
    const ctx = canvas.getContext("2d")!;
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    ctx.putImageData(
      toImageData(resultData, imgData.width, imgData.height),
      0,
      0
    );
  }, [imgData, resultData]);

  const handleProcess = async () => {
    if (!imgData || !resultData) return;
    setResult(null);
    setStatus("processing");
    setError(null);
    try {
      const canvas = document.createElement("canvas");
      canvas.width = imgData.width;
      canvas.height = imgData.height;
      const ctx = canvas.getContext("2d");
      if (!ctx) throw new Error("Canvas tidak tersedia.");
      ctx.putImageData(
        toImageData(resultData, imgData.width, imgData.height),
        0,
        0
      );
      const blob = await new Promise<Blob>((resolve, reject) =>
        canvas.toBlob(
          (b) => (b ? resolve(b) : reject(new Error("Gagal membuat PNG."))),
          "image/png"
        )
      );
      setResult({
        name: `${imageName || "gambar"}-nobg.png`,
        blob,
      });
      setStatus("done");
    } catch (e) {
      setError(
        e instanceof Error ? e.message : "Terjadi kesalahan saat menghapus latar."
      );
      setStatus("error");
    }
  };

  return (
    <ToolLayout
      title="Hapus Latar Belakang"
      description="Hilangkan latar belakang gambar berbasis warna — hasilnya PNG transparan, siap dipakai sebagai logo."
    >
      <div className="flex flex-col gap-4">
        <FileDropzone
          accept={["image/jpeg", "image/png"]}
          multiple={false}
          hint="Gambar JPG/PNG • hasil: PNG transparan"
        />

        {imgData && (
          <div className="flex flex-col gap-6 rounded-[10px] border border-border bg-white p-5 shadow-soft md:flex-row">
            <div className="flex flex-1 flex-col gap-5">
              <div className="flex flex-col gap-3">
                <SectionTitle>Warna yang dihapus</SectionTitle>
                <div className="flex items-center gap-3">
                  <Label htmlFor="rb-color">Warna target</Label>
                  <Input
                    id="rb-color"
                    type="color"
                    value={color}
                    onChange={(e) => setColor(e.target.value)}
                    className="h-9 w-16 cursor-pointer p-1"
                  />
                  <span className="tnum text-xs text-muted-foreground">
                    {color.toUpperCase()}
                  </span>
                </div>
                <div className="flex flex-col gap-3">
                  <div className="flex items-center justify-between">
                    <Label htmlFor="rb-tolerance">Toleransi</Label>
                    <span className="tnum text-xs font-semibold text-primary">
                      {tolerance}
                    </span>
                  </div>
                  <Slider
                    id="rb-tolerance"
                    min={0}
                    max={100}
                    step={1}
                    value={[tolerance]}
                    onValueChange={([v]) => setTolerance(v)}
                  />
                  <p className="text-xs text-muted-foreground">
                    Semakin besar, semakin banyak warna mirip yang ikut dihapus.
                  </p>
                </div>
              </div>

              <div className="flex flex-col gap-3 border-t border-border pt-5">
                <SectionTitle>Area penghapusan</SectionTitle>
                <RadioGroup
                  value={mode}
                  onValueChange={(v) => setMode(v as "edges" | "global")}
                  className="flex flex-col gap-2"
                >
                  {MODES.map((m) => (
                    <div key={m.value} className="flex items-center gap-2">
                      <RadioGroupItem value={m.value} id={`rb-${m.value}`} />
                      <Label htmlFor={`rb-${m.value}`} className="font-normal">
                        {m.label}
                      </Label>
                    </div>
                  ))}
                </RadioGroup>
                <p className="text-xs text-muted-foreground">
                  “Dari tepi gambar” hanya menghapus warna yang tersambung ke
                  tepi — aman untuk logo dengan warna serupa di dalamnya.
                  “Seluruh gambar” menghapus semua piksel yang cocok.
                </p>
              </div>

              <p className="tnum text-xs text-muted-foreground">
                {imgData.width} × {imgData.height} px (
                {bytesToSize(imgData.width * imgData.height * 4)})
              </p>
            </div>

            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 md:w-96">
              <div className="flex flex-col gap-2">
                <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                  Asli
                </p>
                <div className="overflow-hidden rounded-lg border border-border bg-white shadow-soft">
                  <canvas ref={originalCanvasRef} className="block h-auto w-full" />
                </div>
              </div>
              <div className="flex flex-col gap-2">
                <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                  Hasil (transparan)
                </p>
                <div className="overflow-hidden rounded-lg border border-border bg-[repeating-conic-gradient(#eee_0_25%,#fff_0_50%)] bg-[length:12px_12px] shadow-soft">
                  <canvas ref={resultCanvasRef} className="block h-auto w-full" />
                </div>
              </div>
            </div>
          </div>
        )}

        <ProcessButton
          label="Buat PNG transparan"
          onClick={handleProcess}
          loading={status === "processing"}
          disabled={!resultData}
          error={error}
        />
        <DownloadResult
          single={result ?? undefined}
          summary="Latar belakang dihapus"
        />
      </div>
    </ToolLayout>
  );
}
