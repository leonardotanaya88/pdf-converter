"use client";

import Link from "next/link";
import { ArrowLeft, Server, ShieldCheck } from "lucide-react";

import { IS_DESKTOP_BUILD } from "@/lib/config";
import { DesktopServerNote } from "@/components/shared/DesktopServerNote";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

interface ToolLayoutProps {
  title: string;
  description: string;
  children: React.ReactNode;
  /** Badge "diproses di browser" — false untuk halaman non-tool. */
  showPrivacyBadge?: boolean;
  /** Fitur Fase 2: diproses di server lokal (scope §10.3 — tandai jelas). */
  serverSide?: boolean;
  /** Layout lebar (max-w-6xl) untuk halaman yang butuh ruang lebih. */
  wide?: boolean;
}

/** Tombol kembali ke beranda — konsisten untuk semua halaman tool. */
function HomeLink() {
  return (
    <Link
      href="/"
      className="mb-5 inline-flex items-center gap-1.5 rounded-lg border border-border bg-background/80 px-3 py-1.5 text-sm font-medium text-foreground transition-colors hover:bg-accent/50 backdrop-blur-sm"
    >
      <ArrowLeft className="h-4 w-4" />
      Kembali ke Beranda
    </Link>
  );
}

/** Wrapper konsisten semua tool: judul, deskripsi 1 baris, slot konten, badge privacy. */
export function ToolLayout({
  title,
  description,
  children,
  showPrivacyBadge = true,
  serverSide = false,
  wide = false,
}: ToolLayoutProps) {
  // Build desktop: halaman tool server diganti penanda — konten tidak dirender.
  if (serverSide && IS_DESKTOP_BUILD) {
    return (
      <main
        className={cn(
          "mx-auto w-full px-4 py-8",
          wide ? "max-w-6xl" : "max-w-4xl"
        )}
      >
        <HomeLink />
        <DesktopServerNote title={title} checkEmbedded={true} />
      </main>
    );
  }

  return (
    <main
      className={cn("mx-auto w-full px-4 py-8", wide ? "max-w-6xl" : "max-w-4xl")}
    >
      <HomeLink />
      <div className="mb-6 flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">{title}</h1>
          <p className="mt-1 text-sm text-muted-foreground">{description}</p>
        </div>
        {showPrivacyBadge && (
          serverSide ? (
            <Badge variant={IS_DESKTOP_BUILD ? "glass-success" : "glass-warning"} className="gap-1.5">
              <Server className="h-3.5 w-3.5" />
              {IS_DESKTOP_BUILD
                ? "Diproses di server lokal embedded — file tidak keluar perangkat"
                : process.env.NEXT_PUBLIC_PDF_SERVER_URL
                ? "Diproses di server pribadi Anda — file dihapus otomatis"
                : "Diproses di server lokal Anda — file dihapus otomatis"}
            </Badge>
          ) : (
            <Badge variant="glass-primary" className="gap-1.5">
              <ShieldCheck className="h-3.5 w-3.5" />
              Diproses di browser
            </Badge>
          )
        )}
      </div>
      <div className="flex flex-col gap-6">{children}</div>
    </main>
  );
}