# PDF Converter

Alat PDF Seperti iLovePDF — **100% di browser**. Semua pemrosesan berjalan
client-side; file tidak pernah diupload ke server mana pun.

Dibangun mengikuti `pdf-tools-project-scope.md` (Fase 1 lengkap, Next.js 14).

## Menjalankan

```bash
npm install
npm run dev        # http://localhost:3000
npm run build      # build produksi + generate public/sw.js (PWA offline)
npm run start      # jalankan hasil build
```

## Deploy gratis (opsional)

Versi cloud 100% gratis (Vercel Hobby + Hugging Face Spaces CPU): semua
tool bisa dipakai siapa pun tanpa install — panduan langkah demi langkah di
**`DEPLOY.md`**. Catatan penting: di cloud, file transit ke server HF
(Space publik), Office→PDF memakai LibreOffice, dan Space tidur setelah
±48 jam idle. Tanpa env `NEXT_PUBLIC_PDF_SERVER_URL` aplikasi tetap
berjalan lokal seperti biasa.

## Aplikasi desktop (Electron)

Versi desktop berdiri sendiri (Windows, NSIS installer) dengan **sistem
versi** — update fitur/bugfix disebar dengan build installer baru.

- Halaman dimuat dari hasil export statis (`out/`) lewat protocol `app://`
  (bukan `file://`, supaya ESM berjalan normal). Kode: `desktop/main.js`
  (main process) + `desktop/preload.js` (bridge `window.desktop`).
- **PDF reader** menerima file dari OS: installer mendaftarkan association
  `.pdf` → double-click PDF langsung terbuka di reader.
- Versi tampil di footer aplikasi dan menu *Bantuan → Tentang*.
- 5 tool server (kompres, lindungi, buka kunci, OCR, office) **tidak
  disertakan** di desktop — halaman-nya diganti kartu penjelas. Semua
  pemrosesan 12 tool desktop murni lokal.

### Dev (hot reload)

```bash
npm run desktop:dev
```

Menjalankan Next dev di port 3001 lalu membuka jendela Electron yang
menunjuk ke situ.

### Build installer rilis

```bash
npm run desktop:build
```

Menghasilkan `release/PDF-Converter-Setup-<versi>.exe`.

### Rilis versi baru (manual)

```bash
npm version patch   # atau minor / major — naikkan versi di package.json
npm run desktop:build
```

1. Versi baru otomatis masuk nama installer (`-Setup-<versi>.exe`) dan
   tampil di aplikasi (footer + Tentang).
2. Kirim installer ke device lain; install di atas versi lama (data lokal
   dan asosiasi `.pdf` dipertahankan).
3. Versi yang lebih lama bisa dihapus setelah device lain ter-update.

> File build desktop tetap bisa diverifikasi: export statis normal di
> `npm run build`, aplikasi web biasa tidak terpengaruh.

## Diferensiasi (scope §8)

- **Pipeline antar-tool** — setelah proses, klik "Lanjutkan ke tool lain":
  hasil langsung jadi file input tool berikutnya tanpa upload ulang
  (contoh: gabung → nomor halaman → watermark).
- **PWA offline** — semua tool Fase 1 jalan tanpa internet setelah
  kunjungan pertama (service worker precache; dokumen network-first,
  aset statis cache-first). Ikon + manifest di `app/manifest.ts`.
- `scripts/gen-sw.js` membangun `public/sw.js` saat `npm run build`;
  `scripts/gen-icons.js` (butuh puppeteer-core) membuat ulang ikon PNG.

## Fitur (Fase 1 — semua client-side)

| Tool | Path |
|---|---|
| Gabung PDF (drag-reorder) | `/tools/merge` |
| Pisah PDF (per halaman / rentang) | `/tools/split` |
| Putar PDF (per halaman / semua) | `/tools/rotate` |
| Atur Halaman (drag-reorder + hapus) | `/tools/organize` |
| Ekstrak Halaman (multi-select) | `/tools/extract` |
| PDF → JPG (kualitas bisa diatur, ZIP) | `/tools/pdf-to-jpg` |
| JPG → PDF (A4 / fit, lanskap) | `/tools/jpg-to-pdf` |
| Nomor Halaman (9 posisi, preview live) | `/tools/page-numbers` |
| Watermark (teks/gambar, preview live) | `/tools/watermark` |

## Struktur

- `lib/pdf/*` — fungsi murni (input file → bytes), satu file per operasi.
  Library terkunci: **pdf-lib** untuk manipulasi, **pdf.js** untuk render/preview.
- `components/shared/*` — FileDropzone, PagePreviewGrid, ProcessButton,
  DownloadResult, ToolLayout, OverlayPreview (dipakai ulang semua tool).
- `store/useFileStore.ts` — Zustand: file terpilih, status, error.
- Worker pdf.js disalin ke `public/pdf.worker.min.mjs` otomatis oleh
  script `postinstall`.

## Fase 2 — fitur server (protect, unlock, compress)

Backend: `server/` (FastAPI + PyMuPDF). Lokal: bind 127.0.0.1, port
**8123** (jangan expose ke LAN). Cloud: bind 0.0.0.0:7860 lewat
`Dockerfile` (HF Spaces), CORS dari env `ALLOWED_ORIGINS`.

```bash
pip install -r server/requirements.txt   # atau: python -m pip install -r ...
server\run.bat                            # atau: python -m uvicorn main:app --host 127.0.0.1 --port 8123
npm run dev                               # di terminal lain
```

- **Protect** (`/tools/protect`) — enkripsi AES-256.
- **Unlock** (`/tools/unlock`) — hapus kata sandi (file milik user; disclaimer di UI).
- **Compress** (`/tools/compress`) — rekompresi gambar + garbage collect
  (pengganti Ghostscript yang tidak perlu install; hasilnya cukup signifikan
  untuk PDF bergambar).
- **OCR** (`/too
- ls/ocr`) — dua mode: PDF searchable (halaman jadi gambar +
  teks tak terlihat) atau ekstrak teks per halaman (TXT).
  Mesin: **RapidOCR (PaddleOCR-v3 via ONNX)** — deviasi dari scope §2
  ("Tesseract") karena Tesseract tidak bisa diinstall tanpa admin di mesin
  ini (winget butuh UAC; conda-forge mati di repodata raksasa). Prinsipnya
  tetap: OCR server-side, offline, model dimuat saat pemakaian pertama.
- **Office → PDF** (`/tools/office-to-pdf`) — Word/Excel/PowerPoint.
  Windows: Microsoft Office via COM (`pywin32`, tanpa install apa pun).
  Linux/cloud: LibreOffice headless (diinstall di image Docker).

Kebijakan (scope §7): upload dihapus segera setelah diproses, file hasil
di-cleanup otomatis (maks 1 jam + saat startup), batas ukuran 200 MB,
rate limit per-IP 30/menit, CORS dibatasi metode POST/GET + expose
Content-Disposition.

**Belum dibangun:** PDF→Office (kualitas medioker dengan tool open-source —
dilewati sesuai catatan scope §7).

## Catatan

- File rusak/terenkripsi ditolak dengan pesan jelas, bukan crash.
- File besar dirender bertahap (`yieldToMain`) agar UI tidak membeku.
- Object URL di-revoke setelah unduh (anti memory leak).
- Jebakan Windows yang sudah ditangani: handle fitz wajib di-close sebelum
  hapus file upload (`WinError 32`).
