import { buildSet } from "./sets.mjs";
import { fold } from "./text.mjs";

export const SET_PT = {
  me6: "Reinado Delta",
  me55: "Celebração de 30 Anos",
  me55c: "Celebração de 30 Anos — Cartas Clássicas",
  me5: "Escuridão Absoluta",
  me4: "Caos Ascendente",
  me3: "Equilíbrio Perfeito",
  me2pt5: "Heróis Excelsos",
  me2: "Fogo Fantasmagórico",
  me1: "Megaevolução",
  zsv10pt5: "Raio Preto",
  rsv10pt5: "Fogo Branco",
  sv10: "Rivais Predestinados",
  sv9: "Amigos de Jornada",
  sv8pt5: "Evoluções Prismáticas",
  sv8: "Fagulhas Impetuosas",
  sv7: "Coroa Estelar",
  sv6pt5: "Fábulas Nebulosas",
  sv6: "Máscaras do Crepúsculo",
  sv5: "Forças Temporais",
  sv4pt5: "Destinos de Paldea",
  sv4: "Fenda Paradoxal",
  sv3pt5: "151",
  sv3: "Obsidiana em Chamas",
  sv2: "Evoluções em Paldea",
  sv1: "Escarlate e Violeta",
  swsh12pt5: "Realeza Absoluta",
  swsh12: "Tempestade Prateada",
  swsh11: "Origem Perdida",
  swsh10: "Astros Cintilantes",
  swsh9: "Estrelas Radiantes",
  swsh8: "Golpe Fusão",
  cel25: "Celebrações",
  swsh7: "Céus em Evolução",
  swsh6: "Reinado Arrepiante",
  swsh5: "Estilos de Batalha",
  swsh45: "Destinos Brilhantes",
  swsh4: "Voltagem Vívida",
  swsh35: "Caminho do Campeão",
  swsh3: "Escuridão Incandescente",
  swsh2: "Rixa Rebelde",
  swsh1: "Espada e Escudo",
  bw6: "Dragões Enaltecidos",
  bw5: "Exploradores da Escuridão",
  bw4: "Próximos Destinos",
  bw3: "Vitórias Nobres",
  bw2: "Poderes Emergentes",
  base5: "Equipe Rocket",
  base3: "Fóssil",
  base2: "Selva",
  base1: "Jogo Base",
};

export function officialLabel(set, names = {}) {
  return names[set?.id] || set?.name || set?.id || "";
}

export function formatRelease(value) {
  const match = String(value || "").match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (!match) return "";
  return `${match[3]}/${match[2]}/${match[1]}`;
}

export function slimOfficialSet(set) {
  return {
    id: String(set?.id || ""),
    name: String(set?.name || ""),
    ptcgoCode: String(set?.ptcgoCode || ""),
    series: String(set?.series || ""),
    releaseDate: String(set?.releaseDate || ""),
  };
}

export function matchOfficial(set, query, names = {}) {
  const words = fold(query).trim().split(/\s+/).filter(Boolean);
  if (!words.length) return true;
  const blob = fold([names[set.id], set.id === "sv9" ? "jornada conjunta" : "", set.name, set.ptcgoCode, set.id].filter(Boolean).join(" "));
  return words.every((word) => blob.includes(word));
}

export function storeSetFromOfficial(set, names, sort) {
  return buildSet({
    id: set.id,
    name: officialLabel(set, names),
    code: set.ptcgoCode || set.id,
    sort,
  });
}

async function readSetsPage(url, fetchImpl) {
  for (let attempt = 0; attempt < 3; attempt += 1) {
    try {
      const response = await fetchImpl(url, {
        headers: { Accept: "application/json", "User-Agent": "AMD-TCG/1.0" },
      });
      if (!response.ok) continue;
      const payload = JSON.parse(await response.text());
      if (!payload || !Array.isArray(payload.data)) continue;
      return payload;
    } catch {
      /* nova tentativa */
    }
  }
  throw new Error("Falha ao consultar as coleções.");
}

export async function fetchOfficialSets(fetchImpl = fetch) {
  const all = [];
  let page = 1;
  let total = Infinity;
  while (all.length < total && page <= 20) {
    const payload = await readSetsPage(
      `https://api.pokemontcg.io/v2/sets?orderBy=-releaseDate&pageSize=250&page=${page}`,
      fetchImpl,
    );
    const data = payload.data;
    total = Number(payload.totalCount) || all.length + data.length;
    all.push(...data.map(slimOfficialSet).filter((set) => set.id));
    if (data.length < 250) break;
    page += 1;
  }
  return all;
}
