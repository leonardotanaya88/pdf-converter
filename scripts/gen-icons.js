/**
 * Generate public/icons/icon-192.png & icon-512.png via headless Chrome.
 * Jalankan: node scripts/gen-icons.js
 * (membutuhkan puppeteer-core + Chrome, mis. di folder scratch yang sudah
 * punya puppeteer-core).
 */
const puppeteer = require("puppeteer-core");
const fs = require("fs");
const path = require("path");

const CHROME = "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe";
const OUT_DIR = path.join(__dirname, "..", "public", "icons");

function drawIcon(ctx, size) {
  const s = size / 64;
  // latar rounded
  ctx.fillStyle = "#185FA5";
  ctx.beginPath();
  ctx.roundRect(0, 0, size, size, 12 * s);
  ctx.fill();
  // dokumen
  ctx.fillStyle = "#ffffff";
  ctx.globalAlpha = 0.95;
  ctx.beginPath();
  ctx.roundRect(20 * s, 14 * s, 26 * s, 36 * s, 4 * s);
  ctx.fill();
  ctx.globalAlpha = 1;
  // lipatan
  ctx.strokeStyle = "#185FA5";
  ctx.lineWidth = 3 * s;
  ctx.lineJoin = "round";
  ctx.beginPath();
  ctx.moveTo(36 * s, 14 * s);
  ctx.lineTo(46 * s, 24 * s);
  ctx.stroke();
  // garis teks
  ctx.fillStyle = "#185FA5";
  for (const y of [32, 38, 44]) {
    ctx.beginPath();
    ctx.roundRect(24 * s, y * s, 18 * s, 2.4 * s, 1.2 * s);
    ctx.fill();
  }
}

(async () => {
  const browser = await puppeteer.launch({
    executablePath: CHROME,
    headless: true,
    args: ["--no-sandbox"],
  });
  const page = await browser.newPage();
  fs.mkdirSync(OUT_DIR, { recursive: true });

  for (const size of [192, 512]) {
    const drawFn = drawIcon.toString();
    const b64 = await page.evaluate(
      async (args) => {
        const c = document.createElement("canvas");
        c.width = args.size;
        c.height = args.size;
        const ctx = c.getContext("2d");
        const fn = eval("(" + args.fn + ")");
        fn(ctx, args.size);
        return c.toDataURL("image/png").split(",")[1];
      },
      { size, fn: drawFn }
    );
    fs.writeFileSync(path.join(OUT_DIR, `icon-${size}.png`), Buffer.from(b64, "base64"));
    console.log(`icon-${size}.png dibuat`);
  }
  await browser.close();
})();
