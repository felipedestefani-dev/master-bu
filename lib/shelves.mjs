import { displayKind } from "./products.mjs";
import { sealedShelf, shelfOrder } from "./sealed-match.mjs";
import { plain, slugId } from "./text.mjs";

const SHELF_ID = /^[a-z0-9-]{1,24}$/;
const PRODUCT_ID = /^[A-Za-z0-9-]{1,48}$/;

export function shelfKey(value, fallback = "aba") {
  const key = slugId(value, 24).toLowerCase().replace(/^-+|-+$/g, "");
  return SHELF_ID.test(key) ? key : fallback;
}

export function catalogShelves(banners) {
  const headers = (banners || [])
    .filter((row) => row?.scroll === "aba" && String(row.id || "").startsWith("aba-"))
    .slice()
    .sort((a, b) => Number(a.sort) - Number(b.sort) || String(a.id).localeCompare(String(b.id)));
  return headers.map((row) => {
    const id = shelfKey(String(row.id).slice(4));
    const prefix = `abi-${id}__`;
    const productIds = (banners || [])
      .filter((item) => item?.scroll === "abi" && String(item.id || "").startsWith(prefix))
      .map((item) => String(item.href || "").slice("#/i/".length))
      .filter((productId) => PRODUCT_ID.test(productId));
    return { id, label: plain(row.label, 40) || "Aba", productIds: [...new Set(productIds)] };
  });
}

export function shelvesFromProducts(products) {
  const groups = new Map();
  for (const product of products || []) {
    if (displayKind(product) !== "sealed") continue;
    const label = sealedShelf(product);
    if (!groups.has(label)) groups.set(label, []);
    groups.get(label).push(product.id);
  }
  const order = shelfOrder();
  return [...groups.keys()]
    .sort((a, b) => {
      const left = order.indexOf(a);
      const right = order.indexOf(b);
      return (left < 0 ? order.length : left) - (right < 0 ? order.length : right) || a.localeCompare(b, "pt");
    })
    .map((label) => ({ id: shelfKey(label), label, productIds: groups.get(label) }));
}

export function shelvesToBanners(shelves) {
  const used = new Set();
  const rows = [];
  (shelves || []).forEach((shelf, index) => {
    let id = shelfKey(shelf?.id || shelf?.label);
    let n = 2;
    while (used.has(id) && n < 50) {
      id = shelfKey(`${shelfKey(shelf?.id || shelf?.label)}${n}`);
      n += 1;
    }
    used.add(id);
    const label = plain(shelf?.label, 40);
    if (!label) return;
    rows.push({ id: `aba-${id}`, image: "", href: "#/", label, scroll: "aba", sort: index });
    for (const productId of shelf?.productIds || []) {
      if (!PRODUCT_ID.test(productId)) continue;
      rows.push({
        id: `abi-${id}__${productId}`,
        image: "",
        href: `#/i/${productId}`,
        label: "",
        scroll: "abi",
        sort: index,
      });
    }
  });
  return rows;
}

export function visibleShelves(products, banners) {
  const saved = catalogShelves(banners);
  if (!saved.length) return shelvesFromProducts(products);
  const byId = new Map((products || []).map((product) => [product.id, product]));
  const used = new Set();
  const groups = [];
  for (const shelf of saved) {
    const items = [];
    for (const id of shelf.productIds) {
      const product = byId.get(id);
      if (!product || used.has(id)) continue;
      used.add(id);
      items.push(product);
    }
    if (items.length) groups.push({ id: shelf.id, label: shelf.label, items });
  }
  const rest = (products || []).filter((product) => displayKind(product) === "sealed" && !used.has(product.id));
  if (rest.length) groups.push({ id: "outros", label: "Outros", items: rest });
  return groups;
}
