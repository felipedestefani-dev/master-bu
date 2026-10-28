import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import jpeg from "jpeg-js";
import { encodePng } from "./png.mjs";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const iconsDir = path.join(root, "assets", "icons");
fs.mkdirSync(iconsDir, { recursive: true });

function cutBackground(src, width, height) {
  const rgba = Buffer.from(src);
  const dark = (i) => rgba[i] < 42 && rgba[i + 1] < 42 && rgba[i + 2] < 42;
  const seen = new Uint8Array(width * height);
  const queue = [];
  const push = (x, y) => {
    if (x < 0 || y < 0 || x >= width || y >= height) return;
    const p = y * width + x;
    if (seen[p]) return;
    const i = p * 4;
    if (!dark(i)) return;
    seen[p] = 1;
    queue.push(p);
  };
  for (let x = 0; x < width; x += 1) {
    push(x, 0);
    push(x, height - 1);
  }
  for (let y = 0; y < height; y += 1) {
    push(0, y);
    push(width - 1, y);
  }
  for (let q = 0; q < queue.length; q += 1) {
    const p = queue[q];
    rgba[p * 4 + 3] = 0;
    const x = p % width;
    const y = (p - x) / width;
    push(x + 1, y);
    push(x - 1, y);
    push(x, y + 1);
    push(x, y - 1);
  }
  for (let y = 1; y < height - 1; y += 1) {
    for (let x = 1; x < width - 1; x += 1) {
      const p = y * width + x;
      const i = p * 4;
      if (!rgba[i + 3]) continue;
      const near = [p - 1, p + 1, p - width, p + width].some((n) => seen[n]);
      const max = Math.max(rgba[i], rgba[i + 1], rgba[i + 2]);
      const min = Math.min(rgba[i], rgba[i + 1], rgba[i + 2]);
      if (near && max < 170 && max - min < 28) rgba[i + 3] = 0;
    }
  }
  return rgba;
}

function trim(rgba, width, height, pad = 12) {
  let minX = width;
  let minY = height;
  let maxX = 0;
  let maxY = 0;
  for (let y = 0; y < height; y += 1) {
    for (let x = 0; x < width; x += 1) {
      if (rgba[(y * width + x) * 4 + 3] < 12) continue;
      if (x < minX) minX = x;
      if (y < minY) minY = y;
      if (x > maxX) maxX = x;
      if (y > maxY) maxY = y;
    }
  }
  minX = Math.max(0, minX - pad);
  minY = Math.max(0, minY - pad);
  maxX = Math.min(width - 1, maxX + pad);
  maxY = Math.min(height - 1, maxY + pad);
  const w = maxX - minX + 1;
  const h = maxY - minY + 1;
  const out = Buffer.alloc(w * h * 4);
  for (let y = 0; y < h; y += 1) {
    rgba.copy(out, y * w * 4, ((y + minY) * width + minX) * 4, ((y + minY) * width + maxX + 1) * 4);
  }
  return { rgba: out, width: w, height: h };
}

const jpg = fs.readFileSync(path.join(root, "assets", "logo.jpg"));
const decoded = jpeg.decode(jpg, { useTArray: true, formatAsRGBA: true });
const cut = cutBackground(decoded.data, decoded.width, decoded.height);
const logo = trim(cut, decoded.width, decoded.height);
fs.writeFileSync(path.join(root, "assets", "logo.png"), encodePng(logo.width, logo.height, logo.rgba));

const ORANGE = [232, 93, 4, 255];

function canvas() {
  return Buffer.alloc(64 * 64 * 4);
}

function plot(px, x, y, color = ORANGE) {
  if (x < 1 || y < 1 || x >= 63 || y >= 63) return;
  const i = (Math.round(y) * 64 + Math.round(x)) * 4;
  px[i] = color[0];
  px[i + 1] = color[1];
  px[i + 2] = color[2];
  px[i + 3] = color[3];
}

function disc(px, cx, cy, r) {
  for (let y = cy - r; y <= cy + r; y += 1) {
    for (let x = cx - r; x <= cx + r; x += 1) {
      if ((x - cx) ** 2 + (y - cy) ** 2 <= r * r) plot(px, x, y);
    }
  }
}

function box(px, x, y, w, h) {
  for (let yy = y; yy < y + h; yy += 1) {
    for (let xx = x; xx < x + w; xx += 1) plot(px, xx, yy);
  }
}

function clear(px, x, y, w, h) {
  for (let yy = y; yy < y + h; yy += 1) {
    for (let xx = x; xx < x + w; xx += 1) {
      if (xx < 0 || yy < 0 || xx >= 64 || yy >= 64) continue;
      px[(yy * 64 + xx) * 4 + 3] = 0;
    }
  }
}

function home() {
  const px = canvas();
  for (let i = 0; i < 22; i += 1) {
    box(px, 32 - i, 8 + i, i * 2, 1);
  }
  box(px, 16, 28, 32, 26);
  clear(px, 27, 38, 10, 16);
  return px;
}

function cards() {
  const px = canvas();
  box(px, 18, 8, 28, 48);
  clear(px, 24, 16, 16, 10);
  return px;
}

function presale() {
  const px = canvas();
  disc(px, 32, 34, 20);
  clear(px, 30, 18, 4, 16);
  clear(px, 30, 32, 14, 4);
  return px;
}

function sealed() {
  const px = canvas();
  box(px, 16, 18, 32, 36);
  for (let x = 16; x < 48; x += 4) box(px, x, 10, 2, 10);
  return px;
}

function sets() {
  const px = canvas();
  box(px, 14, 14, 28, 8);
  box(px, 18, 28, 28, 8);
  box(px, 22, 42, 28, 8);
  return px;
}

function contact() {
  const px = canvas();
  box(px, 10, 12, 44, 28);
  box(px, 18, 40, 8, 10);
  clear(px, 18, 22, 28, 4);
  return px;
}

function info() {
  const px = canvas();
  disc(px, 32, 32, 22);
  clear(px, 29, 18, 6, 6);
  clear(px, 29, 28, 6, 16);
  return px;
}

function tag() {
  const px = canvas();
  box(px, 12, 18, 28, 28);
  box(px, 36, 26, 16, 12);
  clear(px, 18, 28, 6, 6);
  return px;
}

const files = { home, cards, presale, sealed, sets, contact, info, tag };
for (const [name, draw] of Object.entries(files)) {
  fs.writeFileSync(path.join(iconsDir, `${name}.png`), encodePng(64, 64, draw()));
}

console.log(`logo ${logo.width}x${logo.height}`);
