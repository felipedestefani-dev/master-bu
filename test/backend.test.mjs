import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { buildBanner, publicBanners, reorderBanners } from "../lib/banners.mjs";
import { cardDraft, cardMatches, displayNumber, findDirectCards, parseCardSearch, searchCardNames, searchTokens, setLabel, suggestFinish, translateRarity } from "../lib/cards.mjs";
import { artFile, isCardBack, masterPhoto, plainArt, productImage, sanitizeImage, setLogoFallback, setLogoSrc } from "../lib/image.mjs";
import { fetchOfficialSets, formatRelease, matchOfficial, storeSetFromOfficial } from "../lib/official-sets.mjs";
import { resizeJpegDataUrl } from "../lib/image-node.mjs";
import jpeg from "jpeg-js";
import { buildProduct, displayKind, duplicateProduct, filterProducts, productCondition, productFromQuery, stepQty } from "../lib/products.mjs";
import { labelOf, matchesProduct, needles, rankGroups, scoreGroup, sealedKind } from "../lib/sealed-match.mjs";
import { correctSealedImage, searchSealed } from "../lib/sealed.mjs";
import { searchSets, setDeleteError } from "../lib/sets.mjs";
import { buyLabel, forSale, onOrder, whatsappText, whatsappUrl } from "../lib/shop.mjs";
import { buildTab, publicTabs, reorderTabs } from "../lib/tabs.mjs";
import { handleTcg } from "../lib/tcg-proxy.mjs";
import { safeSearch } from "../lib/text.mjs";
import { buildVisit, summarizeVisits, visitBounds } from "../lib/visits.mjs";
import { sealedDraft } from "../lib/sealed-draft.mjs";

const charizard = {
  id: "sv3-223",
  name: "Charizard ex",
  number: "223",
  rarity: "Special Illustration Rare",
  set: { id: "sv3", name: "Obsidian Flames", ptcgoCode: "OBF", printedTotal: 197, total: 230, releaseDate: "2023-08-11" },
  images: { small: "https://images.pokemontcg.io/sv3/223.png" },
};
const promo = {
  id: "swshp-SWSH133",
  name: "Charizard",
  number: "SWSH133",
  rarity: "Promo",
  set: { id: "swshp", name: "SWSH Black Star Promos", ptcgoCode: "PR-SW", releaseDate: "2020-11-01" },
  images: { small: "https://images.pokemontcg.io/swshp/SWSH133.png" },
};

test("busca de carta ignora acento, shw e palavras curtas soltas", () => {
  const tokens = searchTokens("Charizard do Lance shw");
  assert.equal(tokens.base, "charizard");
  assert.equal(tokens.words.includes("do"), false);
  assert.equal(tokens.words.includes("shw"), false);
  assert.equal(tokens.words.includes("swsh"), true);
  assert.equal(cardMatches({ name: "Charizard VMAX", number: "74", set: { id: "swsh45", name: "Shining Fates" } }, searchTokens("charizard ex")), false);
  assert.equal(cardMatches(charizard, searchTokens("charizard ex")), true);
  assert.equal(cardMatches({ name: "Pikachu", number: "1", set: { id: "sv1", name: "Scarlet" } }, searchTokens("swsh")), false);
  assert.equal(cardMatches(promo, searchTokens("swsh")), true);
});

test("código de promo busca pelo número", async () => {
  let seen = "";
  const fetchPage = async (q) => {
    seen = q;
    return [promo];
  };
  const result = await searchCardNames("Charizard SWSH133", fetchPage);
  assert.equal(seen, "number:SWSH133");
  assert.equal(result.chosen, "Charizard");
  assert.equal(result.printings[0].displayNumber, "SWSH133");
});

test("nome único abre as impressões e o número de promo fica em maiúsculas", async () => {
  const fetchPage = async (q) => (q.startsWith("name:charizard") ? [charizard, promo, { ...charizard, id: "sv3-199", name: "Charizard ex", set: { ...charizard.set, releaseDate: "2024-01-01", printedTotal: 165 }, number: "199" }] : []);
  const result = await searchCardNames("charizard ex", fetchPage);
  assert.equal(result.chosen, "Charizard ex");
  assert.equal(result.printings[0].displayNumber, "199/165");
  assert.equal(displayNumber(promo), "SWSH133");
  assert.equal(setLabel(promo), "Promo SWSH");
  const draft = cardDraft(promo);
  assert.equal(draft.kind, "single");
  assert.equal(draft.number, "SWSH133");
  assert.equal(draft.rarity, "Promo");
  assert.equal(draft.condition, "NM");
  assert.equal(draft.lang, "PT");
  assert.equal(draft.set.code, "PRSW");
  assert.equal(draft.finish, "Normal");
  assert.equal(translateRarity("Special Illustration Rare"), "Ilustração especial");
  assert.equal(suggestFinish("Ilustração especial", ""), "Foil");
  assert.equal(suggestFinish("Comum", "Reverse"), "Reverse");
});

