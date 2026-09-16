/**
 * Konfigurasi app. Server lokal Fase 2 — satu port tetap per alat
 * (konvensi workspace), hanya bind localhost.
 * 
 * Desktop (Electron): embedded server di port 8123.
 */
export const PDF_SERVER_URL =
  process.env.NEXT_PUBLIC_PDF_SERVER_URL ?? "http://localhost:8123";

/** Build desktop (Electron): tool yang butuh server disembunyikan. */
export const IS_DESKTOP_BUILD = process.env.NEXT_PUBLIC_DESKTOP_BUILD === "1";

/** Embedded server URL untuk desktop (di-set oleh main.js via window.desktop). */
export const EMBEDDED_SERVER_URL = "http://127.0.0.1:8123";

/** Cek apakah server tersedia (digunakan untuk enable/disable tools server-side). */
export async function checkServerAvailable(
  url: string = PDF_SERVER_URL
): Promise<boolean> {
  try {
    const res = await fetch(`${url}/api/health`, {
      method: "GET",
      signal: AbortSignal.timeout(2000),
    });
    return res.ok;
  } catch {
    return false;
  }
}