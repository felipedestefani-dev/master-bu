import { fold } from "./text.mjs";

export const LABEL_ORDER = ["BB", "Mini BB", "Booster", "ETB", "UPC", "Bundle", "Box", "Mini Tin", "Coleção"];

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
  if (/half booster box|mini booster box/.test(text)) return "Mini BB";
  if (/booster box/.test(text)) return "BB";
  if (/elite trainer box/.test(text)) return "ETB";
  if (/ultra[- ]premium collection/.test(text)) return "UPC";
  if (/mini booster pack|\bbooster pack\b|sleeved booster/.test(text)) return "Booster";
  if (/booster bundle/.test(text)) return "Bundle";
  if (/\bbooster\b/.test(text)) return "Booster";
  if (/mini tin/.test(text)) return "Mini Tin";
  if (/premium collection|super-premium collection|poster collection/.test(text)) return "Coleção";
  if (/\bbox\b/.test(text) && !/booster pack/.test(text)) return "Box";
  return "";
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
  return items.slice(0, 72);
}