test("busca direta Nome 25/165 compara número sem zero e o total impresso", async () => {
  assert.deepEqual(parseCardSearch("Charizard 25/165"), { name: "Charizard", number: "25", printed: "165" });
  const card = { ...charizard, number: "025", name: "Charizard", set: { ...charizard.set, printedTotal: 165, total: 200, releaseDate: "2024-05-01" } };
  const other = { ...card, id: "sv3-25b", number: "25", set: { ...card.set, printedTotal: 100, total: 100 } };
  const fetchPage = async (q) => (q.includes("printedTotal:165") ? [card, other] : []);
  const result = await findDirectCards("Charizard 25/165", fetchPage);
  assert.equal(result.printings.length, 1);
  assert.equal(result.printings[0].card.id, "sv3-223");
});

test("lacrado traduz, pontua e descarta o que não entra na vitrine", async () => {
  assert.deepEqual(needles("a"), []);
  assert.ok(needles("Evoluções Prismáticas").includes("prismatic evolutions"));
  assert.equal(labelOf("Prismatic Evolutions Booster Box"), "BB");
  assert.equal(labelOf("Pitch Black Half Booster Boxes"), "Mini BB");
  assert.equal(labelOf("Delta Reign Half Booster Box"), "Mini BB");
  assert.equal(labelOf("Pitch Black Booster Box"), "BB");
  assert.equal(labelOf("Elite Trainer Box"), "ETB");
  assert.equal(labelOf("Code Card"), "");
  assert.equal(labelOf("Booster Box Case"), "");
  assert.equal(labelOf("Chaos Rising Premium Checklane Blister [Pawmot Line]"), "Quádruplo");
  assert.equal(labelOf("Delta Reign 3 Pack Blister [Seel]"), "Triplo");
  assert.equal(labelOf("Pitch Black Single Pack Blister [Slowpoke]"), "Unitário");
  assert.equal(labelOf("Mega Charizard Tin (Mega Charizard Y)"), "Box");
  assert.equal(labelOf("Ascended Heroes Mini Tin Display"), "");
  assert.equal(labelOf("Prismatic Evolutions Binder Collection"), "Coleção");
  assert.equal(labelOf("Prismatic Evolutions 2-Pack Blister [Eevee]"), "Blister");
  assert.equal(labelOf("Eevee - 143/191"), "");
  assert.equal(sealedKind("Blister Quádruplo de Caos Ascendente"), "Quádruplo");
  assert.equal(sealedKind("Mini Booster Box Reinado Delta"), "Mini BB");
  assert.equal(sealedKind("Mini BB Caos Ascendente"), "Mini BB");
  assert.equal(sealedKind("Coleção Treinador Avan. Equilíbrio Perfeito"), "ETB");
  assert.equal(sealedKind("UPC Mega Charizard X ex"), "UPC");
  assert.ok(needles("Therastal").includes("prismatic evolutions"));
  assert.ok(needles("Reinado Delta").includes("delta reign"));
  assert.equal(matchesProduct("Mega Charizard Tin (Mega Charizard Y)", "Box Mega Charizard Y"), true);
  const groups = [
    { groupId: 1, name: "Scarlet & Violet: Prismatic Evolutions", abbreviation: "PRE", isSupplemental: false },
    { groupId: 2, name: "Prismatic Evolutions", abbreviation: "OLD", isSupplemental: false },
    { groupId: 3, name: "Something Else", abbreviation: "PRE", isSupplemental: true },
  ];
  assert.equal(scoreGroup(groups[0], "pre"), 120);
  const ranked = rankGroups(groups, "Evoluções Prismáticas");
  assert.equal(ranked.length, 2);
  const items = await searchSealed("Evoluções Prismáticas", {
    groups,
    products: (groupId) => groupId === 1 ? [
      { productId: 9, name: "Prismatic Evolutions Booster Box", imageUrl: "https://img.example/bb.jpg" },
      { productId: 8, name: "Prismatic Evolutions Code Card", imageUrl: "https://img.example/code.jpg" },
      { productId: 7, name: "Prismatic Evolutions Elite Trainer Box", imageUrl: "" },
    ] : [],
  });
  assert.equal(items.find((item) => item.productId === "sv8pt5-therastal").name, "Box Therastal Evoluções Prismáticas");
  assert.equal(items.find((item) => item.productId === 9).label, "BB");
  const draft = sealedDraft(items.find((item) => item.productId === 9), { finish: "Normal" });
  assert.equal(draft.id, "sealed-9");
  assert.equal(draft.kind, "sealed");
  assert.equal(draft.rarity, "BB");
  assert.equal(draft.finish, "Lacrado");
  assert.equal(draft.condition, "Lacrado");
  assert.equal(draft.number, "");
  const loose = await searchSealed("Box Mega Charizard Y", {
    groups: [
      { groupId: 9, name: "Miscellaneous Cards & Products", isSupplemental: true },
      { groupId: 4, name: "ME01: Mega Evolution", isSupplemental: false },
    ],
    products: (groupId) => groupId === 9 ? [
      { productId: 671249, name: "Mega Charizard Tin (Mega Charizard Y)", imageUrl: "https://img.example/y.jpg" },
      { productId: 1, name: "Code Card - Mega Charizard Tin (Mega Charizard Y)", imageUrl: "https://img.example/code.jpg" },
    ] : [],
  });
  assert.equal(loose.find((item) => item.productId === 671249).image, "https://img.example/y.jpg");
  assert.equal(loose[0].productId, "me1-charizard-y");
  assert.equal(loose[0].name, "Coleção Mega Charizard Y");
  assert.equal(loose[0].image, "/assets/products/sealed-me1-charizard-y.png");
  assert.equal(correctSealedImage({ label: "Unitário", name: "Pitch Black Single Pack Blister [Slowpoke]", image: "https://img.example/slow.jpg" }).image, "/assets/products/sealed-me5-unit-b.png");
  assert.equal(correctSealedImage({ label: "ETB", name: "Pitch Black Pokemon Center Elite Trainer Box", image: "https://img.example/pc.jpg" }).image, "https://img.example/pc.jpg");
  assert.equal(correctSealedImage({ label: "Unitário", name: "Chaos Rising Single Pack Blister [Toxel]" }).image, "/assets/products/sealed-me4-unit-c.png");
  assert.equal(correctSealedImage({ label: "Quádruplo", name: "Chaos Rising Premium Checklane Blister [Flygon Line]" }).image, "/assets/products/sealed-me4-quad-b.png");
  assert.equal(correctSealedImage({ label: "Quádruplo", name: "Pitch Black Premium Checklane Blister [Gengar Line]" }).image, "/assets/products/sealed-me5-quad-b.png");
  assert.equal(correctSealedImage({ label: "Quádruplo", name: "Mega Evolution Premium Checklane Blister [Tyranitar]" }).image, "/assets/products/sealed-me1-quad.png");
  assert.equal(correctSealedImage({ label: "Quádruplo", name: "Delta Reign Premium Checklane Blister [Seel]" }).image, "/assets/products/sealed-me6-quad-b.png");
  assert.equal(correctSealedImage({ label: "Unitário", name: "Delta Reign Single Pack Blister" }).image, "/assets/products/sealed-me6-unit.png");
  assert.equal(productImage({ id: "sealed-684460", kind: "sealed", name: "Chaos Rising Premium Checklane Blister", image: "https://tcgplayer-cdn.tcgplayer.com/product/692957_200w.jpg" }), "/assets/products/sealed-me4-quad-b.png");
  assert.equal(productImage({ id: "sealed-684460", kind: "sealed", name: "Chaos Rising Premium Checklane Blister", image: "/assets/products/minha-foto.png" }), "/assets/products/minha-foto.png");
  assert.equal(productImage({ id: "sealed-me5-etb", kind: "sealed", name: "Coleção Treinador Avan. Escuridão Absoluta", image: "https://tcgplayer-cdn.tcgplayer.com/product/692947_200w.jpg" }), "/assets/products/sealed-me5-etb-b.png");
  assert.equal(masterPhoto({ image: "data:image/jpeg;base64,03ZzEFfLsu4C5zDmgvxdmH+4923tOyi7tzfmBzUh8LZGCItBYOVja2hFjlbmuvU8Gv8u3/2ribUkVQuA" }), "/assets/products/master-me4-caos.png");
});

