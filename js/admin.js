import { client } from "/js/supabase.js";
import { BANNER_MAX_WIDTH, BANNER_QUALITY, PHOTO_MAX_SIDE, PHOTO_QUALITY, isCardBack, productImage, sanitizeImage } from "/lib/image.mjs?v=2";
import { cardDraft, findDirectCards, parseCardSearch, printingsOf, searchCardNames } from "/lib/cards.mjs";
import { sealedDraft } from "/lib/sealed-draft.mjs";
import { LABEL_ORDER } from "/lib/sealed-match.mjs";
import { BANNER_DESTINATIONS, buildBanner, publicBanners, reorderBanners } from "/lib/banners.mjs";
import { TAB_ICONS, buildTab, reorderTabs } from "/lib/tabs.mjs";
import { buildSet, searchSets, setDeleteError, sortSets } from "/lib/sets.mjs";
import { SET_PT } from "/lib/official-sets.mjs";
import { bindSetLogos, setLogoSrc } from "/js/set-logo.js";
import { buildProduct, displayKind, duplicateProduct, filterProducts, productFromQuery, removedError, stepQty, stockValue } from "/lib/products.mjs";
import { money } from "/lib/shop.mjs";
import { summarizeVisits } from "/lib/visits.mjs";
import { esc } from "/lib/text.mjs";

const app = document.getElementById("app");
let sb = null;
let session = null;
let sets = [];
let products = [];
let banners = [];
let tabs = [];
let tabsError = "";
let visits = [];
let view = "home";
let message = "";
let stockQuery = "";
let stockKind = "all";
let stockLevel = "all";
let visitRange = "month";
let visitFrom = "";
let visitTo = "";
let editor = null;
let setEditing = null;
let bannerEditing = null;
let bannerImage = "";
let tabEditing = null;
let searchToken = 0;
let searchTimer = 0;

const LANGS = [["PT", "Português", "🇧🇷"], ["EN", "Inglês", "🇺🇸"], ["JP", "Japonês", "🇯🇵"], ["KO", "Coreano", "🇰🇷"], ["ZH", "Chinês", "🇨🇳"], ["ES", "Espanhol", "🇪🇸"], ["FR", "Francês", "🇫🇷"], ["DE", "Alemão", "🇩🇪"], ["IT", "Italiano", "🇮🇹"]];
const CONDITIONS = ["NM", "LP", "MP", "HP", "DMG"];

function setName(id) {
  return sets.find((set) => set.id === id)?.name || id || "Sem coleção";
}

function kindLabel(product) {
  const kind = displayKind(product);
  if (kind === "presale") return "Pré-venda";
  if (kind === "master") return "Master set";
  if (kind === "sealed") return "Lacrado";
  return "Avulso";
}

async function fetchPage(q, pageSize, page) {
  const response = await fetch(`/api/tcg?q=${encodeURIComponent(q)}&page=${page}&pageSize=${pageSize}`);
  if (!response.ok) return null;
  const payload = await response.json();
  return Array.isArray(payload.data) ? payload.data : null;
}

function readPhoto(file, { maxSide = 0, maxWidth = 0, quality = PHOTO_QUALITY } = {}) {
  return new Promise((resolve, reject) => {
    const image = new Image();
    const url = URL.createObjectURL(file);
    image.onload = () => {
      const scale = maxWidth ? Math.min(1, maxWidth / image.width) : Math.min(1, (maxSide || PHOTO_MAX_SIDE) / Math.max(image.width, image.height));
      const canvas = document.createElement("canvas");
      canvas.width = Math.max(1, Math.round(image.width * scale));
      canvas.height = Math.max(1, Math.round(image.height * scale));
      canvas.getContext("2d").drawImage(image, 0, 0, canvas.width, canvas.height);
      URL.revokeObjectURL(url);
      resolve(canvas.toDataURL("image/jpeg", quality));
    };
    image.onerror = () => { URL.revokeObjectURL(url); reject(new Error("Não foi possível ler a foto.")); };
    image.src = url;
  });
}

function field(name, label, value, type = "text") {
  return `<label>${esc(label)}<input name="${esc(name)}" type="${type}" value="${esc(value ?? "")}" /></label>`;
}

function conditionField(current) {
  const value = String(current || "NM");
  const known = CONDITIONS.includes(value) ? CONDITIONS : [...CONDITIONS, value];
  return `
    <div>
      <label>Estado de conservação<select name="condition">${known.map((item) => `<option value="${esc(item)}"${item === value ? " selected" : ""}>${esc(item)}</option>`).join("")}</select></label>
      <div class="condition-add">
        <input id="condition-new" type="text" maxlength="24" placeholder="Novo estado" />
        <button class="ghost" type="button" id="condition-add">Adicionar</button>
      </div>
    </div>`;
}

function catalogRows() {
  return filterProducts(products, { query: stockQuery, kind: stockKind, sets, fields: "catalog" });
}

function inventoryRows() {
  const found = filterProducts(products, { query: stockQuery, sets, fields: "catalog" });
  if (stockLevel === "low") return found.filter((product) => Number(product.qty) === 1);
  if (stockLevel === "out") return found.filter((product) => Number(product.qty) === 0);
  return found;
}

function productRows(list) {
  if (!list.length) return `<p class="muted">Nenhum item.</p>`;
  return list.map((product) => {
    const master = displayKind(product) === "master";
    const logo = master ? setLogoSrc(product.set_id) : "";
    const photo = master ? "" : productImage(product);
    const thumb = master
      ? (logo ? `<img class="thumb" alt="" src="${esc(logo)}" data-set-logo />` : `<span class="thumb"></span>`)
      : (photo ? `<img class="thumb" alt="" src="${esc(photo)}" data-card />` : `<span class="thumb"></span>`);
    return `
    <div class="row${master ? " master-row" : ""}">
      ${thumb}
      <div><strong>${esc(product.name)}</strong><p>${LANGS.find((item) => item[0] === product.lang)?.[2] || ""} ${esc(setName(product.set_id))} · ${esc(kindLabel(product))}${product.number ? ` · ${esc(product.number)}` : ""}</p></div>
      <div class="qty-step">
        <button type="button" data-qty="-1" data-id="${esc(product.id)}" aria-label="Diminuir">−</button>
        <b>${esc(product.qty)}</b>
        <button type="button" data-qty="1" data-id="${esc(product.id)}" aria-label="Aumentar">+</button>
      </div>
      <div class="actions">
        <strong>${esc(money(product.price))}</strong>
        <button class="ghost" type="button" data-edit="${esc(product.id)}">Editar</button>
        <button class="ghost danger" type="button" data-remove="${esc(product.id)}">Apagar</button>
      </div>
    </div>`;
  }).join("");
}

