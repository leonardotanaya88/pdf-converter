"""
PDF Converter — server Fase 2 (scope §7).

Pemakaian lokal: bind 127.0.0.1, port 8123 (jangan expose ke LAN).
Cloud (Hugging Face Spaces, gratis): bind 0.0.0.0:7860, atur env
ALLOWED_ORIGINS (asal frontend) dan RATE_MAX bila perlu.
File upload disimpan sementara lalu DIHAPUS segera setelah diproses;
file hasil dibersihkan otomatis oleh loop (maks 1 jam) + saat startup.

Menjalankan lokal:  python -m uvicorn main:app --host 127.0.0.1 --port 8123
Menjalankan bundled:  ./pdf-converter-server.exe
"""
import asyncio
import os
import shutil
import subprocess
import sys
import time
import uuid
from pathlib import Path

import fitz
from fastapi import FastAPI, File, Form, HTTPException, Request, UploadFile
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import FileResponse, JSONResponse


# ── Path handling untuk PyInstaller bundled mode ──────────────────────
def _get_base_path() -> Path:
    """Base path yang benar baik di dev maupun bundled (PyInstaller)."""
    if getattr(sys, "frozen", False):
        # PyInstaller: sys._MEIPASS = folder extract sementara
        return Path(sys._MEIPASS)
    return Path(__file__).resolve().parent


def _get_writable_dir() -> Path:
    """Folder writable untuk tmp files (AppData/Local di Windows)."""
    if getattr(sys, "frozen", False):
        # Bundled: pakai AppData/Local/PDF Converter/tmp
        base = Path(os.environ.get("LOCALAPPDATA", Path.home() / "AppData" / "Local"))
        return base / "PDF Converter" / "tmp"
    # Dev: server/tmp
    return _get_base_path() / "tmp"


BASE_PATH = _get_base_path()
TMP = _get_writable_dir()
TMP.mkdir(parents=True, exist_ok=True)

MAX_MB = 200
MAX_BYTES = MAX_MB * 1024 * 1024

# ── Config via env ────────────────────────────────────────────────────
# Host/port bisa di-override lewat env (berguna untuk testing)
HOST = os.environ.get("PDF_SERVER_HOST", "127.0.0.1")
PORT = int(os.environ.get("PDF_SERVER_PORT", "8123"))

# Origin diizinkan: env ALLOWED_ORIGINS (dipisah koma) atau "*" (default).
_origins = [
    o.strip()
    for o in os.environ.get("ALLOWED_ORIGINS", "*").split(",")
    if o.strip()
]

# Rate limit
RATE_WINDOW_S = 60
RATE_MAX = int(os.environ.get("RATE_MAX", "30"))
_hits: dict[str, list[float]] = {}

app = FastAPI(title="PDF Converter — server", version="0.2.0")

app.add_middleware(
    CORSMiddleware,
    allow_origins=_origins or ["*"],
    allow_methods=["POST", "GET"],
    allow_headers=["*"],
    expose_headers=["Content-Disposition"],
)


def _client_ip(request: Request) -> str:
    """IP sejati: hormati X-Forwarded-For saat ada (di belakang proxy cloud)."""
    xff = request.headers.get("x-forwarded-for")
    if xff:
        return xff.split(",")[0].strip() or (
            request.client.host if request.client else "?"
        )
    return request.client.host if request.client else "?"


def _rate_ok(ip: str) -> bool:
    if RATE_MAX <= 0:
        return True
    now = time.monotonic()
    hits = [t for t in _hits.get(ip, []) if now - t < RATE_WINDOW_S]
    hits.append(now)
    _hits[ip] = hits
    return len(hits) <= RATE_MAX


async def _cleanup_loop() -> None:
    while True:
        try:
            now = time.time()
            for f in TMP.iterdir():
                if f.is_file() and now - f.stat().st_mtime > 3600:
                    f.unlink(missing_ok=True)
        except Exception:
            pass
        await asyncio.sleep(600)


