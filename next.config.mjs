import { readFileSync } from "fs";

/** @type {import('next').NextConfig} */

// Build desktop: `npm run desktop:export` menyuntik NEXT_PUBLIC_DESKTOP_BUILD=1
// → output export statis (dimuat Electron via protocol app://). Build web
// normal (Vercel / next start) tetap memakai server Next.js default.
const isDesktop = process.env.NEXT_PUBLIC_DESKTOP_BUILD === "1";

const pkg = JSON.parse(
  readFileSync(new URL("./package.json", import.meta.url), "utf8")
);

const nextConfig = {
  ...(isDesktop && { output: "export" }),
  env: {
    // Satu sumber versi: package.json → tampil di footer (web & desktop).
    NEXT_PUBLIC_APP_VERSION: pkg.version,
  },
};

export default nextConfig;