function icon(name) {
  const paths = {
    home: '<rect x="3" y="3" width="7" height="7" rx="1.5"/><rect x="14" y="3" width="7" height="7" rx="1.5"/><rect x="3" y="14" width="7" height="7" rx="1.5"/><rect x="14" y="14" width="7" height="7" rx="1.5"/>',
    stock: '<path d="M4 8h16v11a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1V8z"/><path d="M4 8l2-4h12l2 4"/><path d="M9 12h6"/>',
    inventory: '<path d="M3 7l9-4 9 4-9 4-9-4z"/><path d="M3 12l9 4 9-4"/><path d="M3 17l9 4 9-4"/>',
    sets: '<rect x="4" y="4" width="12" height="16" rx="2"/><path d="M8 4v16"/><path d="M16 8h4v12a2 2 0 0 1-2 2h-2"/>',
    master: '<path d="M12 3l2.2 4.6L19 8.2l-3.5 3.4.8 4.9L12 14.2 7.7 16.5l.8-4.9L5 8.2l4.8-.6L12 3z"/>',
    banners: '<rect x="3" y="5" width="18" height="14" rx="2"/><path d="M3 15l5-4 4 3 3-2 6 5"/>',
    tabs: '<rect x="3" y="6" width="18" height="13" rx="2"/><path d="M7 6V4h6v2"/>',
    visits: '<path d="M4 19V10"/><path d="M10 19V5"/><path d="M16 19v-7"/><path d="M3 19h18"/>',
  };
  return `<svg class="ico" viewBox="0 0 24 24" aria-hidden="true">${paths[name] || ""}</svg>`;
}

function shell(title, body) {
  const item = (id, label) => `<button type="button" data-view="${id}" class="${view === id ? "is-on" : ""}">${icon(id)}<span>${label}</span></button>`;
  return `
    <div class="desk">
      <aside class="side">
        <a class="brand" href="/admin"><img src="/assets/logo.png" alt="" width="56" height="48" /><strong>Painel</strong></a>
        <nav class="menu" aria-label="Painel">
          <p class="group-label">Loja</p>
          ${item("home", "Visão geral")}
          ${item("stock", "Vitrine")}
          ${item("inventory", "Estoque")}
          ${item("sets", "Coleções")}
          ${item("master", "Master Set")}
          <p class="group-label">Site</p>
          ${item("banners", "Banners")}
          ${item("tabs", "Abas")}
          ${item("visits", "Visitas")}
        </nav>
        <div class="side-foot">
          <span class="muted">${esc(session.user.email)}</span>
          <button class="ghost" type="button" data-logout>Sair</button>
        </div>
      </aside>
      <div class="work">
        <div class="mobile-bar">
          <span class="muted">${esc(session.user.email)}</span>
          <button class="ghost" type="button" data-logout>Sair</button>
        </div>
        <h1>${esc(title)}</h1>
        <div id="editor"></div>
        <p class="msg" id="desk-msg">${esc(message)}</p>
        ${body}
        <p class="credit">Site desenvolvido por <a href="https://felipeseussites.vercel.app" target="_blank" rel="noopener noreferrer">Felipe</a></p>
      </div>
    </div>`;
}

function homeView() {
  const singles = products.filter((product) => displayKind(product) === "single");
  const presale = products.filter((product) => displayKind(product) === "presale");
  const sealed = products.filter((product) => displayKind(product) === "sealed");
  const low = products.filter((product) => Number(product.qty) <= 1);
  return shell("Visão geral", `
    <div class="stats">
      <div><span>Itens</span><b>${products.length}</b></div>
      <div><span>Avulsos</span><b>${singles.length}</b></div>
      <div><span>Pré-venda</span><b>${presale.length}</b></div>
      <div><span>Lacrados</span><b>${sealed.length}</b></div>
      <div><span>Master sets</span><b>${products.filter((product) => displayKind(product) === "master").length}</b></div>
      <div><span>Valor em estoque</span><b>${esc(money(stockValue(products)))}</b></div>
    </div>
    <section>
      <h2>Com 1 ou 0</h2>
      <div id="plist">${productRows(low)}</div>
      <div class="actions">
        <button class="solid" type="button" id="add-card">Adicionar carta</button>
        <button class="solid" type="button" id="add-sealed">Adicionar lacrado</button>
        <button class="ghost" type="button" id="add-presale">Adicionar pré-venda</button>
      </div>
    </section>`);
}

function stockView() {
  return shell("Vitrine", `
    <div class="toolbar">
      <input id="stock-q" type="search" placeholder="Nome, número ou coleção" value="${esc(stockQuery)}" />
      <select id="stock-kind">
        ${[["all", "Tudo"], ["single", "Avulsos"], ["presale", "Pré-venda"], ["sealed", "Lacrados"], ["master", "Master sets"]].map(([value, label]) => `<option value="${value}"${stockKind === value ? " selected" : ""}>${label}</option>`).join("")}
      </select>
    </div>
    <div class="actions">
      <button class="solid" type="button" id="add-card">Adicionar carta</button>
      <button class="solid" type="button" id="add-sealed">Adicionar lacrado</button>
      <button class="ghost" type="button" id="add-presale">Adicionar pré-venda</button>
    </div>
    <div id="plist">${productRows(catalogRows())}</div>`);
}

function inventoryView() {
  return shell("Estoque", `
    <div class="toolbar">
      <input id="stock-q" type="search" placeholder="Buscar no estoque" value="${esc(stockQuery)}" />
      <select id="stock-level">
        ${[["all", "Tudo"], ["low", "Baixo"], ["out", "Zerado"]].map(([value, label]) => `<option value="${value}"${stockLevel === value ? " selected" : ""}>${label}</option>`).join("")}
      </select>
    </div>
    <div id="plist">${productRows(inventoryRows())}</div>`);
}

