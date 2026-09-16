---
title: PDF Converter API
emoji: 📄
colorFrom: blue
colorTo: blue
sdk: docker
app_port: 7860
pinned: false
license: mit
---

# PDF Converter API

Backend FastAPI untuk aplikasi **PDF Converter** (gratis, privacy-first).
Semua pemrosesan lokal di server ini; file upload dihapus segera setelah
diproses, file hasil dibersihkan otomatis (maks 1 jam).

## Endpoint

| Endpoint | Fungsi |
|---|---|
| `GET /api/health` | Cek hidup server |
| `POST /api/protect` | Enkripsi AES-256 (form: `file`, `password`) |
| `POST /api/unlock` | Hapus kata sandi (form: `file`, `password`) |
| `POST /api/compress` | Rekompresi gambar (form: `file`, `quality`) |
| `POST /api/ocr` | OCR (form: `file`, `mode` = `searchable`/`text`) |
| `POST /api/office2pdf` | Word/Excel/PowerPoint → PDF (form: `file`) |

Batas: 200 MB per file, rate limit per-IP (env `RATE_MAX`, 0 = nonaktif).

## Variabel lingkungan

| Env | Default | Fungsi |
|---|---|---|
| `ALLOWED_ORIGINS` | `*` | Origin frontend diizinkan, dipisah koma |
| `RATE_MAX` | `30` | Permintaan per menit per IP (0 = nonaktif) |

## Menjalankan lokal (Linux)

```bash
pip install -r requirements-linux.txt
uvicorn main:app --host 127.0.0.1 --port 8123
```

Di Windows pakai `requirements.txt` (COM Microsoft Office); Dockerfile
menggunakan LibreOffice headless yang diinstall di image.
