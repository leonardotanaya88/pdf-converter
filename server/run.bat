@echo off
REM Jalankan server lokal Fase 2 (FastAPI + PyMuPDF) di port 8123.
cd /d "%~dp0"
python -m uvicorn main:app --host 127.0.0.1 --port 8123
