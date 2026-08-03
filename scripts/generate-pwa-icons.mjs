import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import sharp from "sharp";

const BRAND_BLUE = "#0070f3";
const WHITE = "#ffffff";
const OUTPUT_DIR = path.join(process.cwd(), "public/icons");

async function createIcon(size, maskable = false) {
  const padding = maskable ? Math.round(size * 0.1) : Math.round(size * 0.18);
  const innerSize = size - padding * 2;
  const radius = maskable ? Math.round(size * 0.2) : Math.round(innerSize * 0.22);
  const fontSize = Math.round(innerSize * 0.34);

  const svg = `
    <svg width="${size}" height="${size}" viewBox="0 0 ${size} ${size}" xmlns="http://www.w3.org/2000/svg">
      <rect width="${size}" height="${size}" fill="${maskable ? BRAND_BLUE : "transparent"}" />
      <rect x="${padding}" y="${padding}" width="${innerSize}" height="${innerSize}" rx="${radius}" fill="${BRAND_BLUE}" />
      <text
        x="50%"
        y="54%"
        text-anchor="middle"
        dominant-baseline="middle"
        fill="${WHITE}"
        font-family="Arial, Helvetica, sans-serif"
        font-size="${fontSize}"
        font-weight="700"
      >AP</text>
    </svg>
  `;

  const suffix = maskable ? "-maskable" : "";
  const filename = `icon-${size}${suffix}.png`;

  await sharp(Buffer.from(svg)).png().toFile(path.join(OUTPUT_DIR, filename));
  return filename;
}

async function createAppleTouchIcon() {
  const size = 180;
  const padding = Math.round(size * 0.18);
  const innerSize = size - padding * 2;
  const radius = Math.round(innerSize * 0.22);
  const fontSize = Math.round(innerSize * 0.34);

  const svg = `
    <svg width="${size}" height="${size}" viewBox="0 0 ${size} ${size}" xmlns="http://www.w3.org/2000/svg">
      <rect width="${size}" height="${size}" fill="${BRAND_BLUE}" />
      <rect x="${padding}" y="${padding}" width="${innerSize}" height="${innerSize}" rx="${radius}" fill="${WHITE}" fill-opacity="0.12" />
      <text
        x="50%"
        y="54%"
        text-anchor="middle"
        dominant-baseline="middle"
        fill="${WHITE}"
        font-family="Arial, Helvetica, sans-serif"
        font-size="${fontSize}"
        font-weight="700"
      >AP</text>
    </svg>
  `;

  await sharp(Buffer.from(svg))
    .png()
    .toFile(path.join(OUTPUT_DIR, "apple-touch-icon.png"));
}

async function createFavicon() {
  const size = 32;
  const svg = `
    <svg width="${size}" height="${size}" viewBox="0 0 ${size} ${size}" xmlns="http://www.w3.org/2000/svg">
      <rect width="${size}" height="${size}" rx="6" fill="${BRAND_BLUE}" />
      <text
        x="50%"
        y="56%"
        text-anchor="middle"
        dominant-baseline="middle"
        fill="${WHITE}"
        font-family="Arial, Helvetica, sans-serif"
        font-size="11"
        font-weight="700"
      >AP</text>
    </svg>
  `;

  const png = await sharp(Buffer.from(svg)).png().toBuffer();
  await writeFile(path.join(process.cwd(), "public/favicon.ico"), png);
}

await mkdir(OUTPUT_DIR, { recursive: true });
await Promise.all([
  createIcon(192),
  createIcon(192, true),
  createIcon(512),
  createIcon(512, true),
  createAppleTouchIcon(),
  createFavicon(),
]);

console.log("Generated PWA icons in public/icons");
