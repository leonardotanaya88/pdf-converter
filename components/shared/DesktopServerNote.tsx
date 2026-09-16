"use client";

import { useEffect, useState } from "react";
import { Info, Loader2, Server, CheckCircle } from "lucide-react";

import { IS_DESKTOP_BUILD } from "@/lib/config";
import { checkServerAvailable, EMBEDDED_SERVER_URL } from "@/lib/config";
import { cn } from "@/lib/utils";

interface DesktopServerNoteProps {
  title: string;
  /** Jika true, cek server embedded; jika false, tampilkan pesan tidak tersedia. */
  checkEmbedded?: boolean;
}

/** Penanda halaman tool yang hanya tersedia di versi web (build desktop) atau butuh server. */
export function DesktopServerNote({
  title,
  checkEmbedded = true,
}: DesktopServerNoteProps) {
  const [serverReady, setServerReady] = useState<boolean | null>(null);
  const [checking, setChecking] = useState(true);

  useEffect(() => {
    if (!IS_DESKTOP_BUILD || !checkEmbedded) {
      setChecking(false);
      setServerReady(false);
      return;
    }

    let mounted = true;

    async function check() {
      try {
        const ready = await checkServerAvailable(EMBEDDED_SERVER_URL);
        if (mounted) {
          setServerReady(ready);
          setChecking(false);
        }
      } catch {
        if (mounted) {
          setServerReady(false);
          setChecking(false);
        }
      }
    }

    check();

    return () => {
      mounted = false;
    };
  }, [checkEmbedded]);

  // Jika bukan desktop build, jangan render apa-apa
  if (!IS_DESKTOP_BUILD) {
    return null;
  }

  const baseStyles = "rounded-[10px] border p-5 shadow-soft transition-colors";

  // Jika checking, tampilkan loading
  if (checking) {
    return (
      <div className={cn(baseStyles, "border-warning/30 bg-warning/10 text-warning-foreground")}>
        <div className="flex items-center gap-3">
          <Loader2 className="mt-0.5 h-5 w-5 shrink-0 animate-spin" />
          <div>
            <p className="text-sm font-semibold">Memeriksa server lokal...</p>
            <p className="mt-1 text-sm text-muted-foreground">
              Server untuk kompres, lindungi, buka kunci, OCR, Office→PDF
              sedang dimulai.
            </p>
          </div>
        </div>
      </div>
    );
  }

  // Jika server ready, tampilkan success (tool bisa dipakai)
  if (serverReady) {
    return (
      <div className={cn(baseStyles, "border-success/30 bg-success/10 text-success-foreground")}>
        <div className="flex items-start gap-3">
          <CheckCircle className="mt-0.5 h-5 w-5 shrink-0" />
          <div>
            <p className="text-sm font-semibold">
              Server lokal siap — “{title}” tersedia
            </p>
            <p className="mt-1 text-sm text-muted-foreground">
              Alat ini diproses di server lokal yang berjalan di latar belakang
              (port 8123). Semua file diproses di perangkat ini.
            </p>
          </div>
        </div>
      </div>
    );
  }

  // Default: server tidak tersedia
  return (
    <div className={cn(baseStyles, "border-warning/30 bg-warning/10 text-warning-foreground")}>
      <div className="flex items-start gap-3">
        <Info className="mt-0.5 h-5 w-5 shrink-0" />
        <div>
          <p className="text-sm font-semibold">
            “{title}” memerlukan server lokal
          </p>
          <p className="mt-1 text-sm text-muted-foreground">
            Alat ini diproses di server lokal (kompres, lindungi, buka kunci,
            OCR, Office→PDF). Server belum siap — coba muat ulang aplikasi
            atau restart via menu Bantuan.
          </p>
        </div>
      </div>
    </div>
  );
}