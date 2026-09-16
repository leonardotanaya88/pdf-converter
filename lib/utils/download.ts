import JSZip from "jszip";

/**
 * Unduh Blob dan revoke object URL setelahnya — mencegah memory leak
 * pada file besar (jebakan scope §10.4).
 */
export function downloadBlob(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 2000);
}

/**
 * Uint8Array hasil pdf-lib (tipe generik TS modern) → Blob.
 * Salin ke Uint8Array<ArrayBuffer> agar lolos tipe BlobPart.
 */
export function bytesToBlob(bytes: Uint8Array, type: string): Blob {
  return new Blob([new Uint8Array(bytes)], { type });
}

export async function downloadZip(
  items: { name: string; blob: Blob }[],
  zipName: string
) {
  const zip = new JSZip();
  items.forEach((item) => zip.file(item.name, item.blob));
  const blob = await zip.generateAsync({ type: "blob" });
  downloadBlob(blob, zipName);
}

export function bytesToSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}
