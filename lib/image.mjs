export const PHOTO_MAX_SIDE = 900;
export const PHOTO_QUALITY = 0.82;
export const BANNER_MAX_WIDTH = 1024;
export const BANNER_QUALITY = 0.86;
export const IMAGE_TEXT_MAX = 1_500_000;

export function artFile(number) {
  const file = String(number || "").split("/")[0].trim();
  if (/^0+\d+$/.test(file)) return String(Number(file));
  return file;
}

export function plainArt(url) {
  return String(url || "").replace(/\/0+(\d+)\.png(?=$|\?)/, (_, digits) => `/${Number(digits)}.png`);
}

export function isCardBack(width, height) {
  return width === 640 && height === 892;
}

export function setLogoSrc(id) {
  const clean = String(id || "").trim();
  if (!clean) return "";
  if (clean === "me6") return "/assets/products/me06-logo.png";
  return `https://images.pokemontcg.io/${encodeURIComponent(clean)}/logo.png`;
}

export function setLogoFallback(src, width, height) {
  const url = String(src || "");
  if (!url) return "";
  const bad = !width || isCardBack(width, height) || height > width;
  if (!bad) return url;
  if (url.includes("/logo.png")) return url.replace("/logo.png", "/symbol.png");
  return "";
}

export function sanitizeImage(url) {
  const value = String(url ?? "").replace(/[\u0000-\u001F\u007F]/g, "").trim();
  if (!value) return "";
  if (value.startsWith("data:image/jpeg;base64,")) {
    if (value.length > IMAGE_TEXT_MAX) return "";
    const body = value.slice("data:image/jpeg;base64,".length);
    if (!body || /[^A-Za-z0-9+/=]/.test(body)) return "";
    return value;
  }
  if (value.length > 500) return "";
  if (/^(https?:\/\/|\/assets\/|assets\/)/i.test(value) && !/[\s<>"']/.test(value)) return value;
  return "";
}

const PRODUCT_ART = {
  "sealed-684460": "/assets/products/sealed-me4-quad.png",
  "sealed-me5-etb": "/assets/products/sealed-me5-etb.webp",
  "sealed-me3-etb": "/assets/products/sealed-me3-etb.webp",
  "sealed-me55-etb-en": "/assets/products/sealed-me55-etb-en.webp",
  "sealed-sv3-etb": "/assets/products/sealed-sv3-etb.webp",
  "sealed-me6-etb": "/assets/products/me6-etb.jpg",
  "sealed-me1-upc-x": "/assets/products/sealed-me1-upc-x.jpg",
  "sealed-me1-charizard-y": "/assets/products/sealed-me1-charizard-y.jpg",
};

export function productImage(product) {
  const fixed = PRODUCT_ART[String(product?.id || "")];
  if (fixed) return fixed;
  const saved = sanitizeImage(plainArt(product?.image || ""));
  if (saved) return saved;
  if (!product || product.kind === "sealed" || !product.number || !product.set_id) return "";
  const file = artFile(product.number);
  if (!file) return "";
  return `https://images.pokemontcg.io/${encodeURIComponent(product.set_id)}/${encodeURIComponent(file)}.png`;
}
