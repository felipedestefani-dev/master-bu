import { edits, fold, plain, slugId } from "./text.mjs";

export function sortSets(sets) {
  return (sets || []).slice().sort((a, b) => Number(a.sort) - Number(b.sort) || String(a.name).localeCompare(String(b.name), "pt"));
}

export function buildSet(input = {}) {
  const id = slugId(input.id, 40);
  const name = plain(input.name, 80);
  const code = plain(input.code, 12).replace(/[^a-z0-9]/gi, "").toUpperCase();
  if (!id || !name || !code) return { ok: false, error: "Código, sigla e nome são obrigatórios." };
  const sort = Number.isFinite(Number(input.sort)) ? Math.round(Number(input.sort)) : 0;
  return { ok: true, row: { id, name, code, sort } };
}

export function setDeleteError(products, setId) {
  if ((products || []).some((product) => product.set_id === setId)) return "Essa coleção ainda tem itens na vitrine.";
  return "";
}

export function searchSets(sets, query) {
  const words = fold(query).split(/\s+/).filter((word) => word.length > 1);
  if (!words.length) return [];
  return (sets || []).filter((set) => {
    const parts = fold(`${set.name} ${set.en || ""} ${set.code} ${set.id}`).split(/\s+/).filter(Boolean);
    const blob = parts.join(" ");
    return words.every((word) => blob.includes(word) || parts.some((part) => edits(part, word) <= (word.length >= 6 ? 2 : 1)));
  }).slice(0, 8);
}
