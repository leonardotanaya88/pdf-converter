"use client";

import { create } from "zustand";

/**
 * Store global per scope §3: file terpilih, status, error.
 * Satu store untuk semua tool — file yang sudah dipilih tetap tersedia
 * jika user berpindah tool (fondasi fitur pipeline scope §8).
 */

export interface FileItem {
  id: string;
  file: File;
}

export type ToolStatus = "idle" | "processing" | "done" | "error";

interface PdfToolState {
  files: FileItem[];
  status: ToolStatus;
  error: string | null;

  addFiles: (files: File[], replace?: boolean) => void;
  removeFile: (id: string) => void;
  clearFiles: () => void;
  reorderFiles: (fromIndex: number, toIndex: number) => void;
  setStatus: (status: ToolStatus) => void;
  setError: (error: string | null) => void;
  reset: () => void;
}

export const useFileStore = create<PdfToolState>((set) => ({
  files: [],
  status: "idle",
  error: null,

  addFiles: (files, replace = false) =>
    set((s) => {
      const items: FileItem[] = files.map((f) => ({
        id: crypto.randomUUID(),
        file: f,
      }));
      return {
        files: replace ? items : [...s.files, ...items],
        status: "idle",
        error: null,
      };
    }),

  removeFile: (id) =>
    set((s) => ({ files: s.files.filter((f) => f.id !== id) })),

  clearFiles: () => set({ files: [] }),

  reorderFiles: (fromIndex, toIndex) =>
    set((s) => {
      const arr = [...s.files];
      const [moved] = arr.splice(fromIndex, 1);
      arr.splice(toIndex, 0, moved);
      return { files: arr };
    }),

  setStatus: (status) => set({ status }),

  setError: (error) => set({ error }),

  reset: () => set({ files: [], status: "idle", error: null }),
}));