test("coleção, produto, pré-venda e foto", () => {
  const sets = [{ id: "sv8pt5", name: "Evoluções Prismáticas", en: "Prismatic Evolutions", code: "PRE" }];
  assert.equal(searchSets(sets, "prismatic").length, 1);
  assert.equal(searchSets(sets, "x").length, 0);
  assert.equal(setDeleteError([{ set_id: "sv8pt5" }], "sv8pt5"), "Essa coleção ainda tem itens na vitrine.");
  const saved = buildProduct({ id: "me6-1", kind: "presale", name: "Box", set_id: "me6", price: "13,99", qty: 2, image: "javascript:alert(1)" });
  assert.equal(saved.ok, true);
  assert.equal(saved.row.kind, "sealed");
  assert.equal(saved.row.condition, "Lacrado");
  assert.equal(buildProduct({ id: "sealed-1", kind: "sealed", name: "Blister", set_id: "me5", condition: "NM", price: 10 }).row.condition, "Lacrado");
  assert.equal(productCondition({ id: "sealed-1", kind: "sealed", condition: "NM" }), "Lacrado");
  assert.equal(saved.row.price, 13.99);
  assert.equal(saved.row.image, "");
  const fromLink = productFromQuery(new URLSearchParams("kind=single&id=swshp-SWSH020&name=Pikachu&set_id=swshp&number=SWSH020&rarity=Promo&condition=NM&lang=PT&finish=Normal&qty=1&price=199"));
  assert.equal(fromLink.row.id, "swshp-SWSH020");
  assert.equal(fromLink.row.price, 199);
  assert.equal(productFromQuery(new URLSearchParams("q=pikachu")), null);
  assert.equal(displayKind(saved.row), "presale");
  const master = buildProduct({ id: "sv8", kind: "master", name: "Fagulhas Impetuosas", set_id: "sv8", price: 900 });
  assert.equal(master.row.id, "master-sv8");
  assert.equal(master.row.kind, "sealed");
  assert.equal(master.row.finish, "Master Set");
  assert.equal(displayKind(master.row), "master");
  assert.equal(stepQty(0, -1), 0);
  assert.equal(stepQty(3, 1), 4);
  assert.equal(duplicateProduct({ id: "sv3-1", name: "Carta", kind: "single", set_id: "sv3" }, "ab12").id, "sv3-1-copia-ab12");
  assert.equal(artFile("001/165"), "1");
  assert.equal(plainArt("https://images.pokemontcg.io/sv1/001.png"), "https://images.pokemontcg.io/sv1/1.png");
  assert.equal(productImage({ kind: "single", set_id: "sv1", number: "001/165", image: "" }), "https://images.pokemontcg.io/sv1/1.png");
  assert.equal(sanitizeImage("https://exemplo.com/a b.png"), "");
  assert.equal(sanitizeImage("/assets/carta.png"), "/assets/carta.png");
  assert.equal(isCardBack(640, 892), true);
  const found = filterProducts(
    [{ id: "1", name: "Pikachu", number: "25", set_id: "sv1", kind: "single" }],
    { query: "pikachu", sets: [{ id: "sv1", name: "Escarlate", code: "SVI" }], fields: "catalog" },
  );
  assert.equal(found.length, 1);
  assert.equal(safeSearch("pikachu'; drop table products;--"), "pikachu drop table products");
  assert.equal(safeSearch("a".repeat(200)).length, 80);
  assert.equal(filterProducts(
    [{ id: "1", name: "Pikachu", number: "25", set_id: "sv1", kind: "single" }],
    { query: "pikachu' or 1=1;--", setId: "sv1'; drop table products" },
  ).length, 0);
});