function setsView() {
  const rows = sortSets(sets).map((set) => `
    <div class="row">
      <span></span>
      <div><strong>${esc(set.name)}</strong><p>${esc(set.code)} · ${esc(set.id)}</p></div>
      <button class="ghost" type="button" data-set="${esc(set.id)}">Editar</button>
      <button class="ghost danger" type="button" data-set-remove="${esc(set.id)}">Apagar</button>
    </div>`).join("");
  const current = setEditing ? sets.find((set) => set.id === setEditing) : null;
  return shell("Coleções", `
    <form id="set-form" class="set-form" method="post" action="/admin">
      ${current ? `<p class="muted">${esc(current.id)}</p><input type="hidden" name="id" value="${esc(current.id)}" />` : field("id", "Código", "")}
      ${field("code", "Sigla", current?.code || "")}
      ${field("name", "Nome", current?.name || "")}
      <button class="solid" type="submit">${current ? "Salvar coleção" : "Criar coleção"}</button>
    </form>
    <div>${rows || `<p class="muted">Nenhuma coleção.</p>`}</div>`);
}

function masterView() {
  const list = products.filter((product) => displayKind(product) === "master");
  return shell("Master Set", `
    <p class="lede">Master sets completos à venda na loja. O código começa com master-.</p>
    <div class="actions">
      <button class="solid" type="button" id="add-master">Adicionar master set</button>
    </div>
    <div id="plist">${list.length ? productRows(list) : `<p class="muted">Nenhum master set à venda.</p>`}</div>`);
}

function bannersView() {
  const list = publicBanners(banners);
  const rows = list.map((banner) => `
    <div class="banner-row">
      <img src="${esc(banner.image)}" alt="" />
      <div><strong>${esc(banner.label)}</strong><p class="muted">${esc(banner.href)}</p></div>
      <div class="actions">
        <button class="ghost" type="button" data-banner-move="${esc(banner.id)}" data-dir="-1">Subir</button>
        <button class="ghost" type="button" data-banner-move="${esc(banner.id)}" data-dir="1">Descer</button>
        <button class="ghost" type="button" data-banner="${esc(banner.id)}">Editar</button>
        <button class="ghost danger" type="button" data-banner-remove="${esc(banner.id)}">Apagar</button>
      </div>
    </div>`).join("");
  return shell("Banners", `
    <button class="solid" type="button" id="add-banner">Adicionar banner</button>
    <div>${rows || `<p class="muted">Nenhum banner ainda.</p>`}</div>`);
}

function tabsView() {
  const list = tabs.slice().sort((a, b) => Number(a.sort) - Number(b.sort) || String(a.label).localeCompare(String(b.label), "pt"));
  const rows = list.map((tab) => `
    <div class="tab-row">
      <img src="${esc(tab.icon)}" alt="" />
      <div><strong>${esc(tab.label)}</strong><p class="muted">${esc(tab.href)}</p></div>
      <div class="actions">
        <button class="ghost" type="button" data-tab-move="${esc(tab.id)}" data-dir="-1">Subir</button>
        <button class="ghost" type="button" data-tab-move="${esc(tab.id)}" data-dir="1">Descer</button>
        <button class="ghost" type="button" data-tab="${esc(tab.id)}">Editar</button>
        <button class="ghost danger" type="button" data-tab-remove="${esc(tab.id)}">Apagar</button>
      </div>
    </div>`).join("");
  const note = tabsError ? `<p class="msg">${esc(tabsError)}</p>` : "";
  return shell("Abas", `
    ${note}
    <button class="solid" type="button" id="add-tab">Adicionar aba</button>
    <div>${rows || `<p class="muted">Nenhuma aba ainda. A loja mostra as abas padrão até você salvar a primeira.</p>`}</div>`);
}

function visitsView() {
  const summary = summarizeVisits(visits, visitRange, { from: visitFrom, to: visitTo });
  const max = Math.max(1, ...summary.perDay.map((day) => day.people));
  return shell("Visitas", `
    <div class="toolbar">
      ${[["month", "Este mês"], ["prev", "Mês anterior"], ["all", "Tudo"]].map(([value, label]) => `<button class="ghost${visitRange === value ? " is-on" : ""}" type="button" data-range="${value}">${label}</button>`).join("")}
      <input id="visit-from" type="date" value="${esc(visitFrom)}" />
      <input id="visit-to" type="date" value="${esc(visitTo)}" />
    </div>
    <div class="stats">
      <div><span>Pessoas</span><b>${summary.people}</b></div>
      <div><span>Visitas</span><b>${summary.rows.length}</b></div>
      <div><span>Hoje</span><b>${summary.today}</b></div>
    </div>
    <h2>Pessoas por dia</h2>
    <div class="bars">${summary.perDay.map((day) => `<div class="bar-col"><b>${day.people}</b><i style="height:${Math.max(6, Math.round(day.people / max * 100))}px"></i><small>${esc(day.label)}</small></div>`).join("") || `<p class="muted">Nenhuma visita neste período.</p>`}</div>
    <h2>Páginas</h2>
    ${summary.pages.map((page) => `<div class="rank"><span>${esc(page.label)}</span><strong>${page.count}</strong></div>`).join("") || `<p class="muted">Sem páginas.</p>`}
    <h2>Cidades</h2>
    ${summary.cities.map((city) => `<div class="rank"><span>${esc(city.city)}</span><strong>${city.count}</strong></div>`).join("") || `<p class="muted">Sem cidades.</p>`}
    <h2>Últimas</h2>
    ${summary.rows.slice(0, 20).map((visit) => `<div class="rank"><span>${esc(visit.visitor || "—")}</span><span>${esc(visit.city || "—")}</span><span>${esc(visit.path || "/")}</span></div>`).join("")}`);
}