@app.on_event("startup")
async def _startup() -> None:
    # Bersihkan sisa file dari run yang mati mendadak.
    for f in TMP.iterdir():
        try:
            f.unlink(missing_ok=True)
        except Exception:
            pass
    asyncio.create_task(_cleanup_loop())


def _save_upload(file: UploadFile) -> Path:
    data = file.file.read(MAX_BYTES + 1)
    if len(data) > MAX_BYTES:
        raise HTTPException(413, f"File melebihi batas {MAX_MB} MB.")
    suffix = Path(file.filename or "file.pdf").suffix or ".pdf"
    p = TMP / f"{uuid.uuid4().hex}{suffix}"
    p.write_bytes(data)
    return p


def _open_pdf(path: Path) -> fitz.Document:
    try:
        return fitz.open(path)
    except Exception as e:
        raise HTTPException(400, f"File tidak bisa dibaca sebagai PDF: {e}")


@app.get("/api/health")
def health():
    return {"status": "ok"}


@app.get("/favicon.ico", include_in_schema=False)
def favicon():
    # Chrome meminta favicon per-origin; hindari 404 di console.
    ico = BASE_PATH.parent / "public" / "favicon.ico"
    if ico.exists():
        return FileResponse(ico, media_type="image/x-icon")
    # Fallback: return 204 No Content
    return JSONResponse(content=None, status_code=204)


# ── OCR: RapidOCR (ONNX, pip murni — tanpa install sistem) ────────────
# Catatan deviasi dari scope §2 ("OCR: Tesseract"): Tesseract tidak bisa
# diinstall tanpa admin di mesin ini (winget butuh UAC, conda-forge
# mati di repodata raksasa). RapidOCR = model PaddleOCR-v3, jalan
# server-side offline, akurasi sebanding — tetap prinsip yang sama.
import numpy as np

_ocr_engine = None


def _get_ocr() -> "RapidOCR":
    global _ocr_engine
    if _ocr_engine is None:
        from rapidocr_onnxruntime import RapidOCR

        _ocr_engine = RapidOCR()
    return _ocr_engine


def _page_to_bgr(page: fitz.Page) -> "np.ndarray":
    """Render halaman 200dpi → ndarray BGR (format yang dimengerti RapidOCR)."""
    pix = page.get_pixmap(dpi=200)
    rgb = np.frombuffer(pix.samples, dtype=np.uint8).reshape(
        pix.height, pix.width, pix.n
    )[:, :, :3]
    return rgb[:, :, ::-1]


def _ocr_page(page: fitz.Page) -> str:
    engine = _get_ocr()
    result, _ = engine(_page_to_bgr(page))
    if not result:
        return ""
    return "\n".join(str(item[1]) for item in result)


@app.post("/api/ocr")
def ocr(
    request: Request,
    file: UploadFile = File(...),
    mode: str = Form("searchable"),
):
    """
    mode "searchable" → PDF baru: halaman jadi gambar + teks tak terlihat
    (bisa dicari/dipilih, ala iLovePDF). mode "text" → JSON teks per halaman.
    """
    if not _rate_ok(_client_ip(request)):
        raise HTTPException(429, "Terlalu banyak permintaan — coba lagi sebentar.")

    src = _save_upload(file)
    out = src.with_suffix(".out.pdf")
    doc = None
    out_doc = None
    try:
        doc = _open_pdf(src)

        if mode == "text":
            pages = [_ocr_page(page) for page in doc]
            return JSONResponse({"pages": pages})

        # searchable: raster halaman + lapisan teks tak terlihat
        out_doc = fitz.open()
        for page in doc:
            rect = page.rect
            pix = page.get_pixmap(dpi=200)
            newpage = out_doc.new_page(width=rect.width, height=rect.height)
            newpage.insert_image(rect, pixmap=pix)
            text = _ocr_page(page)
            if text.strip():
                newpage.insert_textbox(
                    rect,
                    text,
                    fontsize=10,
                    fontname="helv",
                    render_mode=3,  # tak terlihat — hanya untuk cari/seleksi
                )
        out_doc.save(out, garbage=4, deflate=True)
    finally:
        if doc is not None:
            doc.close()
        if out_doc is not None:
            out_doc.close()
        src.unlink(missing_ok=True)

    return FileResponse(out, filename="ocr-searchable.pdf", media_type="application/pdf")


