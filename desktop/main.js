/**
 * PDF Converter — Electron main process.
 *
 * Build desktop memakai hasil `next build` dengan output export statis
 * (out/). Halaman dimuat lewat protocol kustom `app://` (bukan file://)
 * supaya modul ESM hasil export bekerja normal.
 *
 * Buka file PDF: installer mendaftarkan handler .pdf (file association);
 * saat aplikasi dipanggil dengan path file, path diteruskan ke viewer
 * via query string. Single-instance lock mencegah dua window.
 *
 * Embedded server: Python FastAPI (PyInstaller exe) di-spawn saat startup
 * untuk 5 tools server-side (kompres, lindungi, buka kunci, OCR, office→PDF).
 *
 * Jalankan dev:  ELECTRON_START_URL=http://localhost:3001 electron .
 * Build rilis:  npm run desktop:build  (lihat package.json)
 */
const {
  app,
  BrowserWindow,
  Menu,
  dialog,
  ipcMain,
  protocol,
} = require("electron");
const path = require("path");
const fs = require("fs");
const { spawn } = require("child_process");

const OUT_DIR = path.join(__dirname, "..", "out");
const ICON = path.join(__dirname, "..", "public", "icons", "icon-512.png");
const DEV_URL = process.env.ELECTRON_START_URL || null;

// Embedded server config
const SERVER_PORT = 8123;
const SERVER_HOST = "127.0.0.1";
const SERVER_URL = `http://${SERVER_HOST}:${SERVER_PORT}`;
let serverProcess = null;
let serverReady = false;

// Scheme `app` harus didaftarkan sebelum app ready.
if (!DEV_URL) {
  protocol.registerSchemesAsPrivileged([
    {
      scheme: "app",
      privileges: {
        standard: true,
        secure: true,
        supportFetchAPI: true,
        corsEnabled: true,
      },
    },
  ]);
}

let win = null;
let pendingFile = null;

function filePathFromArgs(argv) {
  for (const a of argv) {
    if (a && !a.startsWith("-") && /\.pdf$/i.test(a)) {
      const p = path.resolve(a);
      if (fs.existsSync(p)) return p;
    }
  }
  return null;
}

function openPdfPath(filePath) {
  if (!filePath) return;
  if (!win) {
    pendingFile = filePath;
    return;
  }
  if (win.isMinimized()) win.restore();
  // Host "local" wajib: scheme standard tidak boleh punya host kosong —
  // `app:///tools/read.html` justru di-parse jadi host="tools" → 404.
  win.loadURL(`app://local/tools/read.html?file=${encodeURIComponent(filePath)}`);
  win.focus();
}

const MIME = {
  ".html": "text/html; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".mjs": "text/javascript; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".json": "application/json",
  ".webmanifest": "application/manifest+json",
  ".svg": "image/svg+xml",
  ".png": "image/png",
  ".ico": "image/x-icon",
  ".woff2": "font/woff2",
};

function createWindow() {
  win = new BrowserWindow({
    width: 1280,
    height: 860,
    minWidth: 900,
    minHeight: 640,
    backgroundColor: "#FAFAF8",
    icon: ICON,
    title: "PDF Converter",
    webPreferences: {
      preload: path.join(__dirname, "preload.js"),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: false,
    },
  });

  if (DEV_URL) {
    win.loadURL(DEV_URL);
  } else {
    win.loadURL("app://local/index.html");
  }

  win.on("closed", () => {
    win = null;
  });
}

function buildMenu() {
  const template = [
    {
      label: "File",
      submenu: [
        {
          label: "Buka PDF…",
          accelerator: "CmdOrCtrl+O",
          click: async () => {
            const r = await dialog.showOpenDialog(win, {
              title: "Buka PDF",
              properties: ["openFile"],
              filters: [{ name: "PDF", extensions: ["pdf"] }],
            });
            if (!r.canceled && r.filePaths[0]) openPdfPath(r.filePaths[0]);
          },
        },
        { type: "separator" },
        { label: "Keluar", role: "quit" },
      ],
    },
    {
      label: "Tampilan",
      submenu: [
        { label: "Muat Ulang", role: "reload" },
        { label: "Developer Tools", role: "toggleDevTools" },
      ],
    },
    {
      label: "Bantuan",
      submenu: [
        {
          label: "Tentang PDF Converter",
          click: () => {
            dialog.showMessageBox(win, {
              type: "info",
              title: "Tentang",
              message: `PDF Converter v${app.getVersion()}`,
              detail:
                "Alat PDF di perangkat Anda — baca, gabung, pisah, watermark, dan lainnya.\nSemua file diproses lokal, tidak pernah dikirim ke mana pun.\n\nServer lokal (kompres, lindungi, buka kunci, OCR, Office→PDF) berjalan di latar belakang.",
              buttons: ["Tutup"],
            });
          },
        },
      ],
    },
  ];
  Menu.setApplicationMenu(Menu.buildFromTemplate(template));
}

// IPC — renderer membutuhkan isi file untuk viewer (?file= dari OS).
ipcMain.handle("read-file", async (_e, filePath) => {
  const buf = await fs.promises.readFile(filePath);
  return { data: new Uint8Array(buf), name: path.basename(filePath) };
});

ipcMain.handle("open-file-dialog", async () => {
  const r = await dialog.showOpenDialog(win, {
    title: "Buka PDF",
    properties: ["openFile"],
    filters: [{ name: "PDF", extensions: ["pdf"] }],
  });
  return r.canceled || !r.filePaths[0] ? null : r.filePaths[0];
});

ipcMain.handle("app-version", () => app.getVersion());

