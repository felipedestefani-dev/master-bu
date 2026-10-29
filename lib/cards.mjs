import { plainArt } from "./image.mjs";
import { fold, plain, slugId } from "./text.mjs";

export const RARITY = {
  Common: "Comum",
  Uncommon: "Incomum",
  Rare: "Rara",
  "Double Rare": "Dupla rara",
  "Illustration Rare": "Ilustração rara",
  "Special Illustration Rare": "Ilustração especial",
  "Ultra Rare": "Ultra rara",
  "Hyper Rare": "Hiper rara",
  "Rare Holo": "Rara holográfica",
};

const FILLER = new Set(["do", "da", "de", "dos", "das", "o", "a", "the", "of"]);

export function foldText(text) {
  return fold(text).replace(/shw/g, "swsh");
}

export function translateRarity(value) {
  if (!value) return "";
  return RARITY[value] || String(value);
}

export function suggestFinish(rarity, current) {
  if (current && current !== "Normal" && current !== "Foil") return plain(current, 40);
  return /rare|rara|ilustra|ultra|hiper|holo/i.test(rarity || "") ? "Foil" : "Normal";
}

export function searchTokens(text) {
  const raw = foldText(text);
  const code = (raw.match(/\b((?:swsh|sm|sv|xy|bw|dp)\s*-?\s*\d{2,4}[a-z]?)\b/) || [])[1];
  const words = raw.replace(/[^a-z0-9]+/g, " ").split(/\s+/).filter((word) => word && !FILLER.has(word));
  const base = words.find((word) => word.length > 1 && !/^(swsh|sm|sv|xy|bw|dp)\d/.test(word) && !/^\d+$/.test(word)) || "";
  return { promoCode: code ? code.replace(/[\s-]/g, "").toUpperCase() : "", words, base };
}

export function cardMatches(card, tokens) {
  const set = card.set || {};
  const promo = String(set.id || "").endsWith("p") || /promo/i.test(set.name || "");
  const hay = foldText([card.name, card.number, set.name, set.id, set.ptcgoCode, promo ? "promo" : ""].join(" "));
  const nameWords = foldText(card.name).split(/[^a-z0-9]+/).filter(Boolean);
  return tokens.words.every((word) => {
    if (word === "swsh") return foldText(card.number || "").startsWith("swsh") || set.id === "swshp";
    if (word === "promo" || /^(swsh|sm|sv|xy|bw|dp)\d/.test(word)) return hay.includes(word);
    if (word.length <= 3) return nameWords.includes(word);
    return hay.includes(word);
  });
}

export function displayNumber(card) {
  const number = String(card?.number || "").trim();
  if (!number) return "";
  const setId = String(card.set?.id || "");
  if (/^(SWSH|SM|XY|BW|DP|HGSS)/i.test(number) || (setId.endsWith("p") && !/^\d+$/.test(number))) return number.toUpperCase();
  const total = card.set?.printedTotal || card.set?.total;
  return total ? `${number}/${total}` : number;
}

export function setLabel(card, sets = []) {
  const id = card.set?.id;
  if (id === "swshp") return "Promo SWSH";
  const known = sets.find((set) => set.id === id);
  return known?.name || card.set?.name || "Promo";
}

export function rankNames(cards, raw, tokens) {
  const needle = foldText(raw);
  return [...new Set(cards.map((card) => card.name))].sort((a, b) => {
    const rank = (name) => {
      const folded = foldText(name);
      return (folded.startsWith(needle) ? 0 : 1) + (tokens.words.every((word) => folded.includes(word)) ? 0 : 2);
    };
    return rank(a) - rank(b) || a.localeCompare(b, "pt");
  }).slice(0, 40);
}

export function toPrinting(card, sets) {
  return {
    card,
    displayNumber: displayNumber(card),
    setLabel: setLabel(card, sets),
    image: plainArt((card.images && (card.images.small || card.images.large)) || ""),
  };
}

export function printingsOf(cards, name, numberText, sets = []) {
  const wanted = fold(name);
  let list = (cards || []).filter((card) => fold(card.name) === wanted);
  if (!list.length && wanted) list = (cards || []).filter((card) => fold(card.name).includes(wanted));
  const typed = foldText(numberText || "");
  return list
    .filter((card) => {
      if (!typed) return true;
      const hay = foldText(`${displayNumber(card)} ${card.number || ""} ${setLabel(card, sets)}`);
      return hay.includes(typed);
    })
    .sort((a, b) => String(b.set?.releaseDate || "").localeCompare(String(a.set?.releaseDate || "")))
    .slice(0, 36)
    .map((card) => toPrinting(card, sets));
}

export function parseCardSearch(text) {
  const raw = String(text || "").trim();
  if (!raw) return null;
  const fraction = raw.match(/(\d{1,4}[a-zA-Z]?)\s*\/\s*(\d{2,4})/);
  if (fraction) {
    const name = raw.slice(0, fraction.index).replace(/[()]/g, " ").replace(/\s+/g, " ").trim();
    return { name, number: fraction[1], printed: fraction[2] };
  }
  const tail = raw.match(/^(.*\S)\s+(\d{1,4}[a-zA-Z]?)$/);
  if (tail && tail[1].trim()) return { name: tail[1].trim(), number: tail[2], printed: "" };
  if (/^\d{1,4}[a-zA-Z]?$/.test(raw)) return { name: "", number: raw, printed: "" };
  return { name: raw, number: "", printed: "" };
}