function editorHtml() {
  if (!editor) return "";
  const product = editor.product;
  const kind = editor.kind;
  const master = kind === "master";
  const sealed = kind !== "single";
  const p = product || { id: "", name: "", set_id: "", number: "", rarity: "", condition: master ? "Completo" : "NM", lang: "PT", finish: master ? "Master Set" : sealed ? "Lacrado" : "Normal", qty: 1, price: "" };
  const logo = master ? setLogoSrc(p.set_id) : "";
  const preview = master ? logo : (editor.image || "");
  const search = master ? "" : sealed ? `
      <label>Coleção do produto<input id="sealed-q" type="search" placeholder="Evoluções Prismáticas" autocomplete="off" /></label>
      <div id="sealed-types" class="types"></div>
      <div id="sealed-hits" class="hits"></div>` : `
      <label>Nome<input id="poke-name" type="search" placeholder="Charizard ou Nome 25/165" autocomplete="off" /></label>
      <div id="poke-names" class="names"></div>
      <label>Filtrar impressão<input id="poke-number" type="search" placeholder="Número ou código" autocomplete="off" /></label>
      <div id="card-hits" class="hits"></div>`;
  return `
    <form id="editor-form" class="editor" method="post" action="/admin">
      <h2>${product ? "Editar" : master ? "Novo master set" : kind === "presale" ? "Nova pré-venda" : sealed ? "Novo lacrado" : "Nova carta"}</h2>
      <input type="hidden" name="kind" value="${kind === "single" ? "single" : kind === "presale" ? "presale" : master ? "master" : "sealed"}" />
      ${search}
      ${master
        ? (preview ? `<img class="preview logo-preview" id="photo-preview" alt="" src="${esc(preview)}" data-set-logo />` : `<p class="muted" id="photo-preview">Escolha a coleção para usar a logo.</p>`)
        : (preview ? `<img class="preview" id="photo-preview" alt="" src="${esc(preview)}" data-card />` : `<p class="muted" id="photo-preview">Sem foto</p>`)}
      ${master ? "" : `<div class="actions">
        <label class="ghost">Trocar a foto<input id="photo-file" type="file" accept="image/*" hidden /></label>
        <button class="ghost" type="button" id="photo-clear">Tirar foto</button>
      </div>`}
      <div class="two">${field("id", "Código", p.id)}${field("name", "Nome", p.name)}</div>
      <input type="hidden" name="set_id" value="${esc(p.set_id || "")}" />
      <label>Coleção da loja<input id="set-q" type="search" placeholder="Buscar coleção" autocomplete="off" value="${esc(p.set_id ? setName(p.set_id) : "")}" /></label>
      <div id="set-hits" class="names"></div>
      <p class="muted" id="set-chosen">${p.set_id ? esc(setName(p.set_id)) : "Nenhuma coleção escolhida."}</p>
      ${sealed ? `<input type="hidden" name="number" value="" /><input type="hidden" name="rarity" value="${esc(p.rarity || "")}" />` : `<div class="two">${field("number", "Número", p.number)}${field("rarity", "Raridade", p.rarity)}</div>`}
      <div class="two">
        ${sealed ? "" : conditionField(p.condition || "NM")}
        <label>Idioma<select name="lang">${LANGS.map(([code, label, flag]) => `<option value="${code}"${(p.lang || "PT") === code ? " selected" : ""}>${flag} ${label}</option>`).join("")}</select></label>
      </div>
      ${sealed ? `<input type="hidden" name="condition" value="${esc(p.condition || "NM")}" /><input type="hidden" name="finish" value="${esc(p.finish || "Lacrado")}" />` : field("finish", "Acabamento", p.finish || "Normal")}
      <div class="two">${field("qty", "Quantidade", p.qty, "number")}${field("price", "Preço", p.price === 0 || p.price ? p.price : "", "text")}</div>
      ${kind === "presale" ? `<p class="muted">Para aparecer como pré-venda, o código precisa começar com me6-.</p>` : ""}
      ${master ? `<p class="muted">A logo da coleção escolhida aparece na loja. O código precisa começar com master-.</p>` : ""}
      <div class="actions">
        <button class="solid" type="submit">Salvar</button>
        ${product ? `<button class="ghost" type="button" id="copy">Duplicar</button>` : ""}
        ${product ? `<button class="ghost danger" type="button" id="remove-open">Apagar</button>` : ""}
        <button class="ghost" type="button" id="editor-cancel">Cancelar</button>
      </div>
    </form>`;
}

function bannerDest(row) {
  if (!row) return "prevenda";
  if (String(row.href || "").startsWith("https://")) return "external";
  const found = BANNER_DESTINATIONS.find((item) => item.href === row.href);
  return found?.id || "prevenda";
}

function bannerFormHtml() {
  if (!bannerEditing) return "";
  const row = bannerEditing === "new" ? null : banners.find((item) => item.id === bannerEditing);
  const dest = bannerDest(row);
  const options = [...BANNER_DESTINATIONS.map((item) => [item.id, item.label]), ["external", "Link externo"]];
  return `
    <form id="banner-form" class="banner-form" method="post" action="/admin">
      <h2>${row ? "Editar banner" : "Novo banner"}</h2>
      ${bannerImage ? `<img class="preview" id="banner-preview" alt="" src="${esc(bannerImage)}" />` : `<p class="muted" id="banner-preview">Escolha a imagem.</p>`}
      <label class="ghost">Imagem<input id="banner-file" type="file" accept="image/*" hidden /></label>
      ${field("label", "Nome", row?.label || "")}
      <label>Destino<select name="dest" id="banner-dest">${options.map(([value, label]) => `<option value="${value}"${dest === value ? " selected" : ""}>${label}</option>`).join("")}</select></label>
      <label id="banner-url"${dest === "external" ? "" : " hidden"}>Endereço https<input name="url" type="url" placeholder="https://" value="${esc(dest === "external" ? row?.href || "" : "")}" /></label>
      <div class="actions">
        <button class="solid" type="submit">Salvar banner</button>
        <button class="ghost" type="button" id="banner-cancel">Cancelar</button>
      </div>
    </form>`;
}

function tabFormHtml() {
  if (!tabEditing) return "";
  const row = tabEditing === "new" ? null : tabs.find((item) => item.id === tabEditing);
  const icon = row?.icon || TAB_ICONS[0].src;
  return `
    <form id="tab-form" class="banner-form" method="post" action="/admin">
      <h2>${row ? "Editar aba" : "Nova aba"}</h2>
      ${row ? `<input type="hidden" name="id" value="${esc(row.id)}" />` : field("id", "Código", "")}
      ${field("label", "Nome", row?.label || "")}
      ${field("href", "Link", row?.href || "#/")}
      <label>Ícone<select name="icon">${TAB_ICONS.map((item) => `<option value="${esc(item.src)}"${icon === item.src ? " selected" : ""}>${esc(item.label)}</option>`).join("")}</select></label>
      <p class="muted">Use #/ para o início, #/avulsos para uma página da loja, ou um endereço https://.</p>
      <div class="actions">
        <button class="solid" type="submit">Salvar aba</button>
        <button class="ghost" type="button" id="tab-cancel">Cancelar</button>
      </div>
    </form>`;
}

