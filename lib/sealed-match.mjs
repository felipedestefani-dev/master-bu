import { fold } from "./text.mjs";

export const LABEL_ORDER = ["ETB", "BB", "Mini BB", "Quádruplo", "Triplo", "Unitário", "Blister", "Booster", "Bundle", "Box", "Mini Tin", "Coleção"];

const ALIASES = [
  ["evolucoes prismaticas", "prismatic evolutions"],
  ["fagulhas impetuosas", "surging sparks"],
  ["coroa estelar", "stellar crown"],
  ["mega evolucao", "mega evolution"],
  ["megaevolucao", "mega evolution"],
  ["escuridao absoluta", "pitch black"],
  ["caos ascendente", "chaos rising"],
  ["equilibrio perfeito", "perfect order"],
  ["herois excelsos", "ascended heroes"],
  ["fogo fantasmagorico", "phantasmal flames"],
  ["fogo branco", "white flare"],
  ["rivais predestinados", "destined rivals"],
  ["jornada conjunta", "journey together"],
  ["amigos de jornada", "journey together"],
  ["celebracoes", "30th celebration"],
  ["celebracao", "30th celebration"],
  ["30 anos", "30th celebration"],
  ["reinado delta", "delta reign"],
  ["obsidiana em chamas", "obsidian flames"],
  ["therastal", "prismatic evolutions"],
  ["terastal", "prismatic evolutions"],
  ["trick and trade", "trick or trade"],
  ["doces ou travessuras", "trick or trade"],
];

export function norm(value) {
  return fold(value).trim();
}

export function labelOf(name) {
  const text = String(name || "").toLowerCase();
  if (/code card|digital bundle|sam's club|costco/.test(text)) return "";
  if (/\bcase\b/.test(text) || /\bdisplay\b/.test(text)) return "";
  if (/\[set of|set of \d/.test(text)) return "";
  if (/\d+\s*\/\s*\d+/.test(text) || /\s-\s\d{2,3}\s*$/.test(text)) return "";
  if (/half booster box(?:es)?|mini booster box(?:es)?/.test(text)) return "Mini BB";
  if (/booster box/.test(text)) return "BB";
  if (/elite trainer box/.test(text)) return "ETB";
  if (/ultra[- ]premium collection/.test(text)) return "ETB";
  if (/premium checklane/.test(text)) return "Quádruplo";
  if (/3[ -]?pack blister/.test(text)) return "Triplo";
  if (/single pack blister/.test(text)) return "Unitário";
  if (/2-pack blister|\bblister\b/.test(text)) return "Blister";
  if (/mini booster pack|\bbooster pack\b|sleeved booster/.test(text)) return "Booster";
  if (/booster bundle/.test(text)) return "Bundle";
  if (/\bbooster\b/.test(text)) return "Booster";
  if (/mini tin/.test(text)) return "Mini Tin";
  if (/\btin\b/.test(text)) return "Box";
  if (/premium collection|super-premium collection|poster collection|binder collection|tech sticker|accessory pouch|figure collection|fun pack|pin collection/.test(text)) return "Coleção";
  if (/\bbox\b/.test(text) && !/booster pack/.test(text)) return "Box";
  return "";
}

export function sealedShelf(product) {
  const name = norm(typeof product === "string" ? product : product?.name);
  const setId = typeof product === "string" ? "" : String(product?.set_id || "");
  if (setId === "me6" || /reinado delta|delta reign/.test(name)) return "Reinado Delta";
  return sealedKind(name);
}

export function shelfOrder() {
  const order = [...LABEL_ORDER, "Outros"];
  const at = order.indexOf("ETB");
  order.splice(at + 1, 0, "Reinado Delta");
  return order;
}

export function sealedKind(name) {
  const text = norm(name);
  if (/mini booster|half booster|mini bb/.test(text)) return "Mini BB";
  if (/therastal|terastal/.test(text)) return "BB";
  if (/booster box/.test(text) || /(^|\s)bb(\s|$)/.test(text)) return "BB";
  if (/quadruplo|quad pack|checklane/.test(text)) return "Quádruplo";
  if (/triplo|triple pack|3[ -]?pack/.test(text)) return "Triplo";
  if (/unitario|single pack/.test(text)) return "Unitário";
  if (/treinador|elite trainer|(^|\s)etb(\s|$)|(^|\s)upc(\s|$)|ultra[- ]premium/.test(text)) return "ETB";
  if (/combo|bundle/.test(text)) return "Bundle";
  if (/mini tin/.test(text)) return "Mini Tin";
  if (/(^|\s)box(\s|$)|(^|\s)tin(\s|$)/.test(text)) return "Box";
  if (/booster/.test(text)) return "Booster";
  return labelOf(name) || "Outros";
}

export function matchesProduct(name, query) {
  const folded = norm(name);
  const terms = needles(query);
  if (terms.some((term) => term.length >= 3 && folded.includes(term))) return true;
  const words = norm(query).split(/\s+/).filter((word) => word.length >= 4);
  return words.length >= 2 && words.every((word) => folded.includes(word));
}

export function needles(query) {
  const base = norm(query);
  if (base.length < 2) return [];
  const extra = [];
  for (const [from, to] of ALIASES) {
    if (base.includes(from) || (base.length >= 3 && from.includes(base))) extra.push(to);
  }
  return [...new Set([base, ...extra])];
}

export function scoreGroup(group, needle) {
  const name = norm(group.name);
  const abbr = norm(group.abbreviation || "");
  if (abbr && abbr === needle) return 120;
  if (name === needle) return 100;
  const tail = name.split(":").pop().trim();
  if (tail && tail === needle) return 90;
  if (name.includes(needle)) return 40 + Math.min(needle.length, 24);
  return 0;
}

function groupYear(group) {
  return (norm(group.name).match(/\b(20\d{2})\b/) || [])[1] || "";
}

export function rankGroups(groups, query) {
  const terms = needles(query);
  if (!terms.length) return [];
  let ranked = (groups || [])
    .filter((group) => !group.isSupplemental)
    .map((group) => ({ group, score: Math.max(...terms.map((term) => scoreGroup(group, term))) }))
    .filter((item) => item.score >= 40)
    .sort((a, b) => b.score - a.score || norm(a.group.name).localeCompare(norm(b.group.name)));
  const year = (norm(query).match(/\b(20\d{2})\b/) || [])[1];
  if (year) {
    const dated = ranked.filter((item) => groupYear(item.group) === year);
    if (dated.length) ranked = dated;
  }
  return ranked.slice(0, 4);
}

export function sealedItems(groupsWithProducts) {
  const items = [];
  for (const { group, products } of groupsWithProducts || []) {
    for (const row of products || []) {
      const label = labelOf(row.name || "");
      if (!label || !row.imageUrl) continue;
      items.push({
        productId: row.productId,
        name: row.name,
        label,
        image: row.imageUrl,
        group: group.name,
      });
    }
  }
  items.sort((a, b) => LABEL_ORDER.indexOf(a.label) - LABEL_ORDER.indexOf(b.label) || String(a.name).localeCompare(String(b.name)));
  return items.slice(0, 160);
}
