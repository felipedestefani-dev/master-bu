import { bannerHref } from "./banners.mjs";
import { plain, slugId } from "./text.mjs";

export const TAB_ICONS = [
  { id: "home", label: "Casa", src: "/assets/icons/home.png" },
  { id: "cards", label: "Cartas", src: "/assets/icons/avulsos.png" },
  { id: "presale", label: "Relógio", src: "/assets/icons/prevenda.png" },
  { id: "sealed", label: "Pacote", src: "/assets/icons/lacrados.png" },
  { id: "sets", label: "Listas", src: "/assets/icons/sets.png" },
  { id: "contact", label: "Conversa", src: "/assets/icons/contact.png" },
  { id: "info", label: "Informação", src: "/assets/icons/info.png" },
  { id: "tag", label: "Etiqueta", src: "/assets/icons/tag.png" },
];

export const DEFAULT_TABS = [
  { id: "inicio", label: "Início", href: "#/", icon: "/assets/icons/home.png", sort: 0 },
  { id: "avulsos", label: "Avulsos", href: "#/avulsos", icon: "/assets/icons/avulsos.png", sort: 1 },
  { id: "prevenda", label: "Pré-venda", href: "#/prevenda", icon: "/assets/icons/prevenda.png", sort: 2 },
  { id: "lacrados", label: "Lacrados", href: "#/lacrados", icon: "/assets/icons/lacrados.png", sort: 3 },
  { id: "colecoes", label: "Coleções", href: "#/colecoes", icon: "/assets/icons/sets.png", sort: 4 },
  { id: "contato", label: "Contato", href: "#/contato", icon: "/assets/icons/contact.png", sort: 5 },
];

export function publicTabs(rows) {
  const source = Array.isArray(rows) && rows.length ? rows : DEFAULT_TABS;
  return source
    .filter((row) => row && bannerHref(row.href) && row.label)
    .slice()
    .sort((a, b) => Number(a.sort) - Number(b.sort) || String(a.label).localeCompare(String(b.label), "pt"));
}

export function buildTab(input = {}, tabs = []) {
  const label = plain(input.label, 40);
  const href = bannerHref(input.href);
  const icon = TAB_ICONS.some((item) => item.src === input.icon) ? input.icon : TAB_ICONS[0].src;
  if (!label) return { ok: false, error: "Dê um nome à aba." };
  if (!href) return { ok: false, error: "O link precisa começar com https:// ou #/." };
  const cleanId = slugId(input.id || label, 40).toLowerCase();
  if (!/^[a-z0-9-]{1,40}$/.test(cleanId)) return { ok: false, error: "O código da aba só pode ter letras, números e hífen." };
  const sort = input.sort != null && input.sort !== ""
    ? Math.round(Number(input.sort) || 0)
    : (tabs || []).reduce((max, item) => Math.max(max, Number(item.sort) || 0), -1) + 1;
  return { ok: true, row: { id: cleanId, label, href, icon, sort } };
}

export function reorderTabs(list, id, dir) {
  const rows = publicTabs(list);
  const index = rows.findIndex((item) => item.id === id);
  const next = index + dir;
  if (index < 0 || next < 0 || next >= rows.length) return null;
  const swap = rows[index];
  rows[index] = rows[next];
  rows[next] = swap;
  return rows.map((item, order) => ({ ...item, sort: order }));
}
