import Link from "next/link";
import {
  BookOpen,
  Combine,
  Droplets,
  Eraser,
  FileImage,
  FileOutput,
  FileType2,
  Hash,
  ImagePlus,
  Layers,
  Lock,
  Minimize2,
  RotateCw,
  ScanText,
  Scissors,
  ShieldCheck,
  Stamp,
  Unlock,
  type LucideIcon,
} from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { IS_DESKTOP_BUILD } from "@/lib/config";

interface ToolEntry {
  href: string;
  title: string;
  desc: string;
  icon: LucideIcon;
  server?: boolean;
}

const tools: ToolEntry[] = [
  {
    href: "/tools/read",
    title: "Baca PDF",
    desc: "Baca dokumen langsung di browser — cari teks, zoom, navigasi halaman.",
    icon: BookOpen,
  },
  {
    href: "/tools/merge",
    title: "Gabung PDF",
    desc: "Gabungkan beberapa PDF menjadi satu, atur urutannya.",
    icon: Combine,
  },
  {
    href: "/tools/split",
    title: "Pisah PDF",
    desc: "Pecah per halaman atau berdasarkan rentang.",
    icon: Scissors,
  },
  {
    href: "/tools/rotate",
    title: "Putar PDF",
    desc: "Rotasi halaman 90°, 180°, atau 270°.",
    icon: RotateCw,
  },
  {
    href: "/tools/organize",
    title: "Atur Halaman",
    desc: "Susun ulang dan hapus halaman.",
    icon: Layers,
  },
  {
    href: "/tools/extract",
    title: "Ekstrak Halaman",
    desc: "Ambil halaman terpilih menjadi PDF baru.",
    icon: FileOutput,
  },
  {
    href: "/tools/pdf-to-jpg",
    title: "PDF → JPG",
    desc: "Ubah setiap halaman PDF menjadi gambar JPG.",
    icon: FileImage,
  },
  {
    href: "/tools/jpg-to-pdf",
    title: "JPG → PDF",
    desc: "Gabungkan gambar JPG/PNG menjadi satu PDF.",
    icon: ImagePlus,
  },
  {
    href: "/tools/page-numbers",
    title: "Nomor Halaman",
    desc: "Tambahkan nomor halaman di posisi mana pun.",
    icon: Hash,
  },
  {
    href: "/tools/watermark",
    title: "Watermark",
    desc: "Tambahkan teks atau gambar sebagai watermark.",
    icon: Droplets,
  },
  {
    href: "/tools/logo-header",
    title: "Tambah Logo & Header",
    desc: "Tambahkan logo, teks, dan strip warna di bagian atas halaman.",
    icon: Stamp,
  },
  {
    href: "/tools/remove-background",
    title: "Hapus Latar Belakang",
    desc: "Buat latar belakang gambar jadi transparan (PNG).",
    icon: Eraser,
  },
  {
    href: "/tools/compress",
    title: "Kompres PDF",
    desc: "Kecilkan ukuran file tanpa mengubah isi halaman.",
    icon: Minimize2,
    server: true,
  },
  {
    href: "/tools/protect",
    title: "Lindungi PDF",
    desc: "Kunci file dengan kata sandi (AES-256).",
    icon: Lock,
    server: true,
  },
  {
    href: "/tools/unlock",
    title: "Buka Kunci PDF",
    desc: "Hapus kata sandi dari file milik Anda.",
    icon: Unlock,
    server: true,
  },
  {
    href: "/tools/ocr",
    title: "OCR PDF",
    desc: "Baca teks dari scan: PDF bisa dicari atau ekstrak TXT.",
    icon: ScanText,
    server: true,
  },
  {
    href: "/tools/office-to-pdf",
    title: "Office → PDF",
    desc: "Word, Excel, atau PowerPoint menjadi PDF.",
    icon: FileType2,
    server: true,
  },
];

const cloud = !!process.env.NEXT_PUBLIC_PDF_SERVER_URL;
const desktop = IS_DESKTOP_BUILD;
const visibleTools = desktop || cloud ? tools : tools.filter((t) => !t.server);

