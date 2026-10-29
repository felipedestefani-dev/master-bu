import { sanitizeImage } from "./image.mjs";
import { plain, slugId } from "./text.mjs";

export function sealedDraft(item, current = {}) {
  const rawId = current.id ? slugId(current.id, 48) : "";
  const productKey = String(item?.productId ?? "").replace(/[^a-z0-9-]/gi, "");
  const generated = `sealed-${productKey}`.slice(0, 48);
  const finish = !current.finish || current.finish === "Normal" || current.finish === "Foil" ? "Lacrado" : plain(current.finish, 40);
  return {
    id: rawId || generated,
    kind: "sealed",
    name: plain(item?.name, 120),
    number: "",
    rarity: plain(item?.label, 40),
    condition: "Lacrado",
    finish,
    image: sanitizeImage(item?.image),
    qty: current.qty == null || current.qty === "" ? 1 : current.qty,
    lang: current.lang || "PT",
  };
}
