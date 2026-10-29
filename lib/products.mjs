import { sanitizeImage } from "./image.mjs";
import { fold, plain, safeSearch, slugId } from "./text.mjs";

const LANG = { "PT-BR": "PT", BR: "PT", POR: "PT", ENG: "EN", US: "EN", JA: "JP", KR: "KO", CN: "ZH", CH: "ZH" };

export function displayKind(product) {
  const id = String(product?.id || "");
  if (id.startsWith("me6-")) return "presale";
  if (id.startsWith("master-")) return "master";
  return product?.kind === "sealed" ? "sealed" : "single";
}

export function productCondition(product) {
  const kind = displayKind(product);
  const saved = String(product?.condition || "").trim();
  if (kind === "master") return saved || "Completo";
  if (kind === "sealed" || kind === "presale") return !saved || saved === "NM" ? "Lacrado" : saved;
  return saved || "NM";
}

export function readPrice(value) {
  if (typeof value === "number") {
    if (!Number.isFinite(value) || value < 0) return null;
    return Math.round(value * 100) / 100;
  }
  const text = String(value ?? "").trim().replace(/\s/g, "").replace(/^r\$/i, "");
  if (!text) return 0;
  const normalized = text.includes(",") ? text.replace(/\./g, "").replace(",", ".") : text;
  const amount = Number(normalized);
  if (!Number.isFinite(amount) || amount < 0) return null;
  return Math.round(amount * 100) / 100;
}

export function normalizeLang(value) {
  const code = plain(value, 8).toUpperCase();
  if (!code) return "PT";
  return (LANG[code] || code).slice(0, 8);
}

export function stepQty(qty, delta) {
  const step = Number(delta) < 0 ? -1 : 1;
  return Math.max(0, Math.min(9999, Math.round(Number(qty) || 0) + step));
}

export function buildProduct(input = {}) {
  const received = String(input.kind || "");
  const master = received === "master";
  const kind = received === "presale" || master ? "sealed" : received;
  const price = readPrice(input.price);
  let id = slugId(input.id, 48);
  if (master && id && !id.startsWith("master-")) id = slugId(`master-${id}`, 48);
  const typed = plain(input.condition, 24);
  const condition = master ? "Completo" : (kind === "sealed" && (!typed || typed === "NM") ? "Lacrado" : (typed || "NM"));
  const row = {
    id,
    kind: kind === "single" || kind === "sealed" ? kind : "",
    name: plain(input.name, 120),
    set_id: slugId(input.set_id, 40),
    number: plain(input.number, 24),
    rarity: plain(input.rarity, 40),
    condition,
    lang: normalizeLang(input.lang),
    finish: master ? "Master Set" : (plain(input.finish, 40) || (kind === "sealed" ? "Lacrado" : "Normal")),
    qty: input.qty == null || input.qty === "" ? 1 : Math.max(0, Math.min(9999, Math.round(Number(input.qty) || 0))),
    price,
    image: sanitizeImage(input.image),
  };
  if (!row.id || !row.name || !row.set_id) return { ok: false, error: "Código, nome e coleção são obrigatórios." };
  if (!row.kind) return { ok: false, error: "Tipo inválido." };
  if (row.price == null) return { ok: false, error: "Informe o preço, como 13,99." };
  return { ok: true, row };
}

export function productFromQuery(search) {
  const get = (key) => String(search?.get?.(key) || "");
  if (!get("id") || !get("name") || !get("set_id")) return null;
  return buildProduct({
    id: get("id"),
    kind: get("kind") || "single",
    name: get("name"),
    set_id: get("set_id"),
    number: get("number"),
    rarity: get("rarity"),
    condition: get("condition"),
    lang: get("lang"),
    finish: get("finish"),
    qty: get("qty"),
    price: get("price"),
    image: get("image"),
  });
}

export function duplicateProduct(product, suffix) {
  const tail = String(suffix ?? Math.random().toString(36).slice(2, 6)).toLowerCase().replace(/[^a-z0-9]/g, "").slice(0, 4).padEnd(4, "x");
  const stamp = `-copia-${tail}`;
  const base = slugId(product.id, 48).slice(0, 48 - stamp.length);
  return {
    id: `${base}${stamp}`,
    kind: product.kind,
    name: product.name,
    set_id: product.set_id,
    number: product.number || "",
    rarity: product.rarity || "",
    condition: product.condition || "NM",
    lang: product.lang || "PT",
    finish: product.finish || "Normal",
    qty: product.qty ?? 1,
    price: product.price ?? 0,
    image: product.image || "",
  };
}

export function removedError(rows) {
  if (!rows || !rows.length) return "Não foi possível excluir esse item.";
  return "";
}

export function filterProducts(products, { query = "", kind = "all", setId = "", sets = [], fields = "catalog" } = {}) {
  const q = fold(safeSearch(query));
  const wantedSet = slugId(setId, 48);
  const names = new Map((sets || []).map((set) => [set.id, `${set.name || ""} ${set.code || ""}`]));
  return (products || [])
    .filter((product) => {
      if (wantedSet && product.set_id !== wantedSet) return false;
      if (kind !== "all" && displayKind(product) !== kind) return false;
      if (!q) return true;
      const extra = fields === "store" ? "" : ` ${product.set_id} ${names.get(product.set_id) || ""}`;
      return fold(`${product.name} ${product.number}${extra}`).includes(q);
    })
    .sort((a, b) => String(a.name).localeCompare(String(b.name), "pt"));
}

export function stockValue(products) {
  return (products || []).reduce((sum, product) => sum + Number(product.price || 0) * Number(product.qty || 0), 0);
}

export function stockRows(products, level) {
  return (products || []).filter((product) => {
    const qty = Number(product.qty);
    if (level === "low") return qty === 1;
    if (level === "out") return qty === 0;
    return true;
  });
}
