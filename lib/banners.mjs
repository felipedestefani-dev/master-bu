import { sanitizeImage } from "./image.mjs";
import { plain, slugId } from "./text.mjs";

export const BANNERS_READY = { id: "__ready", image: "", href: "#/", label: "", scroll: "", sort: 1000 };

export const BANNER_DESTINATIONS = [
  { id: "prevenda", label: "Pré-venda", href: "#/prevenda", scroll: "" },
  { id: "lacrados", label: "Lacrados", href: "#/lacrados", scroll: "" },
  { id: "avulsos", label: "Avulsos", href: "#/avulsos", scroll: "" },
  { id: "alta", label: "Em alta", href: "#/alta", scroll: "" },
  { id: "catalogo", label: "Catálogo", href: "#/", scroll: "" },
  { id: "colecoes", label: "Coleções", href: "#/colecoes", scroll: "" },
  { id: "contato", label: "Contato", href: "#/contato", scroll: "" },
  { id: "sobre", label: "Sobre", href: "#/sobre", scroll: "" },
];

export function bannerHref(value) {
  const href = plain(value, 500);
  if (href.startsWith("#/") && !/[\s<>"']/.test(href)) return href;
  if (href === "#") return "#/";
  if (/^https:\/\/[^\s<>"']+$/i.test(href)) return href;
  return "";
}

export function publicBanners(rows) {
  return (rows || [])
    .filter((row) => row.id !== "__ready" && row.image && row.scroll !== "pc")
    .slice()
    .sort((a, b) => Number(a.sort) - Number(b.sort) || String(a.id).localeCompare(String(b.id)));
}

export function desktopBannerId(id) {
  return `${String(id || "").slice(0, 77)}-pc`;
}

export function desktopBanners(rows) {
  const found = new Map();
  for (const row of rows || []) {
    if (row?.scroll !== "pc" || !row.image || !String(row.id || "").endsWith("-pc")) continue;
    found.set(String(row.id).slice(0, -3), row.image);
  }
  return found;
}

export function buildDesktopBanner(id, image) {
  const clean = sanitizeImage(image);
  if (!id || !clean) return null;
  return { id: desktopBannerId(id), image: clean, href: "#/", label: "", scroll: "pc", sort: 0 };
}

export function buildBanner(input = {}, banners = []) {
  const image = sanitizeImage(input.image);
  const label = plain(input.label, 120);
  const known = BANNER_DESTINATIONS.find((item) => item.id === input.dest);
  let href = "";
  let scroll = "";
  if (input.dest === "external") href = bannerHref(input.url || input.href);
  else if (known) {
    href = known.href;
    scroll = known.scroll;
  } else href = bannerHref(input.href);
  if (!image) return { ok: false, error: "Escolha a imagem do banner." };
  if (!label) return { ok: false, error: "Dê um nome ao banner." };
  if (!href) return { ok: false, error: "O link precisa começar com https:// ou #/." };
  const id = input.id ? slugId(input.id, 80) || plain(input.id, 80) : `banner-${Date.now().toString(36)}`;
  const cleanId = String(id).replace(/[^a-z0-9_-]/gi, "").slice(0, 80);
  if (!cleanId) return { ok: false, error: "Dê um nome ao banner." };
  const sort = input.sort != null && input.sort !== ""
    ? Math.round(Number(input.sort) || 0)
    : (banners || []).reduce((max, item) => Math.max(max, Number(item.sort) || 0), -1) + 1;
  return { ok: true, row: { id: cleanId, image, href, label, scroll: plain(scroll, 40), sort } };
}

export function reorderBanners(list, id, dir) {
  const rows = (list || []).slice().sort((a, b) => Number(a.sort) - Number(b.sort) || String(a.id).localeCompare(String(b.id)));
  const index = rows.findIndex((item) => item.id === id);
  const next = index + dir;
  if (index < 0 || next < 0 || next >= rows.length) return null;
  const swap = rows[index];
  rows[index] = rows[next];
  rows[next] = swap;
  return rows.map((item, order) => ({ ...item, sort: order }));
}