function render() {
  if (!session) {
    app.innerHTML = `
      <div class="login">
        <form id="login" method="post" action="/admin">
          <img src="/assets/logo.png" alt="Master Bu" width="102" height="88" />
          <h1>Painel</h1>
          <p class="muted">Entre com o e-mail e a senha do administrador.</p>
          <label>E-mail<input name="email" type="email" autocomplete="username" required /></label>
          <label>Senha<input name="password" type="password" autocomplete="current-password" required /></label>
          <button class="solid" type="submit">Entrar</button>
          <p class="msg" id="login-msg"></p>
          <a href="/">Voltar para a loja</a>
          <p class="credit">Site desenvolvido por <a href="https://felipeseussites.vercel.app" target="_blank" rel="noopener noreferrer">Felipe</a></p>
        </form>
      </div>`;
    document.getElementById("login").addEventListener("submit", login);
    return;
  }
  const views = { home: homeView, stock: stockView, inventory: inventoryView, sets: setsView, master: masterView, banners: bannersView, tabs: tabsView, visits: visitsView };
  app.innerHTML = (views[view] || homeView)();
  const slot = document.getElementById("editor");
  if (editor?.kind) slot.innerHTML = editorHtml();
  else if (bannerEditing) slot.innerHTML = bannerFormHtml();
  else if (tabEditing) slot.innerHTML = tabFormHtml();
  bindCardImages();
  bindSetLogos(app);
}

function bindCardImages() {
  app.querySelectorAll("[data-card]").forEach((img) => {
    const show = () => {
      if (!img.getAttribute("src")) return;
      img.hidden = isCardBack(img.naturalWidth, img.naturalHeight);
    };
    img.addEventListener("load", show);
    img.addEventListener("error", () => { img.hidden = true; });
    if (img.complete && img.getAttribute("src")) show();
    else if (img.getAttribute("src")) img.hidden = false;
  });
}

async function login(event) {
  event.preventDefault();
  const form = new FormData(event.target);
  const { error } = await sb.auth.signInWithPassword({
    email: String(form.get("email") || ""),
    password: String(form.get("password") || ""),
  });
  const msg = document.getElementById("login-msg");
  if (error) { msg.textContent = error.message; return; }
  const { data } = await sb.auth.getSession();
  session = data.session;
  await reload();
}

async function reload() {
  const [setRes, productRes, bannerRes, tabRes] = await Promise.all([
    sb.from("sets").select("id,name,code,sort").order("sort"),
    sb.from("products").select("*").order("name"),
    sb.from("banners").select("id,image,href,label,scroll,sort").order("sort"),
    sb.from("tabs").select("id,label,href,icon,sort").order("sort"),
  ]);
  if (setRes.error || productRes.error || bannerRes.error) {
    message = (setRes.error || productRes.error || bannerRes.error).message;
  }
  sets = setRes.data || [];
  products = productRes.data || [];
  banners = bannerRes.data || [];
  tabs = tabRes.data || [];
  tabsError = tabRes.error ? tabRes.error.message : "";
  if (view === "visits") {
    const result = await sb.from("visits").select("created_at,path,visitor,city").order("created_at", { ascending: false }).limit(4000);
    visits = result.data || [];
    if (result.error) message = result.error.message;
  }
  render();
}

function openEditor(product, kind) {
  bannerEditing = null;
  bannerImage = "";
  tabEditing = null;
  const nextKind = product ? displayKind(product) : kind;
  editor = {
    product: product || null,
    kind: nextKind,
    image: nextKind === "master" ? setLogoSrc(product?.set_id) : (product?.image || ""),
    cards: [],
    chosen: "",
    sealed: [],
    sealedType: "Todos",
  };
  if (nextKind === "master") view = "master";
  else if (view !== "stock" && view !== "home" && view !== "inventory") view = "stock";
  render();
  document.getElementById("editor")?.scrollIntoView({ block: "start" });
  if (product && nextKind !== "single") {
    const query = product.name || setName(product.set_id);
    const input = document.getElementById("sealed-q");
    if (input && query) {
      input.value = query;
      runSealedSearch(query);
    }
  }
}

function chooseSet(set) {
  const form = document.getElementById("editor-form");
  if (!form || !set) return;
  form.elements.set_id.value = set.id;
  document.getElementById("set-chosen").textContent = set.name;
  document.getElementById("set-q").value = set.name;
  document.getElementById("set-hits").innerHTML = "";
  if (editor?.kind === "master") {
    editor.image = setLogoSrc(set.id);
    showLogoPreview(editor.image);
  }
}

function rememberSet(set) {
  if (!set?.id) return;
  if (!sets.some((item) => item.id === set.id) && !editor.extra?.some((item) => item.id === set.id)) {
    editor.extra = (editor.extra || []).concat([{ ...set, sort: sets.length }]);
  }
}

function knownSets() {
  return sets.concat(editor?.extra || []);
}

function showLogoPreview(src) {
  const current = document.getElementById("photo-preview");
  if (!current) return;
  if (!src) {
    current.outerHTML = `<p class="muted" id="photo-preview">Escolha a coleção para usar a logo.</p>`;
    return;
  }
  if (current.tagName === "IMG") {
    current.src = src;
    current.classList.add("logo-preview");
    current.setAttribute("data-set-logo", "");
    delete current.dataset.bound;
  } else current.outerHTML = `<img class="preview logo-preview" id="photo-preview" alt="" src="${esc(src)}" data-set-logo />`;
  bindSetLogos(document.getElementById("editor") || app);
}

function showPreview(src) {
  const current = document.getElementById("photo-preview");
  if (!current) return;
  if (!src) {
    current.outerHTML = `<p class="muted" id="photo-preview">Sem foto</p>`;
    return;
  }
  if (current.tagName === "IMG") current.src = src;
  else current.outerHTML = `<img class="preview" id="photo-preview" alt="" src="${esc(src)}" data-card />`;
  bindCardImages();
}

function paintNames(names) {
  const box = document.getElementById("poke-names");
  if (!box) return;
  box.innerHTML = names.length ? names.map((name) => `<button type="button" data-name="${esc(name)}">${esc(name)}</button>`).join("") : `<p class="muted">Nenhum nome.</p>`;
}

function paintPrintings(list) {
  const box = document.getElementById("card-hits");
  if (!box) return;
  editor.printings = list;
  box.innerHTML = list.length ? list.map((item, index) => `
    <button type="button" data-print="${index}">
      ${item.image ? `<img src="${esc(item.image)}" alt="" data-card />` : ""}
      <strong>${esc(item.displayNumber)}</strong>
      <span>${esc(item.setLabel)}</span>
    </button>`).join("") : `<p class="muted">Nenhuma impressão.</p>`;
  bindCardImages();
}