test("banner, visita e whatsapp", () => {
  assert.equal(buildBanner({ image: "notaurl", label: "Capa", dest: "avulsos" }).error, "Escolha a imagem do banner.");
  const banner = buildBanner({ image: "https://exemplo.com/capa.jpg", label: "Capa", dest: "avulsos" });
  assert.equal(banner.row.href, "#/avulsos");
  assert.equal(buildBanner({ image: "https://exemplo.com/capa.jpg", label: "Fora", dest: "external", url: "http://inseguro" }).error, "O link precisa começar com https:// ou #/.");
  const rows = [
    { id: "a", image: "https://exemplo.com/a.jpg", href: "#/", label: "A", scroll: "", sort: 0 },
    { id: "b", image: "https://exemplo.com/b.jpg", href: "#/", label: "B", scroll: "", sort: 1 },
    { id: "__ready", image: "", href: "#/", label: "", scroll: "", sort: 1000 },
  ];
  assert.deepEqual(reorderBanners(publicBanners(rows), "a", 1).map((item) => item.id), ["b", "a"]);
  const now = new Date("2026-03-15T15:00:00Z");
  assert.deepEqual(visitBounds("prev", { now }), { from: "2026-02-01", to: "2026-02-28" });
  const summary = summarizeVisits([
    { created_at: "2026-03-02T15:00:00Z", path: "#/avulsos", visitor: "1.1.1.1", city: "Campinas" },
    { created_at: "2026-03-02T18:00:00Z", path: "#/", visitor: "1.1.1.1", city: "" },
    { created_at: "2026-01-02T15:00:00Z", path: "#/", visitor: "2.2.2.2", city: "Santos" },
  ], "month", { now });
  assert.equal(summary.rows.length, 2);
  assert.equal(summary.people, 1);
  assert.equal(summary.perDay[0].people, 1);
  assert.equal(summary.cities.some((city) => city.city === "Não informado"), true);
  assert.equal(buildVisit({ path: "", visitor: "1.1.1.1", city: "São Paulo" }).path, "/");
  const product = { id: "sv1-1", name: "Pikachu", number: "1/165", lang: "PT", condition: "NM", finish: "Normal", price: 10, kind: "single" };
  assert.equal(buyLabel(product), "Comprar");
  assert.equal(onOrder({ finish: "Sob encomenda", price: 0 }), true);
  assert.equal(forSale({ qty: 0, price: 199, finish: "NM" }), false);
  assert.equal(forSale({ qty: 1, price: 199, finish: "NM" }), true);
  assert.equal(forSale({ qty: 0, price: 0, finish: "Sob encomenda" }), true);
  assert.equal(buyLabel({ id: "me6-1", kind: "sealed", finish: "Lacrado", price: 20 }), "Reservar");
  assert.match(whatsappText(product, "Escarlate"), /Coleção: Escarlate/);
  assert.match(whatsappUrl("55 11 99999-9999", product, "Escarlate"), /^https:\/\/api\.whatsapp\.com\/send\?phone=5511999999999&text=/);
  assert.equal(whatsappUrl("", product, "Escarlate"), "");
});

