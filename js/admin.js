import { client } from "/js/supabase.js";
import { BANNER_MAX_WIDTH, BANNER_QUALITY, PHOTO_MAX_SIDE, PHOTO_QUALITY, isCardBack, masterPhoto, productImage, sanitizeImage } from "/lib/image.mjs?v=4";
import { cardDraft, findDirectCards, parseCardSearch, printingsOf, searchCardNames } from "/lib/cards.mjs";
import { sealedDraft } from "/lib/sealed-draft.mjs?v=2";
import { LABEL_ORDER } from "/lib/sealed-match.mjs?v=4";
import { BANNER_DESTINATIONS, buildBanner, publicBanners, reorderBanners } from "/lib/banners.mjs";
import { catalogShelves, placeProduct, shelfKey, shelvesFromProducts, shelvesToBanners } from "/lib/shelves.mjs?v=2";
import { buildSet, searchSets, setDeleteError, sortSets } from "/lib/sets.mjs";
import { SET_PT } from "/lib/official-sets.mjs";
import { bindSetLogos, setLogoSrc } from "/js/set-logo.js";
import { buildProduct, displayKind, duplicateProduct, filterProducts, productFromQuery, removedError, stepQty, stockValue } from "/lib/products.mjs?v=3";
import { money } from "/lib/shop.mjs";
import { summarizeVisits } from "/lib/visits.mjs";
import { esc } from "/lib/text.mjs";

const app = document.getElementById("app");
let sb = null;
let session = null;
let sets = [];
let products = [];
let banners = [];
let visits = [];
let view = "home";
let message = "";
let messageTimer = 0;
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
let shelfDraft = null;
let searchToken = 0;
let searchTimer = 0;

const LANGS = [["PT", "Português", "🇧🇷"], ["EN", "Inglês", "🇺🇸"], ["JP", "Japonês", "🇯🇵"], ["KO", "Coreano", "🇰🇷"], ["ZH", "Chinês", "🇨🇳"], ["ES", "Espanhol", "🇪🇸"], ["FR", "Francês", "🇫🇷"], ["DE", "Alemão", "🇩🇪"], ["IT", "Italiano", "🇮🇹"]];
const CONDITIONS = ["NM", "LP", "MP", "HP", "DMG"];
const OK_MESSAGE = /salv|atualizad|apagad|excluíd|duplicad/i;

function paintMessage(note) {
  clearTimeout(messageTimer);
  note.textContent = message;
  note.className = `msg${message ? (OK_MESSAGE.test(message) ? " is-ok" : " is-warn") : ""}`;
  if (message) messageTimer = setTimeout(() => { message = ""; note.className = "msg"; }, 4500);
}

function notify(text) {
  message = text || "";
  const note = document.getElementById("desk-msg");
  if (note) paintMessage(note);
}

function confirmRemove(name) {
  return window.confirm(`Apagar ${name ? `"${name}"` : "este item"}? Isso não pode ser desfeito.`);
}

function scrollToEditor() {
  document.getElementById("editor")?.scrollIntoView({ block: "start", behavior: "smooth" });
}

