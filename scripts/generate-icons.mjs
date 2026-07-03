// Generates the PWA icons (public/icons/icon-192.png, icon-512.png) with no
// image dependencies: draws an RGBA buffer and encodes it as PNG by hand.
// Run with: node scripts/generate-icons.mjs
import { deflateSync } from "node:zlib";
import { mkdirSync, writeFileSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const crcTable = Array.from({ length: 256 }, (_, n) => {
  let c = n;
  for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
  return c >>> 0;
});

const crc32 = (buf) => {
  let c = 0xffffffff;
  for (const byte of buf) c = crcTable[(c ^ byte) & 0xff] ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
};

const chunk = (type, data) => {
  const len = Buffer.alloc(4);
  len.writeUInt32BE(data.length);
  const body = Buffer.concat([Buffer.from(type, "ascii"), data]);
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(crc32(body));
  return Buffer.concat([len, body, crc]);
};

const encodePNG = (pixels, size) => {
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(size, 0);
  ihdr.writeUInt32BE(size, 4);
  ihdr[8] = 8; // bit depth
  ihdr[9] = 6; // RGBA
  // rows prefixed with filter byte 0
  const raw = Buffer.alloc(size * (size * 4 + 1));
  for (let y = 0; y < size; y++) {
    pixels.copy(raw, y * (size * 4 + 1) + 1, y * size * 4, (y + 1) * size * 4);
  }
  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    chunk("IHDR", ihdr),
    chunk("IDAT", deflateSync(raw, { level: 9 })),
    chunk("IEND", Buffer.alloc(0)),
  ]);
};

const EMERALD = [5, 150, 105];
const LIGHT = [209, 250, 229]; // ruled lines on the page
const WHITE = [255, 255, 255];

// Signed distance to a rounded rectangle centered at (cx, cy).
const roundedRectSDF = (x, y, cx, cy, hw, hh, r) => {
  const qx = Math.abs(x - cx) - (hw - r);
  const qy = Math.abs(y - cy) - (hh - r);
  return (
    Math.min(Math.max(qx, qy), 0) +
    Math.hypot(Math.max(qx, 0), Math.max(qy, 0)) -
    r
  );
};

const drawIcon = (size) => {
  const px = Buffer.alloc(size * size * 4);
  const c = size / 2;
  // page: white rounded rect, portrait
  const pageHW = size * 0.26;
  const pageHH = size * 0.31;
  const pageR = size * 0.07;
  // ruled lines on the page
  const lineHW = size * 0.17;
  const lineHH = size * 0.022;
  const lineYs = [0.4, 0.5, 0.6].map((f) => size * f);
  // emerald "taka" dot: filled circle top-left of the page, like a coin
  const coinX = c + size * 0.16;
  const coinY = c - size * 0.2;
  const coinR = size * 0.085;

  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      let rgb = EMERALD;
      if (roundedRectSDF(x, y, c, c + size * 0.03, pageHW, pageHH, pageR) < 0) {
        rgb = WHITE;
        for (const ly of lineYs) {
          if (
            roundedRectSDF(x, y, c - size * 0.03, ly + size * 0.06, lineHW, lineHH, lineHH) < 0
          ) {
            rgb = LIGHT;
          }
        }
      }
      if (Math.hypot(x - coinX, y - coinY) < coinR) rgb = LIGHT;
      const i = (y * size + x) * 4;
      px[i] = rgb[0];
      px[i + 1] = rgb[1];
      px[i + 2] = rgb[2];
      px[i + 3] = 255;
    }
  }
  return encodePNG(px, size);
};

const outDir = join(
  dirname(fileURLToPath(import.meta.url)),
  "..",
  "public",
  "icons",
);
mkdirSync(outDir, { recursive: true });
for (const size of [192, 512]) {
  writeFileSync(join(outDir, `icon-${size}.png`), drawIcon(size));
  console.log(`wrote public/icons/icon-${size}.png`);
}
