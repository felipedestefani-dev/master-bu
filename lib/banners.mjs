import { sanitizeImage } from "./image.mjs";
import { esc, plain, slugId } from "./text.mjs";

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

export const SHELF_DEST = "aba:";
const SHELF_SCROLL = "loja-";

export function shelfDestination(row) {
  const scroll = String(row?.scroll || "");
  return scroll.startsWith(SHELF_SCROLL) ? `${SHELF_DEST}${scroll.slice(SHELF_SCROLL.length)}` : "";
}

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

export const AD_THEMES = [
  { id: "roxo", label: "Roxo" },
  { id: "delta", label: "Laranja e verde" },
  { id: "azul", label: "Azul e vermelho" },
];
const AD_FIELDS = ["tag", "title", "highlight", "sub", "cta"];
const AD_SCROLL = "anim:";

export function adBannerId(id) {
  return `${String(id || "").slice(0, 75)}-anim`;
}

export function bannerAds(rows) {
  const found = new Map();
  for (const row of rows || []) {
    const scroll = String(row?.scroll || "");
    if (!scroll.startsWith(AD_SCROLL) || !String(row.id || "").endsWith("-anim")) continue;
    const [theme, live] = scroll.slice(AD_SCROLL.length).split(":");
    const parts = String(row.label || "").split("|");
    const ad = { theme: AD_THEMES.some((item) => item.id === theme) ? theme : AD_THEMES[0].id, live: live === "live" };
    AD_FIELDS.forEach((key, index) => { ad[key] = parts[index] || ""; });
    found.set(String(row.id).slice(0, -5), ad);
  }
  return found;
}

export function buildAdBanner(id, input = {}) {
  const ad = {};
  for (const key of AD_FIELDS) ad[key] = plain(input[key], 120).replace(/\|/g, "/");
  if (!ad.title) return { ok: false, error: "Escreva o título do banner animado." };
  const label = AD_FIELDS.map((key) => ad[key]).join("|");
  if (label.length > 120) return { ok: false, error: "Os textos do banner animado passaram do limite. Encurte um pouco." };
  const theme = AD_THEMES.some((item) => item.id === input.theme) ? input.theme : AD_THEMES[0].id;
  if (!id) return { ok: false, error: "Dê um nome ao banner." };
  return { ok: true, row: { id: adBannerId(id), image: "", href: "#/", label, scroll: `${AD_SCROLL}${theme}${input.live ? ":live" : ""}`, sort: 0 } };
}

export function adHtml(ad, art, logo = "/assets/logo.png") {
  const cutout = /^(?!data:).*\.png(\?|$)/i.test(String(art || ""));
  return `<div class="ad-box"><div class="ad ad-${esc(ad.theme)}">
    <span class="ad-ring ad-r1"></span><span class="ad-ring ad-r2"></span>
    <div class="ad-art">${art ? `<img class="ad-pic${cutout ? "" : " is-card"}" src="${esc(art)}" alt="" />` : ""}${ad.live ? `<span class="ad-live">AO VIVO</span>` : ""}</div>
    ${ad.tag ? `<span class="ad-tag">${esc(ad.tag)}</span>` : ""}
    <strong class="ad-title"><span class="ad-l1">${esc(ad.title)}</span>${ad.highlight ? ` <span class="ad-hl">${esc(ad.highlight)}</span>` : ""}</strong>
    ${ad.sub ? `<span class="ad-sub">${esc(ad.sub)}</span>` : ""}
    <img class="ad-logo" src="${esc(logo)}" alt="" />
    ${ad.cta ? `<span class="ad-cta">${esc(ad.cta)}</span>` : ""}
  </div></div>`;
}

export function buildBanner(input = {}, banners = []) {
  const image = sanitizeImage(input.image);
  const label = plain(input.label, 120);
  const known = BANNER_DESTINATIONS.find((item) => item.id === input.dest);
  let href = "";
  let scroll = "";
  const shelf = String(input.dest || "").startsWith(SHELF_DEST) ? String(input.dest).slice(SHELF_DEST.length) : "";
  if (input.dest === "external") href = bannerHref(input.url || input.href);
  else if (shelf) {
    if (!/^[a-z0-9-]{1,24}$/.test(shelf)) return { ok: false, error: "Escolha uma aba válida." };
    href = "#/";
    scroll = `${SHELF_SCROLL}${shelf}`;
  } else if (known) {
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
