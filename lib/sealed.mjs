import { matchesProduct, needles, norm, rankGroups, sealedItems } from "./sealed-match.mjs";

const GROUPS_URL = "https://tcgcsv.com/tcgplayer/3/groups";
let groupsCache = null;
const productsCache = new Map();

export function clearSealedCache() {
  groupsCache = null;
  productsCache.clear();
}

async function readJson(url, fetchImpl) {
  const response = await fetchImpl(url, { headers: { Accept: "application/json", "User-Agent": "MasterBu/1.0" } });
  const text = await response.text();
  if (!response.ok || !text.trim().startsWith("{")) throw new Error("Falha ao consultar os lacrados.");
  return JSON.parse(text);
}

async function loadGroups(deps) {
  if (deps.groups) return deps.groups;
  if (!groupsCache) {
    const payload = await readJson(GROUPS_URL, deps.fetchImpl || fetch);
    groupsCache = payload.results || [];
  }
  return groupsCache;
}

async function loadProducts(groupId, deps) {
  if (deps.products) return deps.products(groupId);
  if (!productsCache.has(groupId)) {
    const payload = await readJson(`https://tcgcsv.com/tcgplayer/3/${groupId}/products`, deps.fetchImpl || fetch);
    productsCache.set(groupId, payload.results || []);
  }
  return productsCache.get(groupId);
}

const CHARIZARD_Y_BOX = {
  productId: "me1-charizard-y",
  name: "Coleção Mega Charizard Y",
  label: "Box",
  image: "/assets/products/sealed-me1-charizard-y.jpg",
  group: "Megaevolução",
};

export function localSealed(query) {
  const text = norm(query);
  if (!text.includes("charizard")) return [];
  if (/\bx\b/.test(text) && !/\by\b/.test(text)) return [];
  if (!(/\by\b/.test(text) || text.includes("colecao") || /\bbox\b/.test(text))) return [];
  return [CHARIZARD_Y_BOX];
}

export async function searchSealed(query, deps = {}) {
  if (!needles(query).length) return [];
  const list = await loadGroups(deps);
  const ranked = rankGroups(list, query);
  const buckets = [];
  for (const { group } of ranked) {
    buckets.push({ group, products: await loadProducts(group.groupId, deps) });
  }
  if (!ranked.length) {
    const misc = list.find((group) => /miscellaneous/i.test(group.name || ""));
    if (misc) {
      const products = (await loadProducts(misc.groupId, deps)).filter((row) => matchesProduct(row.name, query));
      if (products.length) buckets.push({ group: misc, products });
    }
  }
  const found = sealedItems(buckets).map(correctSealedImage);
  const extra = localSealed(query).filter((item) => !found.some((row) => String(row.productId) === String(item.productId)));
  return [...extra, ...found].slice(0, 160);
}

const SEALED_ART = [
  { image: "/assets/products/sealed-me5-unit.webp", label: "Unitário", re: /pitch black|escuridao/ },
  { image: "/assets/products/sealed-me5-quad.png", label: "Quádruplo", re: /pitch black|escuridao/ },
  { image: "/assets/products/sealed-me5-etb.webp", label: "ETB", re: /pitch black|escuridao/, skip: /pokemon center|exclusive/ },
  { image: "/assets/products/sealed-me4-unit-b.png", label: "Unitário", re: /chaos rising|caos ascendente|\bcaos\b/ },
  { image: "/assets/products/sealed-me4-quad.png", label: "Quádruplo", re: /chaos rising|caos ascendente|\bcaos\b/ },
  { image: "/assets/products/sealed-me6-quad.png", label: "Quádruplo", re: /delta reign|reinado delta/ },
  { image: "/assets/products/sealed-me1-quad.webp", label: "Quádruplo", re: /mega evolution|megaevolucao/ },
  { image: "/assets/products/sealed-me1-triple.webp", label: "Triplo", re: /mega evolution|megaevolucao/ },
  { image: "/assets/products/sealed-me3-etb.webp", label: "ETB", re: /perfect order|equilibrio perfeito/, skip: /pokemon center|exclusive/ },
  { image: "/assets/products/me6-etb.jpg", label: "ETB", re: /delta reign|reinado delta/, skip: /pokemon center|exclusive/ },
  { image: "/assets/products/sealed-sv3-etb.webp", label: "ETB", re: /obsidian flames|obsidiana/, skip: /pokemon center|exclusive/ },
  { image: "/assets/products/sealed-me55-etb-en.webp", label: "ETB", re: /30th|30 anos|celebration/, skip: /pokemon center/ },
  { image: "/assets/products/sealed-me1-upc-x.jpg", label: "UPC", re: /charizard x/ },
];

export function correctSealedImage(item) {
  const name = norm(item?.name || "");
  const art = SEALED_ART.find((rule) => item?.label === rule.label && rule.re.test(name) && !(rule.skip && rule.skip.test(name)));
  if (!art) {
    const id = String(item?.productId || "");
    const savedId = String(item?.image || "").match(/\/product\/(\d+)_/);
    if (/^\d+$/.test(id) && savedId && savedId[1] !== id) {
      return { ...item, image: `https://tcgplayer-cdn.tcgplayer.com/product/${id}_200w.jpg` };
    }
    return item;
  }
  return { ...item, image: art.image };
}

export async function handleSealed(req, deps = {}) {
  if ((req.method || "GET") !== "GET") {
    return { status: 405, body: JSON.stringify({ error: "Método não permitido." }) };
  }
  try {
    const url = new URL(req.url || "/", "http://localhost");
    const q = (req.query && req.query.q) || url.searchParams.get("q") || "";
    const items = await searchSealed(q, deps);
    return { status: 200, body: JSON.stringify({ items }) };
  } catch {
    return { status: 502, body: JSON.stringify({ error: "Falha ao consultar os lacrados." }) };
  }
}
