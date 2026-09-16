# Deploy Gratis (Opsi A) — Vercel + Hugging Face Spaces

Biaya **Rp 0, tanpa kartu kredit**. Struktur hasil akhir:

```
Frontend (15 tool)  →  Vercel (Hobby, gratis)          →  https://xxx.vercel.app
Server API (Fase 2) →  Hugging Face Spaces (CPU free)  →  https://xxx.hf.space
```

Server di cloud memakai Linux + LibreOffice headless untuk Office→PDF
(menggantikan Microsoft Office COM yang hanya ada di Windows). OCR tetap
RapidOCR. File upload tetap dihapus otomatis setelah diproses.

> ⚠️ **Baca dulu (jujur):** di versi cloud, file yang Anda proses pergi ke
> server Hugging Face lewat internet (bukan lagi "tidak pernah meninggalkan
> perangkat"). Space bersifat **publik** — siapa pun dengan URL bisa memakai
> API-nya (rate limit 30/menit/IP tetap aktif). Untuk uji coba, gunakan file
> dummy, bukan dokumen produksi.

---

## Bagian 1 — Server API (Hugging Face Spaces)

1. Daftar akun gratis: https://huggingface.co/join (verifikasi email).
2. Login, lalu buka https://huggingface.co/new-space
   - **Space name**: `pdf-converter-api`
   - **License**: MIT
   - **SDK**: pilih **Docker**
   - Klik **Create Space**
3. Buka tab **Files** → tombol **Add file** → **Upload files** → seret
   **semua file di folder `server\`** di komputer Anda (dari
   `C:\Users\Halim-Ops\Documents\Python\Workplace\PDF Converter\server\`):
   `main.py`, `Dockerfile`, `requirements-linux.txt`, `requirements.txt`,
   `run.bat`, `README.md`, `.dockerignore` → **Commit to main**.
4. Build dimulai otomatis — kira-kira **10–20 menit** untuk pertama kali
   (instal dependensi Python + LibreOffice). Halaman Space menampilkan
   status *"Building…"*. Jangan ditutup.
5. Setelah jadi, buka di browser:
   `https://halim-pdf-converter-api.hf.space/api/health`
   → harus menampilkan `{"status":"ok"}`
6. (Opsional) Tab **Settings → Variables and secrets**, tambahkan:
   - `ALLOWED_ORIGINS` = `https://<nama-proyek-vercel>.vercel.app`
     (batasi pemakaian API hanya dari situs Anda)
   - `RATE_MAX` = `0` (kalau Anda sering kena "Terlalu banyak permintaan")

## Bagian 2 — Aplikasi web (Vercel)

1. Daftar akun gratis: https://vercel.com/signup (email; kartu tidak
   diperlukan untuk Hobby).
2. Di VS Code, buka terminal di folder project
   (`C:\Users\Halim-Ops\Documents\Python\Workplace\PDF Converter`):
   ```powershell
   npx vercel login
   ```
   Browser terbuka untuk login → kembali ke VS Code bila diminta.
3. Deploy pertama (wizard — semua bisa Enter/default):
   ```powershell
   npx vercel
   ```
   Saat wizard bertanya *"Set up and develop?"* / nama project / direktori,
   tekan Enter saja. Saat ditanya **Environment Variables**, tambahkan:
   ```
   NEXT_PUBLIC_PDF_SERVER_URL = https://halim-pdf-converter-api.hf.space
   ```
   (Terlewat? Set nanti di dashboard Vercel → project → Settings →
   Environment Variables → tambahkan → lalu `npx vercel --prod` lagi.)
4. Deploy ke produksi:
   ```powershell
   npx vercel --prod
   ```
5. Buka URL yang diberikan (`https://<nama>.vercel.app`).

## Bagian 3 — Verifikasi

- Halaman depan: badge alat server berubah dari "server lokal" menjadi
  "server", dan teks hero berubah jadi versi cloud.
- Buka `/tools/protect` → unggah PDF → beri password → Unduh: harus jalan
  **tanpa server lokal**.
- Coba `/tools/ocr` (file scan) dan `/tools/office-to-pdf` (file .docx).

## Catatan jujur (yang perlu Anda tahu)

| Hal | Keterangan |
|---|---|
| Privasi | File transit ke server HF — bukan lagi 100% lokal. Jangan pakai dokumen produksi. |
| Space publik | URL API bisa dipakai siapa pun; rate limit tetap aktif. |
| Cold start | Space tidur setelah ±48 jam idle → pemakaian pertama ±1 menit (lambat), setelah itu cepat. |
| OCR/kompres | CPU bersama cloud lebih lambat dari mesin lokal Anda. |
| Office→PDF | Cloud memakai LibreOffice (hasil bisa sedikit beda dari Microsoft Word). |
| Ketersediaan | Gratis = tanpa SLA; Hugging Face/Vercel bisa berubah kebijakan sewaktu-waktu. |

## Tetap jalan lokal?

Ya. Tanpa env `NEXT_PUBLIC_PDF_SERVER_URL`, aplikasi kembali ke
`localhost:8123` seperti biasa. Versi lokal dan cloud tidak saling
mengganggu.
