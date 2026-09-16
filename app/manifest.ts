import type { MetadataRoute } from "next";

/** Manifest PWA — tool Fase 1 jalan tanpa internet (scope §8). */
export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "PDF Converter — Alat PDF di Browser",
    short_name: "PDF Converter",
    description:
      "Gabung, pisah, putar, watermark, dan lainnya — 100% di browser. File tidak pernah diupload.",
    start_url: "/",
    display: "standalone",
    background_color: "#FAFAF8",
    theme_color: "#185FA5",
    icons: [
      { src: "/icons/icon-192.png", sizes: "192x192", type: "image/png" },
      { src: "/icons/icon-512.png", sizes: "512x512", type: "image/png" },
    ],
  };
}
