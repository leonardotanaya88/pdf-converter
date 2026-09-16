import type { Metadata } from "next";
import { Inter } from "next/font/google";
import Link from "next/link";
import { FileText } from "lucide-react";
import { AppZoom } from "@/components/shared/AppZoom";
import { RegisterSW } from "@/components/shared/RegisterSW";
import { ThemeProvider } from "@/components/shared/ThemeProvider";
import { ThemeToggle } from "@/components/shared/ThemeToggle";
import "./globals.css";

const inter = Inter({ subsets: ["latin"], variable: "--font-inter" });
const appVersion = process.env.NEXT_PUBLIC_APP_VERSION;

export const metadata: Metadata = {
  title: "PDF Converter — Alat PDF 100% di Browser",
  description:
    "Gabung, pisah, putar, watermark, dan lainnya — semua diproses di browser Anda. File tidak pernah diupload.",
  manifest: "/manifest.webmanifest",
  themeColor: "#185FA5",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="id" suppressHydrationWarning>
      <body className={`${inter.variable} font-sans`}>
        <ThemeProvider>
          <header className="sticky top-0 z-40 bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/80 border-b border-border">
            <div className="mx-auto flex w-full max-w-5xl items-center gap-3 px-4 py-3">
              <Link href="/" className="flex items-center gap-2">
                <FileText className="h-5 w-5 text-primary" />
                <span className="text-sm font-semibold">PDF Converter</span>
              </Link>
              <span className="hidden text-xs text-muted-foreground sm:inline">
                Alat PDF di browser Anda
              </span>
              <div className="ml-auto flex items-center gap-2">
                <span className="hidden text-[11px] text-muted-foreground sm:inline">
                  🔒 File tidak pernah meninggalkan perangkat
                </span>
                <ThemeToggle />
              </div>
            </div>
          </header>
          {children}
          <AppZoom />
          <RegisterSW />
          <footer className="border-t border-border py-6 text-center text-xs text-muted-foreground">
            Semua pemrosesan terjadi di browser Anda — tidak ada file yang dikirim ke
            server mana pun.
            {appVersion && (
              <span className="tnum mt-1 block">
                PDF Converter v{appVersion}
              </span>
            )}
          </footer>
        </ThemeProvider>
      </body>
    </html>
  );
}