export default function HomePage() {
  return (
    <main className="mx-auto w-full max-w-5xl px-4 py-10">
      {/* Subtle grid background for depth */}
      <div className="fixed inset-0 grid-pattern pointer-events-none opacity-30 dark:opacity-20" aria-hidden="true" />

      <section className="mb-10 text-center relative z-10">
        <span className="inline-flex items-center gap-1.5 rounded-full bg-accent px-3 py-1.5 text-xs font-semibold text-accent-foreground glow-warm">
          <ShieldCheck className="h-3.5 w-3.5" />
          {desktop
            ? "Aplikasi desktop — 17 alat (12 lokal + 5 via server embedded)"
            : cloud
            ? "Privasi dulu — 12 alat di browser, 5 alat di server pribadi Anda"
            : "100% di browser — file tidak pernah diupload"}
        </span>
        <h1 className="mt-4 text-3xl sm:text-4xl font-bold tracking-tight bg-gradient-to-r from-foreground via-primary to-warning bg-clip-text text-transparent">
          Alat PDF yang menghormati privasi Anda
        </h1>
        {desktop ? (
          <p className="mx-auto mt-2 max-w-2xl text-sm text-muted-foreground">
            17 alat berjalan di perangkat ini — 12 alat sepenuhnya lokal (baca,
            gabung, pisah, watermark, hapus latar, dll.) dan 5 alat via server
            lokal embedded (kompres, lindungi, buka kunci, OCR, Office→PDF).
            Semua file diproses di perangkat ini, tanpa koneksi internet.
          </p>
        ) : cloud ? (
          <p className="mx-auto mt-2 max-w-2xl text-sm text-muted-foreground">
            12 alat diproses langsung di perangkat Anda (gabung, pisah,
            watermark, dll.); 5 alat (lindungi, buka kunci, kompres, OCR,
            office) diproses di server pribadi gratis Anda. File dihapus
            otomatis setelah diproses — tidak ada yang disimpan.
          </p>
        ) : (
          <p className="mx-auto mt-2 max-w-2xl text-sm text-muted-foreground">
            Gabung, pisah, putar, beri watermark, dan lainnya — semua diproses
            langsung di perangkat Anda. Tidak ada file yang dikirim ke server,
            tidak ada batas pemakaian.
          </p>
        )}
      </section>

      <section className="relative z-10 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {visibleTools.map((tool) => (
          <Link key={tool.href} href={tool.href} className="group">
            <Card
              className={`
                h-full transition-all duration-300
                bg-card/80 backdrop-blur-sm border-border/50
                hover:border-primary/40 hover:bg-accent/20
                hover:shadow-[0_0_30px_hsl(var(--primary)/0.1)]
                dark:hover:shadow-[0_0_30px_hsl(var(--primary)/0.15)]
                group-hover:-translate-y-0.5
              `}
            >
              <CardContent className="flex h-full flex-col gap-3 p-5">
                <div className="flex items-center justify-between">
                  <div className="flex items-center justify-center w-11 h-11 rounded-lg bg-primary/10 text-primary group-hover:bg-primary/20 group-hover:scale-110 transition-all duration-300">
                    <tool.icon className="h-6 w-6" />
                  </div>
                  {tool.server && (
                    <Badge
                      variant="secondary"
                      className="text-[10px] px-2 py-0.5 border-border/50 bg-background/80 backdrop-blur"
                    >
                      {desktop ? "server lokal" : cloud ? "server" : "server lokal"}
                    </Badge>
                  )}
                </div>
                <div className="flex-1">
                  <h2 className="text-sm font-semibold group-hover:text-primary transition-colors">
                    {tool.title}
                  </h2>
                  <p className="mt-1 text-xs text-muted-foreground leading-relaxed">
                    {tool.desc}
                  </p>
                </div>
              </CardContent>
            </Card>
          </Link>
        ))}
      </section>
    </main>
  );
}