async function runCardSearch(text) {
  const token = ++searchToken;
  const parsed = parseCardSearch(text);
  const direct = parsed && (parsed.number || parsed.printed) && (parsed.name.length >= 2 || !parsed.name);
  if (direct) {
    const result = await findDirectCards(text, fetchPage, knownSets());
    if (token !== searchToken) return;
    paintNames([]);
    if (result.error) { message = result.error; document.getElementById("desk-msg").textContent = message; paintPrintings([]); return; }
    paintPrintings(result.printings);
    return;
  }
  const result = await searchCardNames(text, fetchPage, knownSets());
  if (token !== searchToken) return;
  if (result.error) { message = result.error; document.getElementById("desk-msg").textContent = message; return; }
  editor.cards = result.cards;
  paintNames(result.names);
  if (result.chosen) {
    editor.chosen = result.chosen;
    paintPrintings(result.printings);
  } else paintPrintings([]);
}

function applyCard(card) {
  const draft = cardDraft(card);
  const form = document.getElementById("editor-form");
  form.elements.id.value = draft.id;
  form.elements.name.value = draft.name;
  form.elements.number.value = draft.number;
  form.elements.rarity.value = draft.rarity;
  if (!form.elements.finish.value || form.elements.finish.value === "Normal" || form.elements.finish.value === "Foil") form.elements.finish.value = draft.finish;
  form.elements.condition.value = form.elements.condition.value || "NM";
  rememberSet(draft.set);
  chooseSet(draft.set);
  editor.image = draft.image;
  showPreview(draft.image);
}

function paintSealed() {
  const types = document.getElementById("sealed-types");
  const box = document.getElementById("sealed-hits");
  if (!types || !box) return;
  const labels = [...new Set(editor.sealed.map((item) => item.label))].sort((a, b) => LABEL_ORDER.indexOf(a) - LABEL_ORDER.indexOf(b));
  types.innerHTML = ["Todos", ...labels].map((label) => `<button type="button" data-seal-type="${esc(label)}">${esc(label)}</button>`).join("");
  const list = editor.sealed.filter((item) => editor.sealedType === "Todos" || item.label === editor.sealedType);
  editor.sealedView = list;
  box.innerHTML = list.map((item, index) => `
    <button type="button" data-seal-item="${index}">
      <img src="${esc(item.image)}" alt="" />
      <strong>${esc(item.label)}</strong>
      <span>${esc(item.name)}</span>
    </button>`).join("") || `<p class="muted">Nenhum lacrado.</p>`;
}

async function runSealedSearch(text) {
  const box = document.getElementById("sealed-hits");
  if (!box) return;
  if (text.trim().length < 2) { box.innerHTML = ""; return; }
  box.innerHTML = `<p class="muted">Buscando lacrados…</p>`;
  try {
    const response = await fetch(`/api/sealed?q=${encodeURIComponent(text.trim())}`);
    const payload = await response.json();
    if (!response.ok) throw new Error(payload.error || "Falha ao consultar os lacrados.");
    editor.sealed = payload.items || [];
    if (!editor.sealed.some((item) => item.label === editor.sealedType)) editor.sealedType = "Todos";
    paintSealed();
  } catch (error) {
    box.innerHTML = `<p class="muted">${esc(error.message)}</p>`;
  }
}

function applySealed(item) {
  const form = document.getElementById("editor-form");
  const draft = sealedDraft(item, { id: form.elements.id.value, finish: form.elements.finish.value, qty: form.elements.qty.value, lang: form.elements.lang.value });
  if (!form.elements.name.value.trim()) {
    if (!form.elements.id.value) form.elements.id.value = draft.id;
    form.elements.name.value = draft.name;
    form.elements.rarity.value = draft.rarity;
    form.elements.finish.value = draft.finish;
  }
  editor.image = draft.image;
  showPreview(draft.image);
}

function withCardImage(row) {
  if (row.image || row.kind !== "single") return row;
  return { ...row, image: sanitizeImage(productImage(row)) };
}

async function persistProduct(row, set) {
  const setRow = buildSet({ ...set, sort: set.sort ?? sets.length });
  if (!setRow.ok) return setRow.error;
  const setSave = await sb.from("sets").upsert(setRow.row);
  if (setSave.error) return setSave.error.message;
  const saved = await sb.from("products").upsert(withCardImage(row));
  if (saved.error) return saved.error.message;
  return "";
}

async function saveProduct(event) {
  event.preventDefault();
  const form = new FormData(event.target);
  const kind = String(form.get("kind") || "");
  const built = buildProduct({
    id: form.get("id"),
    kind,
    name: form.get("name"),
    set_id: form.get("set_id"),
    number: form.get("number"),
    rarity: form.get("rarity"),
    condition: form.get("condition"),
    lang: form.get("lang"),
    finish: form.get("finish"),
    qty: form.get("qty"),
    price: form.get("price"),
    image: kind === "master" ? setLogoSrc(form.get("set_id")) : (editor?.image || ""),
  });
  const note = document.getElementById("desk-msg");
  const fail = (text) => { message = text; if (note) note.textContent = text; };
  if (!built.ok) { fail(built.error); return; }
  if (kind === "presale" && !built.row.id.startsWith("me6-")) {
    fail("Para aparecer como pré-venda, o código precisa começar com me6-.");
    return;
  }
  if (kind === "master" && !built.row.id.startsWith("master-")) {
    fail("Para aparecer como master set, o código precisa começar com master-.");
    return;
  }
  const set = knownSets().find((item) => item.id === built.row.set_id);
  if (!set) { fail("Escolha a coleção."); return; }
  const error = await persistProduct(built.row, set);
  if (error) { fail(error); return; }
  message = "Item salvo.";
  editor = null;
  await reload();
}

async function saveProductFromQuery() {
  const built = productFromQuery(new URLSearchParams(location.search));
  if (!built) return;
  history.replaceState(null, "", "/admin");
  if (!built.ok) { message = built.error; return; }
  const current = sets.find((item) => item.id === built.row.set_id);
  const set = current || {
    id: built.row.set_id,
    name: SET_PT[built.row.set_id] || built.row.set_id,
    code: built.row.set_id,
    sort: sets.length,
  };
  const error = await persistProduct(built.row, set);
  message = error || "Item salvo.";
}

