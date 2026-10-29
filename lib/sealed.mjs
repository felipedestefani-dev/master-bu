import { matchesProduct, needles, rankGroups, sealedItems } from "./sealed-match.mjs";

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
  return sealedItems(buckets);
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
