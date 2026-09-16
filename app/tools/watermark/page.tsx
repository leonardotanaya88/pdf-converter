"use client";

import { useEffect, useRef, useState } from "react";
import { ImagePlus } from "lucide-react";

import { ToolLayout } from "@/components/shared/ToolLayout";
import { FileDropzone } from "@/components/shared/FileDropzone";
import { ProcessButton } from "@/components/shared/ProcessButton";
import { DownloadResult } from "@/components/shared/DownloadResult";
import { OverlayPreview } from "@/components/shared/OverlayPreview";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Slider } from "@/components/ui/slider";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { useFileStore } from "@/store/useFileStore";
import {
  addImageWatermark,
  addTextWatermark,
  type WatermarkMode,
} from "@/lib/pdf/watermark";
import { cn } from "@/lib/utils";
import { bytesToBlob } from "@/lib/utils/download";

export default function WatermarkPage() {
  const { files, status, error, setStatus, setError } = useFileStore();
  const file = files[0]?.file;

  const [tab, setTab] = useState<"text" | "image">("text");
  const [result, setResult] = useState<{ name: string; blob: Blob } | null>(null);

  // ── Opsi teks ──
  const [text, setText] = useState("RAHASIA");
  const [textOpacity, setTextOpacity] = useState(0.35);
  const [rotation, setRotation] = useState(-30);
  const [textColor, setTextColor] = useState("#6B6963");
  const [textFontSize, setTextFontSize] = useState(36);

  // ── Opsi gambar ──
  const [imageFile, setImageFile] = useState<File | null>(null);
  const [imgOpacity, setImgOpacity] = useState(0.5);
  const [imgScale, setImgScale] = useState(0.5);
  const [mode, setMode] = useState<WatermarkMode>("center");
  const [imgLoaded, setImgLoaded] = useState(0);
  const imgRef = useRef<HTMLImageElement | null>(null);

  useEffect(() => {
    if (!imageFile) {
      imgRef.current = null;
      setImgLoaded(0);
      return;
    }
    const url = URL.createObjectURL(imageFile);
    const img = new Image();
    img.onload = () => {
      imgRef.current = img;
      setImgLoaded((n) => n + 1);
    };
    img.src = url;
    return () => URL.revokeObjectURL(url);
  }, [imageFile]);

  const handleProcess = async () => {
    if (!file) return;
    setResult(null);
    setStatus("processing");
    setError(null);
    try {
      if (tab === "text") {
        const bytes = await addTextWatermark(file, {
          text,
          opacity: textOpacity,
          rotation,
          color: textColor,
          mode,
          fontSize: textFontSize,
        });
        setResult({
          name: file.name.replace(/\.pdf$/i, "") + "-watermarked.pdf",
          blob: bytesToBlob(bytes, "application/pdf"),
        });
      } else {
        if (!imageFile) throw new Error("Pilih gambar watermark dulu.");
        const bytes = await addImageWatermark(file, {
          image: imageFile,
          opacity: imgOpacity,
          mode,
          scale: imgScale,
        });
        setResult({
          name: file.name.replace(/\.pdf$/i, "") + "-watermarked.pdf",
          blob: bytesToBlob(bytes, "application/pdf"),
        });
      }
      setStatus("done");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Terjadi kesalahan saat watermark.");
      setStatus("error");
    }
  };

  const drawImageOverlay = (
    ctx: CanvasRenderingContext2D,
    w: number,
    h: number,
    scale: number
  ) => {
    const img = imgRef.current;
    if (!img) return;
    const iw = img.naturalWidth * imgScale * scale;
    const ih = img.naturalHeight * imgScale * scale;
    ctx.save();
    ctx.globalAlpha = imgOpacity;
    if (mode === "tile") {
      const stepX = iw + 100 * scale;
      const stepY = ih + 100 * scale;
      for (let y = -ih; y < h * scale + ih; y += stepY) {
        for (let x = -iw; x < w * scale + iw; x += stepX) {
          ctx.drawImage(img, x, y, iw, ih);
        }
      }
    } else {
      ctx.drawImage(img, (w * scale - iw) / 2, (h * scale - ih) / 2, iw, ih);
    }
    ctx.restore();
  };

  const drawTextOverlay = (
    ctx: CanvasRenderingContext2D,
    w: number,
    h: number,
    scale: number
  ) => {
    ctx.save();
    ctx.globalAlpha = textOpacity;
    ctx.fillStyle = textColor;
    ctx.font = `bold ${textFontSize}px Inter, sans-serif`;
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    const rad = (rotation * Math.PI) / 180;
    if (mode === "tile") {
      const twPt = ctx.measureText(text).width / scale;
      const stepX = (twPt + 140) * scale;
      const stepY = textFontSize * 2.8 * scale;
      for (let y = -textFontSize * scale; y < h * scale + textFontSize * scale; y += stepY) {
        for (let x = -twPt * scale; x < w * scale + twPt * scale; x += stepX) {
          ctx.save();
          ctx.translate(x, y);
          ctx.rotate(rad);
          ctx.fillText(text, 0, 0);
          ctx.restore();
        }
      }
    } else {
      ctx.translate((w * scale) / 2, (h * scale) / 2);
      ctx.rotate(rad);
      ctx.fillText(text, 0, 0);
    }
    ctx.restore();
  };

  return (
    <ToolLayout
      title="Watermark"
      description="Tambahkan teks atau gambar sebagai watermark, dengan preview langsung."
    >
      <div className="flex flex-col gap-4">
        <FileDropzone
          accept={["application/pdf"]}
          multiple={false}
          hint="Satu file PDF • maks 200 MB"
        />

        {file && (
          <div className="flex flex-col gap-6 rounded-[10px] border border-border bg-white p-5 shadow-soft md:flex-row">
            <div className="flex flex-1 flex-col gap-5">
              <Tabs value={tab} onValueChange={(v) => setTab(v as "text" | "image")}>
                <TabsList>
                  <TabsTrigger value="text">Teks</TabsTrigger>
                  <TabsTrigger value="image">Gambar</TabsTrigger>
                </TabsList>

                <TabsContent value="text" className="flex flex-col gap-4">
                  <div className="flex flex-col gap-1.5">
                    <Label htmlFor="wm-text">Teks watermark</Label>
                    <Input
                      id="wm-text"
                      value={text}
                      onChange={(e) => setText(e.target.value)}
                      placeholder="RAHASIA"
                      className="max-w-xs"
                    />
                  </div>
                  <div className="flex flex-col gap-3">
                    <div className="flex items-center justify-between">
                      <Label htmlFor="wm-opacity">Transparansi</Label>
                      <span className="tnum text-xs font-semibold text-primary">
                        {Math.round(textOpacity * 100)}%
                      </span>
                    </div>
                    <Slider
                      id="wm-opacity"
                      min={0.05}
                      max={1}
                      step={0.05}
                      value={[textOpacity]}
                      onValueChange={([v]) => setTextOpacity(v)}
                    />
                  </div>
                  <div className="flex flex-col gap-3">
                    <div className="flex items-center justify-between">
                      <Label htmlFor="wm-rot">Rotasi</Label>
                      <span className="tnum text-xs font-semibold text-primary">
                        {rotation}°
                      </span>
                    </div>
                    <Slider
                      id="wm-rot"
                      min={-90}
                      max={90}
                      step={5}
                      value={[rotation]}
                      onValueChange={([v]) => setRotation(v)}
                    />
                  </div>
                  <div className="flex flex-col gap-3">
                    <div className="flex items-center justify-between">
                      <Label htmlFor="wm-size">Ukuran huruf</Label>
                      <span className="tnum text-xs font-semibold text-primary">
                        {textFontSize} pt
                      </span>
                    </div>
                    <Slider
                      id="wm-size"
                      min={12}
                      max={72}
                      step={2}
                      value={[textFontSize]}
                      onValueChange={([v]) => setTextFontSize(v)}
                    />
                  </div>
                  <div className="flex items-center gap-3">
                    <Label htmlFor="wm-color">Warna</Label>
                    <Input
                      id="wm-color"
                      type="color"
                      value={textColor}
                      onChange={(e) => setTextColor(e.target.value)}
                      className="h-9 w-16 cursor-pointer p-1"
                    />
                  </div>
                </TabsContent>

                <TabsContent value="image" className="flex flex-col gap-4">
                  <div className="flex flex-col gap-2">
                    <Label>Gambar watermark</Label>
                    <label
                      className={cn(
                        "flex cursor-pointer flex-col items-center justify-center gap-2 rounded-lg border-2 border-dashed px-4 py-6 text-center transition-colors",
                        imageFile
                          ? "border-primary bg-accent/50"
                          : "border-border hover:border-primary/60 hover:bg-accent/40"
                      )}
                    >
                      <ImagePlus className="h-6 w-6 text-primary" />
                      <span className="text-xs font-medium text-foreground">
                        {imageFile ? imageFile.name : "Pilih gambar JPG/PNG"}
                      </span>
                      <input
                        type="file"
                        accept="image/jpeg,image/png"
                        className="hidden"
                        onChange={(e) => {
                          const f = e.target.files?.[0];
                          if (f) setImageFile(f);
                          e.target.value = "";
                        }}
                      />
                    </label>
                  </div>
                  <div className="flex flex-col gap-3">
                    <div className="flex items-center justify-between">
                      <Label htmlFor="wm-img-opacity">Transparansi</Label>
                      <span className="tnum text-xs font-semibold text-primary">
                        {Math.round(imgOpacity * 100)}%
                      </span>
                    </div>
                    <Slider
                      id="wm-img-opacity"
                      min={0.05}
                      max={1}
                      step={0.05}
                      value={[imgOpacity]}
                      onValueChange={([v]) => setImgOpacity(v)}
                    />
                  </div>
                  <div className="flex flex-col gap-3">
                    <div className="flex items-center justify-between">
                      <Label htmlFor="wm-img-scale">Ukuran</Label>
                      <span className="tnum text-xs font-semibold text-primary">
                        {Math.round(imgScale * 100)}%
                      </span>
                    </div>
                    <Slider
                      id="wm-img-scale"
                      min={0.2}
                      max={1}
                      step={0.05}
                      value={[imgScale]}
                      onValueChange={([v]) => setImgScale(v)}
                    />
                  </div>
                </TabsContent>
              </Tabs>

              <div className="flex flex-col gap-2">
                <Label>Posisi</Label>
                <RadioGroup
                  value={mode}
                  onValueChange={(v) => setMode(v as WatermarkMode)}
                  className="flex gap-4"
                >
                  <div className="flex items-center gap-2">
                    <RadioGroupItem value="center" id="wm-center" />
                    <Label htmlFor="wm-center">Tengah</Label>
                  </div>
                  <div className="flex items-center gap-2">
                    <RadioGroupItem value="tile" id="wm-tile" />
                    <Label htmlFor="wm-tile">Ubin (diulang)</Label>
                  </div>
                </RadioGroup>
              </div>
            </div>

            <div className="flex flex-col gap-3 md:w-80">
              <OverlayPreview
                file={file}
                drawDeps={[
                  tab,
                  text,
                  textOpacity,
                  rotation,
                  textColor,
                  textFontSize,
                  imgOpacity,
                  imgScale,
                  mode,
                  imgLoaded,
                ]}
                draw={
                  tab === "text" ? drawTextOverlay : drawImageOverlay
                }
              />
            </div>
          </div>
        )}

        <ProcessButton
          label="Terapkan watermark"
          onClick={handleProcess}
          loading={status === "processing"}
          disabled={!file}
          error={error}
        />
        <DownloadResult
          single={result ?? undefined}
          summary="Watermark diterapkan"
        />
      </div>
    </ToolLayout>
  );
}
