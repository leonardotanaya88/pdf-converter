/**
 * Validasi file sebelum masuk store. Fail-loudly: file yang tidak valid
 * dilaporkan satu per satu, bukan diabaikan diam-diam.
 */

export interface ValidationResult {
  valid: File[];
  errors: string[];
}

/** accept: daftar MIME (contoh "application/pdf", "image/jpeg") */
export function validateFiles(
  files: File[],
  accept: string[],
  maxSizeMB: number
): ValidationResult {
  const valid: File[] = [];
  const errors: string[] = [];

  for (const f of files) {
    const mimeOk = accept.some((t) => {
      if (t.endsWith("/*")) return f.type.startsWith(t.slice(0, -1));
      return f.type === t || f.name.toLowerCase().endsWith(t.split("/")[1] ?? "");
    });
    const sizeOk = f.size <= maxSizeMB * 1024 * 1024;

    if (!mimeOk) {
      errors.push(`"${f.name}" — tipe file tidak didukung.`);
    } else if (!sizeOk) {
      errors.push(`"${f.name}" — melebihi batas ${maxSizeMB} MB.`);
    } else {
      valid.push(f);
    }
  }

  return { valid, errors };
}