async function changeQty(id, delta) {
  const product = products.find((item) => item.id === id);
  if (!product) return;
  const qty = stepQty(product.qty, delta);
  const { error } = await sb.from("products").update({ qty }).eq("id", id);
  if (error) { message = error.message; render(); return; }
  product.qty = qty;
  message = "Quantidade atualizada.";
  if (editor?.kind) {
    const list = document.getElementById("plist");
    if (list) list.innerHTML = productRows(view === "inventory" ? inventoryRows() : view === "home" ? products.filter((item) => Number(item.qty) <= 1) : catalogRows());
    const note = document.getElementById("desk-msg");
    if (note) note.textContent = message;
    bindCardImages();
    return;
  }
  await reload();
}

async function removeProduct(id) {
  const { data, error } = await sb.from("products").delete().eq("id", id).select("id");
  if (error) { message = error.message; render(); return; }
  const gone = removedError(data);
  message = gone || "Item apagado.";
  if (!gone) editor = null;
  await reload();
}

async function copyProduct() {
  if (!editor?.product) return;
  const copy = duplicateProduct(editor.product);
  const { error } = await sb.from("products").insert(copy);
  message = error ? error.message : "Item duplicado.";
  editor = null;
  await reload();
}

async function saveSet(event) {
  event.preventDefault();
  const form = new FormData(event.target);
  const existing = sets.find((set) => set.id === setEditing);
  const built = buildSet({
    id: form.get("id"),
    code: form.get("code"),
    name: form.get("name"),
    sort: existing ? existing.sort : sets.length,
  });
  if (!built.ok) { message = built.error; render(); return; }
  const { error } = await sb.from("sets").upsert(built.row);
  message = error ? error.message : "Coleção salva.";
  setEditing = null;
  await reload();
}

async function removeSet(id) {
  const blocked = setDeleteError(products, id);
  if (blocked) { message = blocked; render(); return; }
  const { error } = await sb.from("sets").delete().eq("id", id);
  message = error ? error.message : "Coleção apagada.";
  setEditing = null;
  await reload();
}

async function saveBanner(event) {
  event.preventDefault();
  const form = new FormData(event.target);
  const current = bannerEditing && bannerEditing !== "new" ? banners.find((item) => item.id === bannerEditing) : null;
  const built = buildBanner({
    id: current?.id,
    image: bannerImage || current?.image || "",
    label: form.get("label"),
    dest: form.get("dest"),
    url: form.get("url"),
    sort: current?.sort,
  }, publicBanners(banners));
  if (!built.ok) { message = built.error; render(); return; }
  const { error } = await sb.from("banners").upsert(built.row);
  message = error ? error.message : "Banner salvo.";
  if (!error) { bannerEditing = null; bannerImage = ""; editor = null; }
  await reload();
}

async function moveBanner(id, dir) {
  const next = reorderBanners(publicBanners(banners), id, dir);
  if (!next) return;
  const rows = next.map((item) => ({ id: item.id, image: item.image, href: item.href, label: item.label, scroll: item.scroll || "", sort: item.sort }));
  const { error } = await sb.from("banners").upsert(rows);
  message = error ? error.message : "";
  await reload();
}

async function saveTab(event) {
  event.preventDefault();
  const form = new FormData(event.target);
  const current = tabEditing && tabEditing !== "new" ? tabs.find((item) => item.id === tabEditing) : null;
  const built = buildTab({
    id: current?.id || form.get("id"),
    label: form.get("label"),
    href: form.get("href"),
    icon: form.get("icon"),
    sort: current?.sort,
  }, tabs);
  if (!built.ok) { message = built.error; render(); return; }
  const { error } = await sb.from("tabs").upsert(built.row);
  message = error ? error.message : "Aba salva.";
  if (!error) tabEditing = null;
  await reload();
}

async function moveTab(id, dir) {
  const next = reorderTabs(tabs, id, dir);
  if (!next) return;
  const { error } = await sb.from("tabs").upsert(next.map((item) => ({ id: item.id, label: item.label, href: item.href, icon: item.icon, sort: item.sort })));
  message = error ? error.message : "";
  await reload();
}

async function removeTab(id) {
  const { error } = await sb.from("tabs").delete().eq("id", id);
  message = error ? error.message : "Aba excluída.";
  tabEditing = null;
  await reload();
}

async function removeBanner(id) {
  const { error } = await sb.from("banners").delete().eq("id", id);
  message = error ? error.message : "Banner excluído.";
  bannerEditing = null;
  await reload();
}

