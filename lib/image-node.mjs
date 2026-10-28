import jpeg from "jpeg-js";
import { BANNER_MAX_WIDTH, BANNER_QUALITY, IMAGE_TEXT_MAX, PHOTO_MAX_SIDE, PHOTO_QUALITY, sanitizeImage } from "./image.mjs";

function resizeRgba(src, sw, sh, dw, dh) {
  const dst = Buffer.alloc(dw * dh * 4);
  for (let y = 0; y < dh; y += 1) {
    const sy = (y + 0.5) * sh / dh - 0.5;
    const y0 = Math.max(0, Math.floor(sy));
    const y1 = Math.min(sh - 1, y0 + 1);
    const yf = Math.min(1, Math.max(0, sy - y0));
    for (let x = 0; x < dw; x += 1) {
      const sx = (x + 0.5) * sw / dw - 0.5;
      const x0 = Math.max(0, Math.floor(sx));
      const x1 = Math.min(sw - 1, x0 + 1);
      const xf = Math.min(1, Math.max(0, sx - x0));
      for (let c = 0; c < 4; c += 1) {
        const p = (yy, xx) => src[(yy * sw + xx) * 4 + c];
        const value = p(y0, x0) * (1 - xf) * (1 - yf) + p(y0, x1) * xf * (1 - yf) + p(y1, x0) * (1 - xf) * yf + p(y1, x1) * xf * yf;
        dst[(y * dw + x) * 4 + c] = Math.max(0, Math.min(255, Math.round(value)));
      }
    }
  }
  return dst;
}

function encodeJpeg(data, width, height, quality) {
  const encoded = jpeg.encode({ data, width, height }, Math.round(quality * 100));
  const url = `data:image/jpeg;base64,${Buffer.from(encoded.data).toString("base64")}`;
  return url.length > IMAGE_TEXT_MAX ? "" : url;
}

export function resizeJpegDataUrl(dataUrl, { maxSide = PHOTO_MAX_SIDE, maxWidth = 0, quality = PHOTO_QUALITY } = {}) {
  const clean = sanitizeImage(dataUrl);
  if (!clean.startsWith("data:image/jpeg;base64,")) return "";
  let decoded;
  try {
    decoded = jpeg.decode(Buffer.from(clean.slice("data:image/jpeg;base64,".length), "base64"), { useTArray: true, formatAsRGBA: true });
  } catch {
    return "";
  }
  const { width, height, data } = decoded;
  if (!width || !height) return "";
  const scale = maxWidth
    ? Math.min(1, maxWidth / width)
    : Math.min(1, maxSide / Math.max(width, height));
  const dw = Math.max(1, Math.round(width * scale));
  const dh = Math.max(1, Math.round(height * scale));
  const pixels = scale === 1 ? data : resizeRgba(data, width, height, dw, dh);
  return encodeJpeg(pixels, dw, dh, quality);
}

export function resizeBannerDataUrl(dataUrl) {
  return resizeJpegDataUrl(dataUrl, { maxWidth: BANNER_MAX_WIDTH, quality: BANNER_QUALITY });
}