function empty(text) {
  return `<p class="empty">${esc(text)}</p>`;
}

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
  if (!list.length) return empty("Nenhum item encontrado.");
  return list.map((product) => {
    const master = displayKind(product) === "master";
    const logo = master ? setLogoSrc(product.set_id) : "";
    const photo = master ? "" : productImage(product);
    const shown = masterPhoto(product);
    const own = master && shown && shown !== logo && !/\/logo\.png(?:$|\?)/.test(shown) && !shown.endsWith("me06-logo.png");
    const thumb = master
      ? (own ? `<img class="thumb" alt="" src="${esc(shown)}" data-card />` : (logo ? `<img class="thumb" alt="" src="${esc(logo)}" data-set-logo />` : `<span class="thumb"></span>`))
      : (photo ? `<img class="thumb" alt="" src="${esc(photo)}" data-card />` : `<span class="thumb"></span>`);
    return `
    <div class="row${master ? " master-row" : ""}">
      <span class="thumb-box">${thumb}</span>
      <div class="row-name"><strong>${esc(product.name)}</strong><p>${LANGS.find((item) => item[0] === product.lang)?.[2] || ""} ${esc(setName(product.set_id))} · ${esc(kindLabel(product))}${product.number ? ` · ${esc(product.number)}` : ""}</p></div>
      <div class="row-tools">
        <strong class="row-price">${esc(money(product.price))}</strong>
        <div class="qty-step${Number(product.qty) === 0 ? " is-out" : Number(product.qty) === 1 ? " is-low" : ""}">
          <button type="button" data-qty="-1" data-id="${esc(product.id)}" aria-label="Diminuir">−</button>
          <b>${esc(product.qty)}</b>
          <button type="button" data-qty="1" data-id="${esc(product.id)}" aria-label="Aumentar">+</button>
        </div>
        <div class="actions">
          <button class="ghost" type="button" data-edit="${esc(product.id)}">Editar</button>
          <button class="ghost danger" type="button" data-remove="${esc(product.id)}">Apagar</button>
        </div>
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

function shell(title, body, actions = "", lede = "") {
  const item = (id, label) => `<button type="button" data-view="${id}" class="${view === id ? "is-on" : ""}">${icon(id)}<span>${label}</span></button>`;
  return `
    <div class="desk">
      <aside class="side">
        <a class="brand" href="/admin"><img src="/assets/logo.png" alt="" width="56" height="48" /><span><strong>Master Bu</strong><small>Painel da loja</small></span></a>
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
          <a class="ghost" href="/" target="_blank" rel="noopener">Ver a loja</a>
          <span class="muted">${esc(session.user.email)}</span>
          <button class="ghost" type="button" data-logout>Sair</button>
        </div>
      </aside>
      <div class="work">
        <div class="mobile-bar">
          <span class="muted">${esc(session.user.email)}</span>
          <button class="ghost" type="button" data-logout>Sair</button>
        </div>
        <header class="page-head">
          <div>
            <h1>${esc(title)}</h1>
            ${lede ? `<p class="page-lede">${esc(lede)}</p>` : ""}
          </div>
          ${actions ? `<div class="page-actions">${actions}</div>` : ""}
        </header>
        <div id="editor"></div>
        <p class="msg" id="desk-msg" role="status" aria-live="polite"></p>
        ${body}
        <p class="credit">Site desenvolvido por <a href="https://felipeseussites.vercel.app" target="_blank" rel="noopener noreferrer">Felipe</a></p>
      </div>
    </div>`;
}

const ADD_BUTTONS = `
  <button class="solid" type="button" id="add-card">+ Carta</button>
  <button class="solid" type="button" id="add-sealed">+ Lacrado</button>
  <button class="ghost" type="button" id="add-presale">+ Pré-venda</button>`;

function count(list, one, many) {
  return `${list.length} ${list.length === 1 ? one : many}`;
}

function homeView() {
  const byKind = (kind) => products.filter((product) => displayKind(product) === kind);
  const low = products.filter((product) => Number(product.qty) <= 1);
  const stat = (kind, label, value) => `<button type="button" class="stat" data-go-kind="${kind}"><span>${label}</span><b>${value}</b></button>`;
  return shell("Visão geral", `
    <div class="stats">
      ${stat("all", "Itens", products.length)}
      ${stat("single", "Avulsos", byKind("single").length)}
      ${stat("presale", "Pré-venda", byKind("presale").length)}
      ${stat("sealed", "Lacrados", byKind("sealed").length)}
      ${stat("master", "Master sets", byKind("master").length)}
      <div class="stat is-money"><span>Valor em estoque</span><b>${esc(money(stockValue(products)))}</b></div>
    </div>
    <section class="block">
      <div class="block-head">
        <h2>Estoque baixo</h2>
        <p class="muted">Itens com 1 ou 0 unidades. Use + e − para ajustar.</p>
      </div>
      <div id="plist">${low.length ? productRows(low) : empty("Nenhum item acabando.")}</div>
    </section>`, ADD_BUTTONS, "Resumo da loja e o que precisa de atenção.");
}

function stockView() {
  const list = catalogRows();
  return shell("Vitrine", `
    <div class="toolbar">
      <input id="stock-q" type="search" placeholder="Buscar por nome, número ou coleção" value="${esc(stockQuery)}" />
      <select id="stock-kind" aria-label="Tipo">
        ${[["all", "Tudo"], ["single", "Avulsos"], ["presale", "Pré-venda"], ["sealed", "Lacrados"], ["master", "Master sets"]].map(([value, label]) => `<option value="${value}"${stockKind === value ? " selected" : ""}>${label}</option>`).join("")}
      </select>
    </div>
    <p class="count" id="plist-count">${count(list, "item", "itens")}</p>
    <div id="plist">${productRows(list)}</div>`, ADD_BUTTONS, "Tudo o que aparece na loja.");
}

function inventoryView() {
  const list = inventoryRows();
  return shell("Estoque", `
    <div class="toolbar">
      <input id="stock-q" type="search" placeholder="Buscar no estoque" value="${esc(stockQuery)}" />
      <select id="stock-level" aria-label="Nível do estoque">
        ${[["all", "Tudo"], ["low", "Só 1 unidade"], ["out", "Zerados"]].map(([value, label]) => `<option value="${value}"${stockLevel === value ? " selected" : ""}>${label}</option>`).join("")}
      </select>
    </div>
    <p class="count" id="plist-count">${count(list, "item", "itens")}</p>
    <div id="plist">${productRows(list)}</div>`, "", "Ajuste as quantidades com + e −.");
}

function setsView() {
  const used = (id) => products.filter((product) => product.set_id === id).length;
  const rows = sortSets(sets).map((set) => `
    <div class="row set-row">
      <span class="thumb-box">${setLogoSrc(set.id) ? `<img alt="" src="${esc(setLogoSrc(set.id))}" data-set-logo />` : ""}</span>
      <div class="row-name"><strong>${esc(set.name)}</strong><p>${esc(set.code)} · ${used(set.id)} ${used(set.id) === 1 ? "item" : "itens"}</p></div>
      <div class="row-tools">
        <div class="actions">
          <button class="ghost" type="button" data-set="${esc(set.id)}">Editar</button>
          <button class="ghost danger" type="button" data-set-remove="${esc(set.id)}">Apagar</button>
        </div>
      </div>
    </div>`).join("");
  return shell("Coleções", `<div class="list">${rows || empty("Nenhuma coleção.")}</div>`,
    `<button class="solid" type="button" id="add-set">+ Coleção</button>`,
    "Coleções usadas para organizar os produtos.");
}

function setFormHtml() {
  if (!setEditing) return "";
  const current = setEditing === "new" ? null : sets.find((set) => set.id === setEditing);
  return `
    <form id="set-form" class="editor" method="post" action="/admin">
      <h2>${current ? "Editar coleção" : "Nova coleção"}</h2>
      ${current ? `<input type="hidden" name="id" value="${esc(current.id)}" />` : ""}
      <div class="two">
        ${current ? `<label>Código<input type="text" value="${esc(current.id)}" readonly /></label>` : field("id", "Código", "")}
        ${field("code", "Sigla", current?.code || "")}
      </div>
      ${field("name", "Nome", current?.name || "")}
      <div class="actions form-actions">
        <button class="solid" type="submit">${current ? "Salvar coleção" : "Criar coleção"}</button>
        <button class="ghost" type="button" id="set-cancel">Cancelar</button>
      </div>
    </form>`;
}

function masterView() {
  const list = products.filter((product) => displayKind(product) === "master");
  return shell("Master Set", `<div id="plist">${list.length ? productRows(list) : empty("Nenhum master set à venda.")}</div>`,
    `<button class="solid" type="button" id="add-master">+ Master set</button>`,
    "Coleções completas à venda.");
}

function bannersView() {
  const list = publicBanners(banners);
  const destination = (href) => BANNER_DESTINATIONS.find((item) => item.href === href)?.label || href;
  const rows = list.map((banner, index) => `
    <div class="row banner-row">
      <span class="thumb-box"><img src="${esc(banner.image)}" alt="" /></span>
      <div class="row-name"><strong>${esc(banner.label)}</strong><p>${index + 1}º · leva para ${esc(destination(banner.href))}</p></div>
      <div class="row-tools">
        <div class="actions">
          <button class="ghost icon-btn" type="button" data-banner-move="${esc(banner.id)}" data-dir="-1" aria-label="Subir"${index === 0 ? " disabled" : ""}>↑</button>
          <button class="ghost icon-btn" type="button" data-banner-move="${esc(banner.id)}" data-dir="1" aria-label="Descer"${index === list.length - 1 ? " disabled" : ""}>↓</button>
          <button class="ghost" type="button" data-banner="${esc(banner.id)}">Editar</button>
          <button class="ghost danger" type="button" data-banner-remove="${esc(banner.id)}">Apagar</button>
        </div>
      </div>
    </div>`).join("");
  return shell("Banners", `<div class="list">${rows || empty("Nenhum banner ainda.")}</div>`,
    `<button class="solid" type="button" id="add-banner">+ Banner</button>`,
    "Imagens que giram no topo da loja, na ordem abaixo.");
}

function catalogShelfList() {
  if (shelfDraft) return shelfDraft;
  const saved = catalogShelves(banners);
  return saved.length ? saved : shelvesFromProducts(products);
}

function shelfOf(productId) {
  if (!productId) return "";
  const found = catalogShelfList().find((shelf) => shelf.productIds.includes(productId));
  return found?.id || "";
}

function tabsView() {
  const list = catalogShelfList();
  const catalog = products.slice().sort((a, b) => String(a.name).localeCompare(String(b.name), "pt"));
  const rows = list.map((shelf, index) => `
    <section class="shelf-block" data-shelf="${esc(shelf.id)}">
      <div class="shelf-head">
        <input data-shelf-name value="${esc(shelf.label)}" maxlength="40" aria-label="Nome da aba" />
        <span class="pill" data-shelf-count>${shelf.productIds.length} ${shelf.productIds.length === 1 ? "produto" : "produtos"}</span>
        <div class="actions">
          <button class="ghost icon-btn" type="button" data-shelf-move="${esc(shelf.id)}" data-dir="-1" aria-label="Subir"${index === 0 ? " disabled" : ""}>↑</button>
          <button class="ghost icon-btn" type="button" data-shelf-move="${esc(shelf.id)}" data-dir="1" aria-label="Descer"${index === list.length - 1 ? " disabled" : ""}>↓</button>
          <button class="ghost danger" type="button" data-shelf-remove="${esc(shelf.id)}">Apagar</button>
        </div>
      </div>
      <div class="shelf-products">
        ${catalog.slice().sort((a, b) => Number(shelf.productIds.includes(b.id)) - Number(shelf.productIds.includes(a.id))).map((product) => `
          <label class="check">
            <input type="checkbox" data-shelf-product="${esc(product.id)}"${shelf.productIds.includes(product.id) ? " checked" : ""} />
            <span>${esc(product.name)}</span>
          </label>`).join("") || `<p class="muted">Nenhum produto cadastrado.</p>`}
      </div>
    </section>`).join("");
  return shell("Abas", `
    <div class="toolbar">
      <input id="shelf-q" type="search" placeholder="Filtrar produtos dentro das abas" autocomplete="off" aria-label="Buscar produto" />
    </div>
    ${shelfDraft ? `<p class="notice">Você tem mudanças não salvas. Clique em <b>Salvar abas</b> para publicar.</p>` : ""}
    <div id="shelf-editor">${rows || empty("Nenhuma aba ainda.")}</div>`,
    `<button class="ghost" type="button" id="add-shelf">+ Aba</button><button class="solid" type="button" id="save-shelves">Salvar abas</button>`,
    "Prateleiras da página inicial. Cada produto fica em uma aba só.");
}

function visitsView() {
  const summary = summarizeVisits(visits, visitRange, { from: visitFrom, to: visitTo });
  const max = Math.max(1, ...summary.perDay.map((day) => day.people));
  return shell("Visitas", `
    <div class="toolbar">
      <div class="segmented">
        ${[["month", "Este mês"], ["prev", "Mês anterior"], ["all", "Tudo"]].map(([value, label]) => `<button type="button" class="${visitRange === value ? "is-on" : ""}" data-range="${value}">${label}</button>`).join("")}
      </div>
      <label class="date">De<input id="visit-from" type="date" value="${esc(visitFrom)}" /></label>
      <label class="date">Até<input id="visit-to" type="date" value="${esc(visitTo)}" /></label>
    </div>
    <div class="stats">
      <div class="stat"><span>Pessoas</span><b>${summary.people}</b></div>
      <div class="stat"><span>Visitas</span><b>${summary.rows.length}</b></div>
      <div class="stat"><span>Hoje</span><b>${summary.today}</b></div>
    </div>
    <section class="block">
      <h2>Pessoas por dia</h2>
      <div class="bars">${summary.perDay.map((day) => `<div class="bar-col"><b>${day.people}</b><i style="height:${Math.max(6, Math.round(day.people / max * 100))}px"></i><small>${esc(day.label)}</small></div>`).join("") || `<p class="muted">Nenhuma visita neste período.</p>`}</div>
    </section>
    <div class="two">
      <section class="block">
        <h2>Páginas</h2>
        ${summary.pages.map((page) => `<div class="rank"><span>${esc(page.label)}</span><strong>${page.count}</strong></div>`).join("") || `<p class="muted">Sem páginas.</p>`}
      </section>
      <section class="block">
        <h2>Cidades</h2>
        ${summary.cities.map((city) => `<div class="rank"><span>${esc(city.city)}</span><strong>${city.count}</strong></div>`).join("") || `<p class="muted">Sem cidades.</p>`}
      </section>
    </div>
    <section class="block">
      <h2>Últimas visitas</h2>
      ${summary.rows.slice(0, 20).map((visit) => `<div class="rank rank-3"><span>${esc(visit.visitor || "—")}</span><span>${esc(visit.city || "—")}</span><span>${esc(visit.path || "/")}</span></div>`).join("") || `<p class="muted">Nenhuma visita.</p>`}
    </section>`, "", "Quem visitou a loja e quais páginas.");
}

function editorHtml() {
  if (!editor) return "";
  const product = editor.product;
  const kind = editor.kind;
  const master = kind === "master";
  const sealed = kind !== "single";
  const p = product || { id: "", name: "", set_id: "", number: "", rarity: "", condition: master ? "Completo" : sealed ? "Lacrado" : "NM", lang: "PT", finish: master ? "Master Set" : sealed ? "Lacrado" : "Normal", qty: 1, price: "" };
  const preview = editor.image || "";
  const ownPhoto = Boolean(editor.ownPhoto);
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
      ${preview
        ? `<img class="preview${master && !ownPhoto ? " logo-preview" : ""}" id="photo-preview" alt="" src="${esc(preview)}" ${master && !ownPhoto ? "data-set-logo" : "data-card"} />`
        : `<p class="muted" id="photo-preview">${master ? "Escolha a coleção para usar a logo." : "Sem foto"}</p>`}
      <div class="actions">
        <label class="ghost file-btn">${master ? "Adicionar foto" : "Trocar a foto"}<input id="photo-file" type="file" accept="image/*" hidden /></label>
        <button class="ghost" type="button" id="photo-clear">Tirar foto</button>
      </div>
      <div class="two">${product ? `<label>Código<input name="id" type="text" value="${esc(p.id)}" readonly /></label>` : field("id", "Código", p.id)}${field("name", "Nome", p.name)}</div>
      <input type="hidden" name="set_id" value="${esc(p.set_id || "")}" />
      <label>Coleção da loja<input id="set-q" type="search" placeholder="Buscar coleção" autocomplete="off" value="${esc(p.set_id ? setName(p.set_id) : "")}" /></label>
      <div id="set-hits" class="names"></div>
      <p class="muted" id="set-chosen">${p.set_id ? esc(setName(p.set_id)) : "Nenhuma coleção escolhida."}</p>
      ${sealed ? `<input type="hidden" name="number" value="" /><input type="hidden" name="rarity" value="${esc(p.rarity || "")}" />` : `<div class="two">${field("number", "Número", p.number)}${field("rarity", "Raridade", p.rarity)}</div>`}
      <div class="two">
        ${sealed ? "" : conditionField(p.condition || "NM")}
        <label>Idioma<select name="lang">${LANGS.map(([code, label, flag]) => `<option value="${code}"${(p.lang || "PT") === code ? " selected" : ""}>${flag} ${label}</option>`).join("")}</select></label>
      </div>
      ${sealed ? `<input type="hidden" name="condition" value="${esc(!p.condition || p.condition === "NM" ? "Lacrado" : p.condition)}" /><input type="hidden" name="finish" value="${esc(p.finish || "Lacrado")}" />` : field("finish", "Acabamento", p.finish || "Normal")}
      <div class="two">${field("qty", "Quantidade", p.qty, "number")}${field("price", "Preço", p.price === 0 || p.price ? p.price : "", "text")}</div>
      ${kind === "single" || kind === "sealed" ? `<label>Aba<select name="shelf"><option value="">Sem aba</option>${catalogShelfList().map((shelf) => `<option value="${esc(shelf.id)}"${shelfOf(product?.id) === shelf.id ? " selected" : ""}>${esc(shelf.label)}</option>`).join("")}</select></label>` : ""}
      <div class="actions form-actions">
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
    <form id="banner-form" class="editor" method="post" action="/admin">
      <h2>${row ? "Editar banner" : "Novo banner"}</h2>
      ${bannerImage ? `<img class="banner-preview" id="banner-preview" alt="" src="${esc(bannerImage)}" />` : `<p class="banner-preview is-empty" id="banner-preview">Nenhuma imagem escolhida</p>`}
      <div class="actions">
        <label class="ghost file-btn">${bannerImage ? "Trocar imagem" : "Escolher imagem"}<input id="banner-file" type="file" accept="image/*" hidden /></label>
        <span class="muted hint">Formato largo, 3 por 1 (ex.: 2048 × 682).</span>
      </div>
      ${field("label", "Nome", row?.label || "")}
      <label>Destino ao clicar<select name="dest" id="banner-dest">${options.map(([value, label]) => `<option value="${value}"${dest === value ? " selected" : ""}>${label}</option>`).join("")}</select></label>
      <label id="banner-url"${dest === "external" ? "" : " hidden"}>Endereço https<input name="url" type="url" placeholder="https://" value="${esc(dest === "external" ? row?.href || "" : "")}" /></label>
      <div class="actions form-actions">
        <button class="solid" type="submit">Salvar banner</button>
        <button class="ghost" type="button" id="banner-cancel">Cancelar</button>
      </div>
    </form>`;
}

function render() {
  if (!session) {
    app.innerHTML = `
      <div class="login">
        <form id="login" class="login-card" method="post" action="/admin">
          <img src="/assets/logo.png" alt="Master Bu" width="102" height="88" />
          <h1>Painel da loja</h1>
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
  else if (view === "sets" && setEditing) slot.innerHTML = setFormHtml();
  paintMessage(document.getElementById("desk-msg"));
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
  const [setRes, productRes, bannerRes] = await Promise.all([
    sb.from("sets").select("id,name,code,sort").order("sort"),
    sb.from("products").select("*").order("name"),
    sb.from("banners").select("id,image,href,label,scroll,sort").order("sort"),
  ]);
  if (setRes.error || productRes.error || bannerRes.error) {
    message = (setRes.error || productRes.error || bannerRes.error).message;
  }
  sets = setRes.data || [];
  products = productRes.data || [];
  banners = bannerRes.data || [];
  if (view === "visits") {
    const result = await sb.from("visits").select("created_at,path,visitor,city").order("created_at", { ascending: false }).limit(4000);
    visits = result.data || [];
    if (result.error) message = result.error.message;
  }
  render();
}

function ownMasterPhoto(product) {
  const saved = masterPhoto(product);
  const logo = setLogoSrc(product?.set_id);
  return Boolean(saved) && saved !== logo && !/\/logo\.png(?:$|\?)/.test(saved) && !saved.endsWith("me06-logo.png");
}

function editorPhoto(product) {
  const saved = String(product?.image || "");
  const shown = product ? productImage(product) : "";
  if (saved.startsWith("data:image/jpeg") && shown.startsWith("/assets/")) return shown;
  return saved;
}

function openEditor(product, kind) {
  bannerEditing = null;
  bannerImage = "";
  setEditing = null;
  const nextKind = product ? displayKind(product) : kind;
  const ownPhoto = nextKind === "master" && ownMasterPhoto(product);
  editor = {
    product: product || null,
    kind: nextKind,
    ownPhoto,
    image: ownPhoto ? masterPhoto(product) : (nextKind === "master" ? setLogoSrc(product?.set_id) : editorPhoto(product)),
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
  if (editor?.kind === "master" && !editor.ownPhoto) {
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
  if (current.tagName === "IMG") {
    current.src = src;
    current.classList.remove("logo-preview");
    current.removeAttribute("data-set-logo");
    current.setAttribute("data-card", "");
  } else current.outerHTML = `<img class="preview" id="photo-preview" alt="" src="${esc(src)}" data-card />`;
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
    if (result.error) { notify(result.error); paintPrintings([]); return; }
    paintPrintings(result.printings);
    return;
  }
  const result = await searchCardNames(text, fetchPage, knownSets());
  if (token !== searchToken) return;
  if (result.error) { notify(result.error); return; }
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
    editor.sealedType = "Todos";
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
    form.elements.condition.value = draft.condition;
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
    image: editor?.ownPhoto ? (editor.image || "") : (kind === "master" ? setLogoSrc(form.get("set_id")) : (editor?.image || "")),
  });
  const fail = notify;
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
  if (kind === "single" || kind === "sealed") {
    const shelfError = await assignShelf(built.row.id, String(form.get("shelf") || ""));
    if (shelfError) { fail(shelfError); return; }
  }
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
  if (error) { notify(error.message); return; }
  product.qty = qty;
  refreshList();
  notify("Quantidade atualizada.");
}

function currentRows() {
  if (view === "inventory") return inventoryRows();
  if (view === "home") return products.filter((item) => Number(item.qty) <= 1);
  if (view === "master") return products.filter((item) => displayKind(item) === "master");
  return catalogRows();
}

function refreshList() {
  const list = document.getElementById("plist");
  if (!list) return;
  const rows = currentRows();
  list.innerHTML = rows.length || view !== "home" ? productRows(rows) : empty("Nenhum item acabando.");
  const total = document.getElementById("plist-count");
  if (total) total.textContent = count(rows, "item", "itens");
  bindCardImages();
  bindSetLogos(list);
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
  if (!built.ok) { notify(built.error); return; }
  const { error } = await sb.from("sets").upsert(built.row);
  message = error ? error.message : "Coleção salva.";
  setEditing = null;
  await reload();
}

async function removeSet(id) {
  const blocked = setDeleteError(products, id);
  if (blocked) { notify(blocked); return; }
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
  if (!built.ok) { notify(built.error); return; }
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

function takeShelves() {
  const live = [...document.querySelectorAll("[data-shelf]")];
  if (!live.length) return catalogShelfList().map((shelf) => ({ ...shelf, productIds: [...shelf.productIds] }));
  return live.map((block) => ({
    id: block.dataset.shelf,
    label: block.querySelector("[data-shelf-name]")?.value || "",
    productIds: [...block.querySelectorAll("[data-shelf-product]:checked")].map((box) => box.dataset.shelfProduct),
  }));
}

async function writeShelves(list) {
  const next = shelvesToBanners(list);
  const old = banners.filter((row) => row.scroll === "aba" || row.scroll === "abi");
  const keep = new Set(next.map((row) => row.id));
  const remove = old.map((row) => row.id).filter((id) => !keep.has(id));
  if (next.length) {
    const { error } = await sb.from("banners").upsert(next);
    if (error) return error.message;
  }
  if (remove.length) {
    const { error } = await sb.from("banners").delete().in("id", remove);
    if (error) return error.message;
  }
  return "";
}

async function assignShelf(productId, shelfId) {
  const base = catalogShelves(banners);
  const list = placeProduct(base.length ? base : shelvesFromProducts(products), productId, shelfId);
  return writeShelves(list);
}

async function saveShelves() {
  const list = takeShelves();
  shelfDraft = list;
  if (list.some((shelf) => !String(shelf.label || "").trim())) {
    notify("Dê um nome a cada aba.");
    return;
  }
  const error = await writeShelves(list);
  if (error) { notify(error); return; }
  message = "Abas salvas.";
  shelfDraft = null;
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
    setEditing = null;
    shelfDraft = null;
    message = "";
    window.scrollTo(0, 0);
    if (view === "visits" || view === "banners" || view === "tabs") await reload();
    else render();
    return;
  }
  const goKind = event.target.closest("[data-go-kind]");
  if (goKind) {
    stockKind = goKind.dataset.goKind;
    stockQuery = "";
    view = goKind.dataset.goKind === "master" ? "master" : "stock";
    window.scrollTo(0, 0);
    render();
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
  if (event.target.id === "photo-clear") {
    if (editor?.kind === "master") {
      editor.ownPhoto = false;
      editor.image = setLogoSrc(document.querySelector("#editor-form [name=set_id]")?.value || "");
      showLogoPreview(editor.image);
    } else {
      editor.image = "";
      showPreview("");
    }
    return;
  }
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
  if (event.target.id === "remove-open" && editor?.product) {
    if (confirmRemove(editor.product.name)) await removeProduct(editor.product.id);
    return;
  }
  const edit = event.target.closest("[data-edit]");
  if (edit) { openEditor(products.find((item) => item.id === edit.dataset.edit)); return; }
  const remove = event.target.closest("[data-remove]");
  if (remove) {
    if (confirmRemove(products.find((item) => item.id === remove.dataset.remove)?.name)) await removeProduct(remove.dataset.remove);
    return;
  }
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
  if (event.target.id === "add-set") { setEditing = "new"; render(); scrollToEditor(); return; }
  if (event.target.id === "set-cancel") { setEditing = null; render(); return; }
  const setButton = event.target.closest("[data-set]");
  if (setButton) { setEditing = setButton.dataset.set; render(); scrollToEditor(); return; }
  const setRemove = event.target.closest("[data-set-remove]");
  if (setRemove) {
    if (confirmRemove(sets.find((set) => set.id === setRemove.dataset.setRemove)?.name)) await removeSet(setRemove.dataset.setRemove);
    return;
  }
  if (event.target.id === "add-banner") { editor = null; bannerEditing = "new"; bannerImage = ""; render(); scrollToEditor(); return; }
  if (event.target.id === "banner-cancel") { bannerEditing = null; bannerImage = ""; render(); return; }
  const banner = event.target.closest("[data-banner]");
  if (banner) {
    editor = null;
    bannerEditing = banner.dataset.banner;
    bannerImage = banners.find((item) => item.id === bannerEditing)?.image || "";
    render();
    scrollToEditor();
    return;
  }
  const bannerRemove = event.target.closest("[data-banner-remove]");
  if (bannerRemove) {
    if (confirmRemove(banners.find((item) => item.id === bannerRemove.dataset.bannerRemove)?.label)) await removeBanner(bannerRemove.dataset.bannerRemove);
    return;
  }
  const move = event.target.closest("[data-banner-move]");
  if (move) { await moveBanner(move.dataset.bannerMove, Number(move.dataset.dir)); return; }
  if (event.target.id === "add-shelf") {
    const list = takeShelves();
    list.push({ id: shelfKey(`aba${Date.now().toString(36)}`), label: "Nova aba", productIds: [] });
    shelfDraft = list;
    render();
    return;
  }
  if (event.target.id === "save-shelves") { await saveShelves(); return; }
  const shelfRemove = event.target.closest("[data-shelf-remove]");
  if (shelfRemove) {
    const label = shelfRemove.closest("[data-shelf]")?.querySelector("[data-shelf-name]")?.value;
    if (!confirmRemove(label)) return;
    shelfDraft = takeShelves().filter((shelf) => shelf.id !== shelfRemove.dataset.shelfRemove);
    render();
    return;
  }
  const shelfMove = event.target.closest("[data-shelf-move]");
  if (shelfMove) {
    const list = takeShelves();
    const index = list.findIndex((shelf) => shelf.id === shelfMove.dataset.shelfMove);
    const next = index + Number(shelfMove.dataset.dir);
    if (index < 0 || next < 0 || next >= list.length) return;
    const [row] = list.splice(index, 1);
    list.splice(next, 0, row);
    shelfDraft = list;
    render();
    return;
  }
  const range = event.target.closest("[data-range]");
  if (range) { visitRange = range.dataset.range; render(); }
});

app.addEventListener("input", (event) => {
  if (event.target.id === "stock-q") {
    stockQuery = event.target.value;
    refreshList();
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
  if (event.target.id === "shelf-q") {
    const query = event.target.value.trim().toLocaleLowerCase("pt");
    document.querySelectorAll(".shelf-products .check").forEach((row) => {
      row.hidden = Boolean(query) && !row.textContent.toLocaleLowerCase("pt").includes(query);
    });
  }
});

app.addEventListener("change", async (event) => {
  if (event.target.matches("[data-shelf-product]")) {
    if (event.target.checked) {
      const id = event.target.dataset.shelfProduct;
      document.querySelectorAll(`[data-shelf-product="${CSS.escape(id)}"]`).forEach((box) => {
        if (box !== event.target) box.checked = false;
      });
    }
    document.querySelectorAll("[data-shelf]").forEach((block) => {
      const total = block.querySelectorAll("[data-shelf-product]:checked").length;
      block.querySelector("[data-shelf-count]").textContent = `${total} ${total === 1 ? "produto" : "produtos"}`;
    });
    return;
  }
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
      editor.ownPhoto = true;
      showPreview(editor.image);
    } catch (error) { notify(error.message); }
    return;
  }
  if (event.target.id === "banner-file" && event.target.files[0]) {
    try {
      bannerImage = sanitizeImage(await readPhoto(event.target.files[0], { maxWidth: BANNER_MAX_WIDTH, quality: BANNER_QUALITY }));
      const preview = document.getElementById("banner-preview");
      if (preview.tagName === "IMG") preview.src = bannerImage;
      else preview.outerHTML = `<img class="banner-preview" id="banner-preview" alt="" src="${esc(bannerImage)}" />`;
      event.target.parentElement.firstChild.textContent = "Trocar imagem";
    } catch (error) { notify(error.message); }
  }
});

app.addEventListener("submit", (event) => {
  const id = event.target?.getAttribute?.("id") || "";
  if (!["editor-form", "set-form", "banner-form"].includes(id)) return;
  event.preventDefault();
  if (id === "editor-form") saveProduct(event);
  else if (id === "set-form") saveSet(event);
  else saveBanner(event);
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