# ── Office → PDF: COM (Windows + Microsoft Office) / LibreOffice (Linux) ──
OFFICE_EXTS = (".docx", ".doc", ".xlsx", ".xls", ".pptx", ".ppt")


def _office2pdf_com(src: Path, out: Path, ext: str) -> None:
    """Windows: Microsoft Office yang terpasang via COM — tanpa install apa pun."""
    import win32com.client  # hanya di Windows; import lazy agar Linux aman

    prog_id = {
        ".docx": "Word.Application",
        ".doc": "Word.Application",
        ".xlsx": "Excel.Application",
        ".xls": "Excel.Application",
        ".pptx": "PowerPoint.Application",
        ".ppt": "PowerPoint.Application",
    }[ext]
    kind = (
        "word"
        if ext in (".docx", ".doc")
        else "excel"
        if ext in (".xlsx", ".xls")
        else "ppt"
    )

    app_com = win32com.client.DispatchEx(prog_id)
    app_com.Visible = False
    try:
        if kind == "word":
            app_com.DisplayAlerts = 0
            doc = app_com.Documents.Open(str(src), ReadOnly=True)
            try:
                doc.ExportAsFixedFormat(str(out), 17)  # wdExportFormatPDF
            finally:
                doc.Close(False)
        elif kind == "excel":
            app_com.DisplayAlerts = False
            wb = app_com.Workbooks.Open(str(src), ReadOnly=True)
            try:
                wb.ExportAsFixedFormat(0, str(out))  # xlTypePDF
            finally:
                wb.Close(False)
        else:
            deck = app_com.Presentations.Open(
                str(src), ReadOnly=True, WithWindow=False
            )
            try:
                deck.ExportAsFixedFormat(str(out), 2)  # ppFixedFormatTypePDF
            finally:
                deck.Close()
    finally:
        try:
            app_com.Quit()
        except Exception:
            pass


def _office2pdf_soffice(src: Path, out: Path) -> bool:
    """Linux (cloud) / fallback: LibreOffice headless. False = gagal/tidak ada."""
    soffice = shutil.which("soffice") or shutil.which("libreoffice")
    if soffice is None:
        return False
    try:
        result = subprocess.run(
            [
                soffice,
                "--headless",
                "--norestore",
                "--convert-to",
                "pdf",
                "--outdir",
                str(out.parent),
                str(src),
            ],
            capture_output=True,
            text=True,
            timeout=180,
        )
    except Exception:
        return False
    converted = out.parent / f"{src.stem}.pdf"
    if result.returncode != 0 or not converted.exists():
        return False
    converted.rename(out)
    return True


@app.post("/api/office2pdf")
def office2pdf(request: Request, file: UploadFile = File(...)):
    if not _rate_ok(_client_ip(request)):
        raise HTTPException(429, "Terlalu banyak permintaan — coba lagi sebentar.")

    src = _save_upload(file)
    out = src.with_suffix(".out.pdf")
    try:
        ext = src.suffix.lower()
        if ext not in OFFICE_EXTS:
            raise HTTPException(400, "Format tidak didukung: Word/Excel/PowerPoint saja.")

        if sys.platform == "win32":
            try:
                _office2pdf_com(src, out, ext)
            except Exception as e:
                # Office tidak tersedia/gagal → coba LibreOffice, lalu gagal jujur.
                if not _office2pdf_soffice(src, out):
                    raise HTTPException(500, f"Konversi Office gagal: {e}")
        else:
            if not _office2pdf_soffice(src, out):
                raise HTTPException(
                    500, "Konversi Office gagal — LibreOffice tidak tersedia di server."
                )
    finally:
        src.unlink(missing_ok=True)

    return FileResponse(out, filename="converted.pdf", media_type="application/pdf")