test("logo da coleção usa o arquivo do me6 e troca o verso pelo símbolo", () => {
  assert.equal(setLogoSrc("me6"), "/assets/products/me06-logo.png");
  assert.equal(setLogoSrc("sv3"), "https://images.pokemontcg.io/sv3/logo.png");
  assert.equal(setLogoFallback("https://images.pokemontcg.io/sv3/logo.png", 640, 892), "https://images.pokemontcg.io/sv3/symbol.png");
  assert.equal(setLogoFallback("https://images.pokemontcg.io/sv3/logo.png", 80, 120), "https://images.pokemontcg.io/sv3/symbol.png");
  assert.equal(setLogoFallback("https://images.pokemontcg.io/sv3/symbol.png", 80, 120), "");
  assert.equal(setLogoFallback("https://images.pokemontcg.io/sv3/logo.png", 400, 120), "https://images.pokemontcg.io/sv3/logo.png");
  assert.equal(setLogoFallback("/assets/products/me06-logo.png", 0, 1), "");
});

test("master set pagina o catálogo e marca o nome em português", async () => {
  assert.equal(formatRelease("2025-01-17"), "17/01/2025");
  const pre = { id: "sv8pt5", name: "Prismatic Evolutions", ptcgoCode: "PRE", series: "Scarlet & Violet", releaseDate: "2025-01-17" };
  assert.equal(matchOfficial(pre, "prismáticas", { sv8pt5: "Evoluções Prismáticas" }), true);
  assert.equal(matchOfficial(pre, "pre", {}), true);
  assert.equal(matchOfficial(pre, "sv8pt5", {}), true);
  assert.equal(matchOfficial(pre, "charizard", {}), false);
  assert.equal(matchOfficial({ id: "sv9", name: "Journey Together", ptcgoCode: "JTG" }, "jornada conjunta", { sv9: "Amigos de Jornada" }), true);
  const saved = storeSetFromOfficial(pre, { sv8pt5: "Evoluções Prismáticas" }, 4);
  assert.equal(saved.row.name, "Evoluções Prismáticas");
  assert.equal(saved.row.code, "PRE");
  assert.equal(saved.row.sort, 4);
  let page = 0;
  const list = await fetchOfficialSets(async (url) => {
    page += 1;
    assert.match(url, /orderBy=-releaseDate/);
    assert.match(url, /pageSize=250/);
    if (page === 1) {
      return { ok: true, text: async () => JSON.stringify({ data: Array.from({ length: 250 }, (_, i) => ({ id: `s${i}`, name: `Set ${i}`, ptcgoCode: "AA", series: "X", releaseDate: "2024-01-01" })), totalCount: 251 }) };
    }
    return { ok: true, text: async () => JSON.stringify({ data: [pre], totalCount: 251 }) };
  });
  assert.equal(list.length, 251);
  assert.equal(list.at(-1).id, "sv8pt5");
});

