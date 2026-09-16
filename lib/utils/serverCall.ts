import { PDF_SERVER_URL, IS_DESKTOP_BUILD, EMBEDDED_SERVER_URL } from "@/lib/config";

export interface ServerFileResult {
  blob: Blob;
  filename: string;
}

/**
 * Dapatkan URL server yang aktif:
 * - Desktop (embedded): http://127.0.0.1:8123
 * - Web (env): NEXT_PUBLIC_PDF_SERVER_URL atau localhost:8123
 */
export function getActiveServerUrl(): string {
  if (IS_DESKTOP_BUILD) {
    return EMBEDDED_SERVER_URL;
  }
  return PDF_SERVER_URL;
}

/**
 * Panggil server lokal Fase 2. File hasil tetap bisa diunduh sebagai blob;
 * upload di server dihapus otomatis setelah diproses.
 */
export async function callPdfServer(
  endpoint: string,
  formData: FormData
): Promise<ServerFileResult> {
  const serverUrl = getActiveServerUrl();
  let res: Response;
  try {
    res = await fetch(`${serverUrl}${endpoint}`, {
      method: "POST",
      body: formData,
    });
  } catch {
    const hint = IS_DESKTOP_BUILD
      ? "Server lokal belum siap — coba muat ulang aplikasi atau restart via menu Bantuan."
      : `Server PDF tidak merespons (${serverUrl}). Muat ulang halaman; untuk pemakaian lokal, jalankan server\\run.bat dulu.`;
    throw new Error(hint);
  }

  if (!res.ok) {
    let msg = `Server merespons ${res.status}.`;
    try {
      const json = await res.json();
      if (json?.detail) msg = String(json.detail);
    } catch {
      // body bukan JSON — pakai pesan default
    }
    throw new Error(msg);
  }

  const blob = await res.blob();
  const cd = res.headers.get("content-disposition") ?? "";
  const m = cd.match(/filename="?([^";]+)"?/i);
  return { blob, filename: m?.[1] ?? "hasil.pdf" };
}

/** Varian JSON (contoh: OCR mode teks → { pages: string[] }). */
export async function callPdfServerJson(
  endpoint: string,
  formData: FormData
): Promise<unknown> {
  const serverUrl = getActiveServerUrl();
  let res: Response;
  try {
    res = await fetch(`${serverUrl}${endpoint}`, {
      method: "POST",
      body: formData,
    });
  } catch {
    const hint = IS_DESKTOP_BUILD
      ? "Server lokal belum siap — coba muat ulang aplikasi atau restart via menu Bantuan."
      : `Server PDF tidak merespons (${serverUrl}). Muat ulang halaman; untuk pemakaian lokal, jalankan server\\run.bat dulu.`;
    throw new Error(hint);
  }
  if (!res.ok) {
    let msg = `Server merespons ${res.status}.`;
    try {
      const json = await res.json();
      if (json?.detail) msg = String(json.detail);
    } catch {
      // body bukan JSON
    }
    throw new Error(msg);
  }
  return res.json();
}