@app.post("/api/compress")
def compress(
    request: Request,
    file: UploadFile = File(...),
    quality: str = Form("medium"),
):
    if not _rate_ok(_client_ip(request)):
        raise HTTPException(429, "Terlalu banyak permintaan — coba lagi sebentar.")

    src = _save_upload(file)
    out = src.with_suffix(".out.pdf")
    doc = None
    try:
        doc = _open_pdf(src)
        # (max_dim, jpg_quality) — semakin rendah kualitas, semakin kecil.
        q = {"low": (900, 60), "medium": (1200, 75), "high": (1600, 85)}
        max_dim, jpg_q = q.get(quality, q["medium"])

        for page in doc:
            for img in page.get_images(full=True):
                xref = img[0]
                try:
                    pix = fitz.Pixmap(doc, xref)
                    if max(pix.width, pix.height) < 200:
                        continue  # gambar kecil tidak menguntungkan untuk dikompres
                    if max(pix.width, pix.height) > max_dim:
                        scale = max_dim / max(pix.width, pix.height)
                        pix = fitz.Pixmap(pix, fitz.Matrix(scale, scale))
                    jpg = pix.tobytes("jpeg", jpg_q)
                    page.replace_image(xref, jpg)
                except Exception:
                    continue  # best-effort; jangan pernah crash di satu gambar

        doc.save(out, garbage=4, deflate=True, clean=True)
    finally:
        # Windows: tutup handle fitz DULU sebelum hapus file, kalau tidak
        # unlink gagal (WinError 32) dan menutupi error asli.
        if doc is not None:
            doc.close()
        src.unlink(missing_ok=True)

    return FileResponse(out, filename="compressed.pdf", media_type="application/pdf")


@app.post("/api/protect")
def protect(
    request: Request,
    file: UploadFile = File(...),
    password: str = Form(...),
):
    if not _rate_ok(_client_ip(request)):
        raise HTTPException(429, "Terlalu banyak permintaan — coba lagi sebentar.")
    if len(password) < 4:
        raise HTTPException(400, "Kata sandi minimal 4 karakter.")

    src = _save_upload(file)
    out = src.with_suffix(".out.pdf")
    doc = None
    try:
        doc = _open_pdf(src)
        doc.save(
            out,
            encryption=fitz.PDF_ENCRYPT_AES_256,
            user_pw=password,
            owner_pw=password,
        )
    finally:
        if doc is not None:
            doc.close()
        src.unlink(missing_ok=True)

    return FileResponse(out, filename="protected.pdf", media_type="application/pdf")


@app.post("/api/unlock")
def unlock(
    request: Request,
    file: UploadFile = File(...),
    password: str = Form(...),
):
    if not _rate_ok(_client_ip(request)):
        raise HTTPException(429, "Terlalu banyak permintaan — coba lagi sebentar.")

    src = _save_upload(file)
    out = src.with_suffix(".out.pdf")
    doc = None
    try:
        doc = _open_pdf(src)
        if doc.needs_pass and not doc.authenticate(password):
            raise HTTPException(401, "Kata sandi salah.")
        doc.save(out)
    finally:
        if doc is not None:
            doc.close()
        src.unlink(missing_ok=True)

    return FileResponse(out, filename="unlocked.pdf", media_type="application/pdf")


# ── Entrypoint untuk bundled exe ──────────────────────────────────────
if __name__ == "__main__":
    import uvicorn

    uvicorn.run(
        app,
        host=HOST,
        port=PORT,
        log_level="info",
        # reload=False di bundled mode
        reload=False,
    )