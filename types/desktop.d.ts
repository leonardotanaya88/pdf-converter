/**
 * API desktop (Electron preload) — hanya ada di aplikasi desktop.
 * Halaman web memeriksa `window.desktop` sebelum memakai.
 */
export {};

declare global {
  interface Window {
    desktop?: {
      /** Baca file dari disk (untuk viewer — file dibuka dari OS). */
      readFile(filePath: string): Promise<{
        data: Uint8Array<ArrayBuffer>;
        name: string;
      }>;
      /** Dialog "Buka PDF" — kembalikan path atau null. */
      openFileDialog(): Promise<string | null>;
      /** Versi aplikasi (package.json). */
      getVersion(): Promise<string>;
      /** Status server lokal (embedded). */
      getServerStatus(): Promise<{
        ready: boolean;
        url: string;
      }>;
      /** Restart server lokal. */
      restartServer(): Promise<{
        ready: boolean;
        url: string;
      }>;
    };
  }
}