app.addEventListener("click", async (event) => {
  const viewButton = event.target.closest("[data-view]");
  if (viewButton) {
    view = viewButton.dataset.view;
    editor = null;
    bannerEditing = null;
    tabEditing = null;
    message = "";
    if (view === "visits" || view === "banners" || view === "tabs") await reload();
    else render();
    return;
  }
  if (event.target.closest("[data-logout]")) {
    await sb.auth.signOut();
    session = null;
    editor = null;
    render();
    return;
  }
  if (event.target.id === "add-card") { openEditor(null, "single"); return; }
  if (event.target.id === "add-sealed") { openEditor(null, "sealed"); return; }
  if (event.target.id === "add-presale") { openEditor(null, "presale"); return; }
  if (event.target.id === "add-master") { openEditor(null, "master"); return; }
  if (event.target.id === "editor-cancel") { editor = null; render(); return; }
  if (event.target.id === "photo-clear") { editor.image = ""; showPreview(""); return; }
  if (event.target.id === "condition-add") {
    const input = document.getElementById("condition-new");
    const select = document.querySelector("#editor-form select[name=condition]");
    const value = String(input?.value || "").replace(/[\u0000-\u001F\u007F]/g, "").trim().slice(0, 24);
    if (!value || !select) return;
    const found = [...select.options].find((option) => option.value.toLowerCase() === value.toLowerCase());
    if (found) select.value = found.value;
    else select.add(new Option(value, value, true, true));
    input.value = "";
    return;
  }
  if (event.target.id === "copy") { await copyProduct(); return; }
  if (event.target.id === "remove-open" && editor?.product) { await removeProduct(editor.product.id); return; }
  const edit = event.target.closest("[data-edit]");
  if (edit) { openEditor(products.find((item) => item.id === edit.dataset.edit)); return; }
  const remove = event.target.closest("[data-remove]");
  if (remove) { await removeProduct(remove.dataset.remove); return; }
  const qty = event.target.closest("[data-qty]");
  if (qty) { await changeQty(qty.dataset.id, Number(qty.dataset.qty)); return; }
  const pickedName = event.target.closest("[data-name]");
  if (pickedName && editor) {
    editor.chosen = pickedName.dataset.name;
    paintPrintings(printingsOf(editor.cards, editor.chosen, document.getElementById("poke-number")?.value || "", knownSets()));
    return;
  }
  const printing = event.target.closest("[data-print]");
  if (printing) { applyCard(editor.printings[Number(printing.dataset.print)].card); return; }
  const setHit = event.target.closest("[data-set-id]");
  if (setHit) { chooseSet(knownSets().find((set) => set.id === setHit.dataset.setId)); return; }
  const sealType = event.target.closest("[data-seal-type]");
  if (sealType) { editor.sealedType = sealType.dataset.sealType; paintSealed(); return; }
  const sealItem = event.target.closest("[data-seal-item]");
  if (sealItem) { applySealed(editor.sealedView[Number(sealItem.dataset.sealItem)]); return; }
  const setButton = event.target.closest("[data-set]");
  if (setButton) { setEditing = setButton.dataset.set; render(); return; }
  const setRemove = event.target.closest("[data-set-remove]");
  if (setRemove) { await removeSet(setRemove.dataset.setRemove); return; }
  if (event.target.id === "add-banner") { editor = null; tabEditing = null; bannerEditing = "new"; bannerImage = ""; render(); return; }
  if (event.target.id === "banner-cancel") { bannerEditing = null; bannerImage = ""; render(); return; }
  const banner = event.target.closest("[data-banner]");
  if (banner && !event.target.closest("[data-banner-move]") && !event.target.closest("[data-banner-remove]")) {
    editor = null;
    bannerEditing = banner.dataset.banner;
    bannerImage = banners.find((item) => item.id === bannerEditing)?.image || "";
    render();
    return;
  }
  const bannerRemove = event.target.closest("[data-banner-remove]");
  if (bannerRemove) { await removeBanner(bannerRemove.dataset.bannerRemove); return; }
  const move = event.target.closest("[data-banner-move]");
  if (move) { await moveBanner(move.dataset.bannerMove, Number(move.dataset.dir)); return; }
  if (event.target.id === "add-tab") { editor = null; bannerEditing = null; tabEditing = "new"; render(); return; }
  if (event.target.id === "tab-cancel") { tabEditing = null; render(); return; }
  const tab = event.target.closest("[data-tab]");
  if (tab && !event.target.closest("[data-tab-move]") && !event.target.closest("[data-tab-remove]")) {
    editor = null;
    bannerEditing = null;
    tabEditing = tab.dataset.tab;
    render();
    return;
  }
  const tabRemove = event.target.closest("[data-tab-remove]");
  if (tabRemove) { await removeTab(tabRemove.dataset.tabRemove); return; }
  const tabMove = event.target.closest("[data-tab-move]");
  if (tabMove) { await moveTab(tabMove.dataset.tabMove, Number(tabMove.dataset.dir)); return; }
  const range = event.target.closest("[data-range]");
  if (range) { visitRange = range.dataset.range; render(); }
});

app.addEventListener("input", (event) => {
  if (event.target.id === "stock-q") {
    stockQuery = event.target.value;
    const list = document.getElementById("plist");
    if (list) list.innerHTML = productRows(view === "inventory" ? inventoryRows() : catalogRows());
    bindCardImages();
    return;
  }
  if (event.target.id === "poke-name") {
    clearTimeout(searchTimer);
    const value = event.target.value;
    searchTimer = setTimeout(() => runCardSearch(value), 300);
    return;
  }
  if (event.target.id === "poke-number" && editor?.chosen) {
    paintPrintings(printingsOf(editor.cards, editor.chosen, event.target.value, knownSets()));
    return;
  }
  if (event.target.id === "set-q") {
    const hits = searchSets(knownSets(), event.target.value).map((set) => `<button type="button" data-set-id="${esc(set.id)}"><img data-set-logo alt="" src="${esc(setLogoSrc(set.id))}" />${esc(set.name)} · ${esc(set.code)}</button>`).join("");
    const box = document.getElementById("set-hits");
    box.innerHTML = hits;
    bindSetLogos(box);
    return;
  }
  if (event.target.id === "sealed-q") {
    clearTimeout(searchTimer);
    const value = event.target.value;
    searchTimer = setTimeout(() => runSealedSearch(value), 300);
  }
});

app.addEventListener("change", async (event) => {
  if (event.target.id === "stock-kind") { stockKind = event.target.value; render(); return; }
  if (event.target.id === "stock-level") { stockLevel = event.target.value; render(); return; }
  if (event.target.id === "visit-from" || event.target.id === "visit-to") {
    visitFrom = document.getElementById("visit-from").value;
    visitTo = document.getElementById("visit-to").value;
    if (visitFrom && visitTo) visitRange = "custom";
    render();
    return;
  }
  if (event.target.id === "banner-dest") {
    document.getElementById("banner-url").hidden = event.target.value !== "external";
    return;
  }
  if (event.target.id === "photo-file" && event.target.files[0]) {
    try {
      editor.image = sanitizeImage(await readPhoto(event.target.files[0], { maxSide: PHOTO_MAX_SIDE, quality: PHOTO_QUALITY }));
      showPreview(editor.image);
    } catch (error) { message = error.message; document.getElementById("desk-msg").textContent = message; }
    return;
  }
  if (event.target.id === "banner-file" && event.target.files[0]) {
    try {
      bannerImage = sanitizeImage(await readPhoto(event.target.files[0], { maxWidth: BANNER_MAX_WIDTH, quality: BANNER_QUALITY }));
      const preview = document.getElementById("banner-preview");
      if (preview.tagName === "IMG") preview.src = bannerImage;
      else preview.outerHTML = `<img class="preview" id="banner-preview" alt="" src="${esc(bannerImage)}" />`;
    } catch (error) { message = error.message; document.getElementById("desk-msg").textContent = message; }
  }
});

app.addEventListener("submit", (event) => {
  const id = event.target?.getAttribute?.("id") || "";
  if (!["editor-form", "set-form", "banner-form", "tab-form"].includes(id)) return;
  event.preventDefault();
  if (id === "editor-form") saveProduct(event);
  else if (id === "set-form") saveSet(event);
  else if (id === "banner-form") saveBanner(event);
  else saveTab(event);
});

try {
  sb = await client();
  const { data } = await sb.auth.getSession();
  session = data.session;
  if (session) {
    await reload();
    const pending = location.search.includes("id=");
    await saveProductFromQuery();
    if (pending) await reload();
  } else render();
} catch (error) {
  app.innerHTML = `<p class="muted">Não foi possível abrir o painel.</p>`;
  console.error(error);
}