// Server status IPC
ipcMain.handle("server-status", () => ({
  ready: serverReady,
  url: SERVER_URL,
}));

ipcMain.handle("server-restart", async () => {
  await stopServer();
  await startServer();
  return { ready: serverReady, url: SERVER_URL };
});

function getServerExePath() {
  if (DEV_URL) {
    // Dev mode: server dijalankan manual terpisah
    return null;
  }
  // Bundled: extraResources/server/pdf-converter-server.exe
  const base = path.dirname(app.getPath("exe"));
  return path.join(base, "server", "pdf-converter-server.exe");
}

function waitForServerReady(timeoutMs = 30000) {
  return new Promise((resolve) => {
    const start = Date.now();
    const check = async () => {
      try {
        const res = await fetch(`${SERVER_URL}/api/health`, {
          method: "GET",
          signal: AbortSignal.timeout(2000),
        });
        if (res.ok) {
          serverReady = true;
          console.log("[Server] Ready at", SERVER_URL);
          resolve(true);
          return;
        }
      } catch (_) {
        // ignore, retry
      }
      if (Date.now() - start > timeoutMs) {
        console.error("[Server] Timeout waiting for server");
        resolve(false);
        return;
      }
      setTimeout(check, 500);
    };
    check();
  });
}

async function startServer() {
  if (DEV_URL) {
    console.log("[Server] Dev mode — server tidak di-spawn otomatis");
    // Cek apakah server manual sudah jalan
    try {
      const res = await fetch(`${SERVER_URL}/api/health`, {
        method: "GET",
        signal: AbortSignal.timeout(2000),
      });
      if (res.ok) {
        serverReady = true;
        console.log("[Server] Manual server detected at", SERVER_URL);
      }
    } catch (_) {
      serverReady = false;
    }
    return;
  }

  const exePath = getServerExePath();
  if (!exePath || !fs.existsSync(exePath)) {
    console.error("[Server] Executable tidak ditemukan:", exePath);
    serverReady = false;
    return;
  }

  console.log("[Server] Starting:", exePath);

  // Spawn server process
  serverProcess = spawn(exePath, [], {
    stdio: ["ignore", "pipe", "pipe"],
    windowsHide: true,
    env: {
      ...process.env,
      PDF_SERVER_HOST: SERVER_HOST,
      PDF_SERVER_PORT: String(SERVER_PORT),
      ALLOWED_ORIGINS: "app://local,http://localhost:3001",
      RATE_MAX: "0", // disable rate limit di desktop
    },
  });

  serverProcess.stdout?.on("data", (data) => {
    console.log("[Server]", data.toString().trim());
  });

  serverProcess.stderr?.on("data", (data) => {
    console.error("[Server ERR]", data.toString().trim());
  });

  serverProcess.on("exit", (code, signal) => {
    console.log("[Server] Exited:", code, signal);
    serverReady = false;
    serverProcess = null;
  });

  serverProcess.on("error", (err) => {
    console.error("[Server] Spawn error:", err);
    serverReady = false;
    serverProcess = null;
  });

  // Wait for server to be ready
  await waitForServerReady();
}

async function stopServer() {
  if (serverProcess) {
    console.log("[Server] Stopping...");
    serverProcess.kill("SIGTERM");
    // Force kill after 3s
    setTimeout(() => {
      if (serverProcess && !serverProcess.killed) {
        serverProcess.kill("SIGKILL");
      }
    }, 3000);
    serverProcess = null;
  }
  serverReady = false;
}

const gotLock = app.requestSingleInstanceLock();
if (!gotLock) {
  app.quit();
} else {
  app.on("second-instance", (_e, argv) => {
    const p = filePathFromArgs(argv) || pendingFile;
    if (win) {
      if (win.isMinimized()) win.restore();
      if (p) openPdfPath(p);
      win.focus();
    } else {
      pendingFile = p;
    }
  });

  app.whenReady().then(async () => {
    if (!DEV_URL) {
      // Serve out/ melalui protocol app:// (guard traversal).
      protocol.handle("app", (request) => {
        const url = new URL(request.url);
        let pathname = decodeURIComponent(url.pathname);
        if (pathname.endsWith("/")) pathname += "index.html";
        // Navigasi Next.js meminta /tools/read tanpa .html — tambahkan
        // ekstensi untuk path tanpa ekstensi, kalau tidak 404.
        else if (!path.extname(pathname)) pathname += ".html";
        const target = path.normalize(path.join(OUT_DIR, pathname));
        if (!target.startsWith(OUT_DIR)) {
          return new Response("Forbidden", { status: 403 });
        }
        if (!fs.existsSync(target)) {
          return new Response("Not found", { status: 404 });
        }
        const ext = path.extname(target).toLowerCase();
        return new Response(fs.readFileSync(target), {
          headers: {
            "content-type": MIME[ext] || "application/octet-stream",
            "Access-Control-Allow-Origin": "*",
            "Cache-Control": "no-cache",
          },
        });
      });
    }

    // Start embedded server BEFORE creating window
    await startServer();

    createWindow();
    buildMenu();

    // File dari argv saat aplikasi baru diluncurkan (double-click PDF).
    const argvFile = filePathFromArgs(process.argv) || pendingFile;
    if (argvFile) openPdfPath(argvFile);

    app.on("activate", () => {
      if (BrowserWindow.getAllWindows().length === 0) createWindow();
    });
  });

  app.on("window-all-closed", () => {
    if (process.platform !== "darwin") app.quit();
  });

  // Cleanup server on quit
  app.on("before-quit", async () => {
    await stopServer();
  });
}