test("proxy de carta tenta três vezes e repassa o JSON", async () => {
  let calls = 0;
  const fail = await handleTcg({ method: "GET", url: "/api/tcg?q=pikachu&page=0&pageSize=999" }, {
    attempts: 3,
    fetchImpl: async (_url, options) => {
      calls += 1;
      assert.equal(options.headers["User-Agent"], "AMD-TCG/1.0");
      throw new Error("rede");
    },
  });
  assert.equal(calls, 3);
  assert.equal(fail.status, 502);
  assert.deepEqual(JSON.parse(fail.body), { error: "Falha ao consultar o catálogo." });
  let attempt = 0;
  const ok = await handleTcg({ method: "GET", url: "/api/tcg?q=abra&pageSize=12" }, {
    fetchImpl: async (url) => {
      attempt += 1;
      assert.match(url, /select=id,name,number,rarity,set,images/);
      assert.match(url, /pageSize=12/);
      if (attempt < 2) return { ok: false, text: async () => "erro" };
      return { ok: true, text: async () => JSON.stringify({ data: [] }) };
    },
  });
  assert.equal(ok.status, 200);
  assert.equal(attempt, 2);
});

test("foto enviada vira JPEG com o maior lado em 900", () => {
  const raw = Buffer.alloc(1200 * 20 * 4, 255);
  const encoded = jpeg.encode({ data: raw, width: 1200, height: 20 }, 90);
  const input = `data:image/jpeg;base64,${Buffer.from(encoded.data).toString("base64")}`;
  const output = resizeJpegDataUrl(input);
  const decoded = jpeg.decode(Buffer.from(output.slice("data:image/jpeg;base64,".length), "base64"));
  assert.equal(decoded.width, 900);
  assert.ok(decoded.height < 20);
});

test("abas da loja entram, saem e mudam de lugar", () => {
  const made = buildTab({ label: "Sobre", href: "#/sobre", icon: "/assets/icons/info.png" }, []);
  assert.equal(made.ok, true);
  assert.equal(made.row.id, "sobre");
  assert.equal(buildTab({ label: "X", href: "javascript:alert(1)" }).ok, false);
  const moved = reorderTabs([
    { id: "a", label: "A", href: "#/", icon: "/assets/icons/home.png", sort: 0 },
    { id: "b", label: "B", href: "#/contato", icon: "/assets/icons/contact.png", sort: 1 },
  ], "b", -1);
  assert.equal(moved[0].id, "b");
  assert.equal(moved[0].sort, 0);
  assert.equal(publicTabs([]).length, 6);
});

test("schema cobre RLS, sentinela e a chave anon", () => {
  const sql = readFileSync(new URL("../supabase/schema.sql", import.meta.url), "utf8");
  assert.match(sql, /leitura publica sets/);
  assert.match(sql, /escrita autenticada products/);
  assert.match(sql, /registrar visita/);
  assert.match(sql, /visits_visitor_day/);
  assert.match(sql, /__ready/);
  assert.match(sql, /on delete restrict/);
  assert.doesNotMatch(sql, /grant [^;]*service_role/i);
  const config = readFileSync(new URL("../js/config.js", import.meta.url), "utf8");
  assert.match(config, /khqbsdgmtryaiodlsxmh/);
  assert.match(sql, /public\.tabs/);
  assert.match(sql, /leitura publica tabs/);
  assert.match(config, /WHATSAPP_PHONE = "5511939326547"/);
  assert.doesNotMatch(config, /"role":"service_role"/);
});