export function numberVariants(number) {
  const variants = [String(number || "")];
  if (/^\d+$/.test(number)) {
    variants.push(String(Number(number)));
    variants.push(String(Number(number)).padStart(3, "0"));
  }
  return [...new Set(variants.filter(Boolean))];
}

export function sameNumber(cardNumber, wanted) {
  const left = String(cardNumber).replace(/^0+(?=\d)/, "").toLowerCase();
  const right = String(wanted).replace(/^0+(?=\d)/, "").toLowerCase();
  return left === right;
}

export function nameMatches(cardName, query) {
  if (!query) return true;
  const hay = fold(cardName);
  return fold(query).split(/\s+/).filter(Boolean).every((word) => hay.includes(word));
}

export function matchesPrinted(card, printed) {
  if (!printed) return true;
  const total = Number(printed);
  return card.set?.printedTotal === total || card.set?.total === total;
}

function cleanName(name) {
  return String(name || "").replace(/[^a-z0-9\u00c0-\u024f .'-]/gi, "").trim();
}

export function directQuery(parsed, variant, field) {
  const parts = [];
  const name = cleanName(parsed.name);
  if (name) parts.push(name.includes(" ") ? `name:"${name}"*` : `name:${name}*`);
  const cardNumber = String(variant || "").replace(/[^a-z0-9/]/gi, "").slice(0, 24);
  if (cardNumber) parts.push(`number:${cardNumber}`);
  if (field && parsed.printed) parts.push(`${field}:${String(parsed.printed).replace(/\D/g, "").slice(0, 4)}`);
  return parts.join(" ");
}

export function cardDraft(card) {
  const rarity = translateRarity(card.rarity);
  const set = card.set || {};
  const code = String(set.ptcgoCode || set.id || "").toUpperCase().replace(/[^A-Z0-9]/g, "").slice(0, 12);
  const image = sanitizeRemote(plainArt((card.images && (card.images.small || card.images.large)) || ""));
  return {
    id: slugId(card.id, 48),
    kind: "single",
    name: plain(card.name, 120),
    number: plain(displayNumber(card), 24),
    rarity: plain(rarity, 40),
    finish: suggestFinish(rarity, ""),
    image,
    condition: "NM",
    lang: "PT",
    set: {
      id: slugId(set.id, 40),
      name: plain(set.name, 80),
      code,
    },
  };
}

function sanitizeRemote(url) {
  if (/^https?:\/\//i.test(url) && !/[\s<>"']/.test(url)) return url.slice(0, 500);
  return "";
}

export async function collectNamedCards(query, fetchPage) {
  for (const size of [100, 50]) {
    const first = await fetchPage(query, size, 1);
    if (first == null) continue;
    let all = first.slice();
    let page = 1;
    while (all.length === page * size && page < 4) {
      page += 1;
      const more = await fetchPage(query, size, page);
      if (!more?.length) break;
      all = all.concat(more);
    }
    return all;
  }
  return null;
}

export async function searchCardNames(text, fetchPage, sets = []) {
  const raw = String(text || "").trim().replace(/"/g, "");
  if (raw.length < 2) return { names: [], chosen: null, printings: [], cards: [], error: "" };
  const tokens = searchTokens(raw);
  if (!tokens.base && !tokens.promoCode) return { names: [], chosen: null, printings: [], cards: [], error: "" };
  const query = tokens.promoCode ? `number:${tokens.promoCode}` : `name:${tokens.base}*`;
  const cards = await collectNamedCards(query, fetchPage);
  if (cards == null) return { names: [], chosen: null, printings: [], cards: [], error: "Falha ao consultar o catálogo." };
  const matched = cards.filter((card) => cardMatches(card, tokens));
  const names = rankNames(matched, raw, tokens);
  const exact = names.find((name) => foldText(name) === foldText(raw));
  const chosen = exact || (names.length === 1 ? names[0] : null);
  return {
    names,
    chosen,
    printings: chosen ? printingsOf(matched, chosen, "", sets) : [],
    cards: matched,
    error: "",
  };
}

export async function findDirectCards(text, fetchPage, sets = []) {
  const parsed = parseCardSearch(text);
  if (!parsed || (!parsed.number && !parsed.printed)) return { printings: [], error: "" };
  const variants = parsed.number ? numberVariants(parsed.number) : [""];
  const found = new Map();
  let reached = false;
  const collect = async (query, printed) => {
    const cards = await fetchPage(query, 100, 1);
    if (cards == null) return;
    reached = true;
    cards
      .filter((card) => (!parsed.number || sameNumber(card.number, parsed.number)) && matchesPrinted(card, printed) && nameMatches(card.name, parsed.name))
      .forEach((card) => found.set(card.id, card));
  };
  if (parsed.printed) {
    for (const variant of variants) {
      await collect(directQuery(parsed, variant, "set.printedTotal"), parsed.printed);
      if (found.size) break;
    }
    if (!found.size) {
      for (const variant of variants) {
        await collect(directQuery(parsed, variant, "set.total"), parsed.printed);
        if (found.size) break;
      }
    }
  } else {
    for (const variant of variants) {
      await collect(directQuery(parsed, variant, ""), "");
      if (found.size) break;
    }
  }
  if (!reached) return { printings: [], error: "Falha ao consultar o catálogo." };
  const printings = [...found.values()]
    .sort((a, b) => String(b.set?.releaseDate || "").localeCompare(String(a.set?.releaseDate || "")))
    .slice(0, 36)
    .map((card) => toPrinting(card, sets));
  return { printings, error: "" };
}
