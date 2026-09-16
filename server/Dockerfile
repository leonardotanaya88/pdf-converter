# PDF Converter API — image untuk Hugging Face Spaces (CPU gratis).
# OCR: RapidOCR (PaddleOCR-v3 via ONNX). Office→PDF: LibreOffice headless.
FROM python:3.11-slim

# LibreOffice tanpa GUI untuk konversi Word/Excel/PowerPoint + font dasar.
RUN apt-get update && apt-get install -y --no-install-recommends \
    libreoffice-writer \
    libreoffice-calc \
    libreoffice-impress \
    fonts-dejavu-core \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /app

COPY requirements-linux.txt ./
RUN pip install --no-cache-dir -r requirements-linux.txt

COPY . .

# HF Spaces mengharuskan aplikasi listen di port 7860.
ENV PORT=7860
EXPOSE 7860

CMD ["uvicorn", "main:app", "--host", "0.0.0.0", "--port", "7860"]
