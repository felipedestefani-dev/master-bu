import { displayKind } from "./products.mjs";

export function money(value) {
  return Number(value || 0).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}

export function onOrder(product) {
  const price = Number(product?.price);
  return !(price > 0) && String(product?.finish || "") === "Sob encomenda";
}

export function forSale(product) {
  if (onOrder(product)) return true;
  return Number(product?.qty) > 0;
}

export function buyAction(product) {
  if (onOrder(product)) return "order";
  if (displayKind(product) === "presale") return "reserve";
  return "buy";
}

export function buyLabel(product) {
  const action = buyAction(product);
  if (action === "order") return "Encomendar";
  if (action === "reserve") return "Reservar";
  return "Comprar";
}

export function priceLabel(product) {
  if (onOrder(product)) return "Sob encomenda";
  return money(product?.price);
}

export function whatsappText(product, setName) {
  const action = buyAction(product);
  const verb = action === "order" ? "encomendar" : action === "reserve" ? "reservar" : "comprar";
  return [
    `Olá! Quero ${verb}:`,
    product?.name || "",
    `Coleção: ${setName || "—"}`,
    `Número: ${product?.number || "—"}`,
    `Idioma: ${product?.lang || "—"}`,
    `Condição: ${product?.condition || "—"}`,
    `Acabamento: ${product?.finish || "—"}`,
    `Preço: ${action === "order" ? "sob encomenda" : money(product?.price)}`,
  ].join("\n");
}

export function whatsappUrl(phone, product, setName) {
  const digits = String(phone || "").replace(/\D/g, "");
  if (!digits) return "";
  return `https://api.whatsapp.com/send?phone=${digits}&text=${encodeURIComponent(whatsappText(product, setName))}`;
}

export function shelfOf(product) {
  const kind = displayKind(product);
  if (kind === "presale") return "prevenda";
  if (kind === "sealed") return "lacrados";
  return "avulsos";
}
