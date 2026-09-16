"use client";

import { useEffect } from "react";

/**
 * Daftarkan service worker (produksi saja) untuk PWA offline.
 * sw.js dibuat oleh scripts/gen-sw.js saat `npm run build`.
 */
export function RegisterSW() {
  useEffect(() => {
    if ("serviceWorker" in navigator && process.env.NODE_ENV === "production") {
      navigator.serviceWorker.register("/sw.js").catch(() => {
        // Non-fatal: app tetap jalan tanpa SW (mis. dev tanpa build).
      });
    }
  }, []);
  return null;
}
