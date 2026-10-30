import { sealedKind } from "./sealed-match.mjs";
import { correctSealedImage } from "./sealed.mjs";

export const PHOTO_MAX_SIDE = 900;
export const PHOTO_QUALITY = 0.82;
export const BANNER_MAX_WIDTH = 1440;
export const BANNER_PC_MAX_WIDTH = 2880;
export const BANNER_ART_SIDE = 800;
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

function sentArt(product) {
  if (!product?.name) return "";
  const fixed = correctSealedImage({
    label: sealedKind(product.name),
    name: product.name,
    image: "",
    productId: product.id,
  });
  const image = String(fixed?.image || "");
  return image.startsWith("/assets/") ? image : "";
}

const THERASTAL_BOX_PHOTO = "/assets/products/sealed-sv8pt5-therastal-c.png";
const THERASTAL_BOX_MARK = "H/K/rIKyPGdh+1yvDbJQAAejRnAxkhc/mK3u60sX9VQSS3pG8XY/ZRm1cI9qMH4krtZVQ5BbG0EK5/MF";

const CAOS_MASTER_PHOTO = "/assets/products/master-me4-caos.png";
const CAOS_MASTER_MARK = "03ZzEFfLsu4C5zDmgvxdmH+4923tOyi7tzfmBzUh8LZGCItBYOVja2hFjlbmuvU8Gv8u3/2ribUkVQuA";

export function masterPhoto(product) {
  const saved = String(product?.image || "");
  if (saved.includes(CAOS_MASTER_MARK)) return CAOS_MASTER_PHOTO;
  return saved;
}

export function productImage(product) {
  const raw = String(product?.image || "");
  if (raw.includes(THERASTAL_BOX_MARK)) return THERASTAL_BOX_PHOTO;
  const saved = sanitizeImage(plainArt(raw));
  const catalog = /^https:\/\/tcgplayer-cdn\.tcgplayer\.com\//.test(saved);
  if (saved && !catalog) return saved;
  const sent = sentArt(product);
  if (sent) return sent;
  if (saved) return saved;
  if (!product || product.kind === "sealed" || !product.number || !product.set_id) return "";
  const file = artFile(product.number);
  if (!file) return "";
  return `https://images.pokemontcg.io/${encodeURIComponent(product.set_id)}/${encodeURIComponent(file)}.png`;
}
