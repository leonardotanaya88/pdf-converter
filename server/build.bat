@echo off
REM Build script untuk PDF Converter Server (Windows x64)
REM Output: server/dist/pdf-converter-server.exe

cd /d "%~dp0"

echo ============================================
echo Building PDF Converter Server dengan PyInstaller
echo ============================================

REM Gunakan Python dari Hermes venv
SET VENV_PYTHON=C:\Users\Halim-Ops\AppData\Local\hermes\hermes-agent\venv\Scripts\python.exe
SET VENV_PIP=C:\Users\Halim-Ops\AppData\Local\hermes\hermes-agent\venv\Scripts\pip.exe
SET VENV_PYINSTALLER=C:\Users\Halim-Ops\AppData\Local\hermes\hermes-agent\venv\Scripts\pyinstaller.exe

IF NOT EXIST "%VENV_PYTHON%" (
    echo ERROR: Python venv tidak ditemukan di %VENV_PYTHON%
    echo Install Python atau update path di build.bat
    pause
    exit /b 1
)

REM Cek apakah PyInstaller terinstall
%VENV_PYTHON% -c "import PyInstaller" 2>nul
if errorlevel 1 (
    echo PyInstaller tidak ditemukan. Installing...
    %VENV_PIP% install pyinstaller
)

REM Install dependencies
echo Installing dependencies...
%VENV_PIP% install -r requirements.txt

REM Build dengan spec file
echo Building executable...
%VENV_PYINSTALLER% server.spec --clean --noconfirm

if errorlevel 1 (
    echo.
    echo BUILD GAGAL!
    pause
    exit /b 1
)

echo.
echo ============================================
echo BUILD BERHASIL!
echo Executable: dist\pdf-converter-server.exe
echo ============================================
echo.
echo Size:
dir dist\pdf-converter-server.exe
echo.
echo Untuk test: dist\pdf-converter-server.exe
echo (Server akan jalan di http://127.0.0.1:8123)
pause