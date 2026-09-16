"use client";

import { useCallback, useEffect, useState } from "react";
import { Minus, Plus } from "lucide-react";

import { cn } from "@/lib/utils";

const MIN_SCALE = 0.5;
const MAX_SCALE = 2.5;
const STEP = 0.1;
const STORAGE_KEY = "pdf-converter-zoom";

const clamp = (v: number) => Math.min(Math.max(v, MIN_SCALE), MAX_SCALE);
const round2 = (v: number) => Math.round(v * 100) / 100;

/**
 * Zoom interaktif seluruh aplikasi: Ctrl/Cmd + "+"/"=" perbesar, Ctrl/Cmd +
 * "-" perkecil, Ctrl/Cmd + "0" reset, Ctrl + scroll (pinch trackpad) ikut
 * berfungsi. Zoom native browser diblokir di dalam aplikasi dan diganti zoom
 * ini (CSS `zoom` pada <html> — reflow proper). Level zoom disimpan di
 * localStorage.
 */
export function AppZoom() {
  const [scale, setScale] = useState(1);

  // Baca simpanan setelah hydration — hindari mismatch SSR.
  useEffect(() => {
    try {
      const saved = parseFloat(localStorage.getItem(STORAGE_KEY) ?? "");
      if (!Number.isNaN(saved)) setScale(clamp(saved));
    } catch {
      // localStorage tidak tersedia — pakai default.
    }
  }, []);

  useEffect(() => {
    document.documentElement.style.zoom = String(scale);
    try {
      localStorage.setItem(STORAGE_KEY, String(scale));
    } catch {
      // abaikan — zoom tetap berlaku sesi ini.
    }
  }, [scale]);

  const adjust = useCallback((delta: number) => {
    setScale((s) => round2(clamp(s + delta)));
  }, []);

  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (!e.ctrlKey && !e.metaKey) return;
      const k = e.key;
      if (k === "=" || k === "+") {
        e.preventDefault();
        adjust(STEP);
      } else if (k === "-") {
        e.preventDefault();
        adjust(-STEP);
      } else if (k === "0") {
        e.preventDefault();
        setScale(1);
      }
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [adjust]);

  useEffect(() => {
    const onWheel = (e: WheelEvent) => {
      if (!e.ctrlKey) return;
      e.preventDefault();
      adjust(e.deltaY > 0 ? -STEP : STEP);
    };
    window.addEventListener("wheel", onWheel, { passive: false });
    return () => window.removeEventListener("wheel", onWheel);
  }, [adjust]);

  const pct = Math.round(scale * 100);
  const btn =
    "grid h-6 w-6 place-items-center rounded-full text-muted-foreground hover:bg-accent hover:text-foreground";

  return (
    <div className="fixed bottom-4 right-4 z-50 flex items-center gap-0.5 rounded-full border border-border bg-white/95 p-1 shadow-soft backdrop-blur">
      <button
        type="button"
        className={btn}
        onClick={() => adjust(-STEP)}
        aria-label="Perkecil (Ctrl−)"
        title="Perkecil (Ctrl−)"
      >
        <Minus className="h-3.5 w-3.5" />
      </button>
      <button
        type="button"
        className={cn(
          "tnum rounded-full px-2 py-0.5 text-xs font-semibold text-primary hover:bg-accent",
          pct !== 100 && "text-amber-600"
        )}
        onClick={() => setScale(1)}
        title="Reset zoom (Ctrl+0)"
      >
        {pct}%
      </button>
      <button
        type="button"
        className={btn}
        onClick={() => adjust(STEP)}
        aria-label="Perbesar (Ctrl+)"
        title="Perbesar (Ctrl+)"
      >
        <Plus className="h-3.5 w-3.5" />
      </button>
    </div>
  );
}
