import { STORE, WHATSAPP_PHONE } from "/js/config.js";
import { legal } from "/js/legal.js";
import { client } from "/js/supabase.js";
import { isCardBack, productImage } from "/lib/image.mjs";
import { bindSetLogos, setLogoSrc, showSetLogo } from "/js/set-logo.js";
import { displayKind, filterProducts } from "/lib/products.mjs";
import { publicBanners } from "/lib/banners.mjs";
import { DEFAULT_TABS, publicTabs } from "/lib/tabs.mjs";
import { buyLabel, forSale, money, onOrder, priceLabel, whatsappUrl } from "/lib/shop.mjs";
import { buildVisit, saoPauloDay } from "/lib/visits.mjs";
import { SET_PT, fetchOfficialSets, officialLabel } from "/lib/official-sets.mjs";
import { sealedKind } from "/lib/sealed-match.mjs";
import { esc, safeSearch, slugId } from "/lib/text.mjs";

const main = document.getElementById("conteudo");
const qInput = document.getElementById("q");
const setSelect = document.getElementById("colecao");
const nav = document.getElementById("nav");
const cookieBox = document.getElementById("cookies");

let sets = [];
let catalog = [];
let pickerSets = [];
let products = [];
let banners = [];
let siteTabs = DEFAULT_TABS;
let failed = false;
const tracked = new Set();

const LANG = {
  PT: "Português", EN: "Inglês", JP: "Japonês", KO: "Coreano", ZH: "Chinês",
  ES: "Espanhol", FR: "Francês", DE: "Alemão", IT: "Italiano",
};
const FLAGS = { PT: "🇧🇷", EN: "🇺🇸", JP: "🇯🇵", KO: "🇰🇷", ZH: "🇨🇳", ES: "🇪🇸", FR: "🇫🇷", DE: "🇩🇪", IT: "🇮🇹" };

function langMark(code) {
  const name = LANG[code] || code || "";
  const flag = FLAGS[code] || "";
  if (!name && !flag) return "—";
  return `${flag ? `<span class="flag" aria-hidden="true">${flag}</span> ` : ""}${esc(name)}`;
}

function setOf(id) {
  return sets.find((set) => set.id === id) || { id, name: id || "Sem coleção", code: "" };
}

function kindName(product) {
  const kind = displayKind(product);
  if (kind === "presale") return "Pré-venda";
  if (kind === "master") return "Master set";
  if (kind === "sealed") return "Lacrado";
  return "Carta avulsa";
}

function route() {
  const parts = (location.hash || "#/").replace(/^#\/?/, "").split("/").filter(Boolean);
  let id = parts[1] || "";
  try { id = decodeURIComponent(id); } catch { /* mantém */ }
  return { name: parts[0] || "home", id };
}

function sectionCount(href) {
  const setId = chosenSetId();
  const list = products.filter((product) => !setId || product.set_id === setId);
  if (href === "#/avulsos") return list.filter((product) => displayKind(product) === "single").length;
  if (href === "#/prevenda") return null;
  if (href === "#/lacrados") return null;
  if (href === "#/alta") return list.filter((product) => displayKind(product) === "single" && Number(product.price) >= 200).length;
  if (href === "#/colecoes") return sets.filter((set) => products.some((product) => product.set_id === set.id)).length;
  if (href === "#/masterset") return list.filter((product) => displayKind(product) === "master").length;
  return null;
}

function paintNav() {
  nav.innerHTML = publicTabs(siteTabs)
    .filter((tab) => { const count = sectionCount(tab.href); return count === null || count > 0; })
    .map((tab) => `<a href="${esc(tab.href)}"><img src="${esc(tab.icon)}" alt="" width="22" height="22" />${esc(tab.label)}</a>`).join("");
  markNav(route().name);
}

function markNav(name) {
  const key = ["home", "set", "item"].includes(name) ? "#/" : `#/${name}`;
  nav.querySelectorAll("a").forEach((link) => {
    if (link.getAttribute("href") === key) link.setAttribute("aria-current", "page");
    else link.removeAttribute("aria-current");
  });
}

function buyButton(product, setName) {
  const href = whatsappUrl(WHATSAPP_PHONE, product, setName);
  const label = buyLabel(product);
  if (!href) return `<button class="buy" type="button" disabled title="O número do WhatsApp ainda não foi colocado no site.">${label}</button>`;
  return `<a class="buy" href="${esc(href)}" target="_blank" rel="noopener noreferrer">${label}</a>`;
}

function shot(product) {
  const src = productImage(product);
  const logo = product.set_id ? setLogoSrc(product.set_id) : "";
  if (!src) {
    if (!logo) return `<div class="shot"></div>`;
    return `<div class="shot"><img data-set-logo alt="${esc(product.name)}" src="${esc(logo)}" /></div>`;
  }
  const fallback = logo ? ` data-fallback="${esc(logo)}"` : "";
  return `<div class="shot"><img data-card src="${esc(src)}" alt="${esc(product.name)}" loading="lazy"${fallback} /></div>`;
}

function cardHtml(product) {
  const set = setOf(product.set_id);
  const number = product.number ? ` · ${esc(product.number)}` : "";
  const qty = onOrder(product) ? "Sob encomenda" : Number(product.qty) > 0 ? `${product.qty} un.` : "Esgotado";
  return `
    <article class="card">
      <a href="#/item/${esc(encodeURIComponent(product.id))}">
        ${shot(product)}
        <h3>${esc(product.name)}</h3>
        <p class="marks">${FLAGS[product.lang] ? `<span class="flag" title="${esc(LANG[product.lang] || product.lang)}">${FLAGS[product.lang]}</span>` : ""}<span class="grade">${esc(product.condition || "—")}</span></p>
        <p class="meta">${esc(set.name)}${number}</p>
        <p class="qty">${esc(qty)}</p>
        <p class="price">${esc(priceLabel(product))}</p>
      </a>
      ${buyButton(product, set.name)}
    </article>`;
}

function grid(items) {
  if (!items.length) return `<p class="empty">Nenhum item por aqui.</p>`;
  return `<div class="grid">${items.map(cardHtml).join("")}</div>`;
}

function shelf(id, title, items) {
  return `
    <section class="shelf" id="${id}">
      <div class="section-head">
        <h2>${esc(title)}</h2>
      </div>
      <div class="shelf-scroll">${grid(items)}</div>
    </section>`;
}

function byPrice(items) {
  return items.slice().sort((a, b) => Number(b.price) - Number(a.price) || String(a.name).localeCompare(String(b.name), "pt"));
}

function sealedShelves(list, prefix) {
  const etbs = byPrice(list.filter((product) => sealedKind(product.name) === "ETB"));
  const upcs = byPrice(list.filter((product) => sealedKind(product.name) === "UPC"));
  return {
    etbs,
    upcs,
    html: [
      etbs.length ? shelf(`${prefix}-etb`, "ETB", etbs) : "",
      upcs.length ? shelf(`${prefix}-upc`, "UPC", upcs) : "",
    ].join(""),
  };
}

function lacradosPage() {
  const { html } = sealedShelves(filtered("sealed"), "lacrados");
  return page("Lacrados", "Booster, caixa e coleção fechada.", html || `<p class="empty">Nenhum item por aqui.</p>`);
}

function bannerHtml() {
  const slides = publicBanners(banners);
  if (!slides.length) return "";
  return `
    <div class="hero">
      <div class="hero-rotator">
        ${slides.map((item, index) => {
          const href = item.href || "#/";
          const external = href.startsWith("https://");
          const scroll = item.scroll ? ` data-scroll="${esc(item.scroll)}"` : "";
          const target = external ? ` target="_blank" rel="noopener noreferrer"` : "";
          return `<a class="${index === 0 ? "is-on" : ""}" href="${esc(href)}"${target}${scroll}><img src="${esc(item.image)}" alt="${esc(item.label || "Banner")}" /></a>`;
        }).join("")}
      </div>
      ${slides.length > 1 ? `<div class="hero-dots">${slides.map((_, index) => `<button type="button" class="${index === 0 ? "is-on" : ""}" aria-label="Banner ${index + 1}"></button>`).join("")}</div>` : ""}
    </div>`;
}

function page(title, lede, body) {
  document.title = title === "Master Bu" ? title : `${title} · Master Bu`;
  return `<h1>${esc(title)}</h1>${lede ? `<p class="lede">${esc(lede)}</p>` : ""}${body}`;
}

function chosenSetId() {
  const id = slugId(setSelect.value, 48);
  if (!id) return "";
  if (pickerSets.some((set) => set.id === id) || sets.some((set) => set.id === id)) return id;
  return "";
}

const PRESALE_ORDER = ["me6-triple", "me6-quad", "me6-box", "me6-combo", "me6-etb"];

function sortPresale(items) {
  return items.slice().sort((a, b) => {
    const rank = (id) => {
      const index = PRESALE_ORDER.indexOf(id);
      return index < 0 ? PRESALE_ORDER.length : index;
    };
    return rank(a.id) - rank(b.id);
  });
}

function filtered(kind) {
  const setId = chosenSetId();
  return filterProducts(products, { kind, setId, fields: "store" }).filter((product) => !kind || kind === "all" || displayKind(product) === kind);
}

function home() {
  const setId = chosenSetId();
  const list = products.filter((product) => !setId || product.set_id === setId);
  const alta = list.filter((product) => displayKind(product) === "single" && Number(product.price) >= 200).sort((a, b) => Number(b.price) - Number(a.price));
  const avulsos = byPrice(list.filter((product) => displayKind(product) === "single"));
  const sealed = sealedShelves(list.filter((product) => displayKind(product) === "sealed"), "loja");
  const masters = byPrice(list.filter((product) => displayKind(product) === "master"));
  document.title = "Master Bu";
  const prevenda = sortPresale(list.filter((product) => displayKind(product) === "presale"));
  const tabs = [
    ["#/avulsos", "/assets/icons/avulsos.png", "Avulsos"],
    ["#/prevenda", "/assets/icons/prevenda.png", "Pré-venda"],
    ["#/lacrados", "/assets/icons/lacrados.png", "Lacrados"],
  ];
  const shelves = [
    alta.length ? shelf("loja-alta", "Em alta", alta) : "",
    avulsos.length ? shelf("loja-avulsos", "Avulsos", avulsos) : "",
    prevenda.length ? shelf("loja-prevenda", "Pré-venda", prevenda) : "",
    sealed.html,
    masters.length ? shelf("loja-master", "Master sets", masters) : "",
  ].join("");
  return `
    ${bannerHtml()}
    ${`<nav class="home-tabs" aria-label="Seções da loja">${tabs.map(([href, icon, label]) => `<a href="${href}"><img src="${icon}" alt="" width="22" height="22" />${label}</a>`).join("")}</nav>`}
    ${shelves}`;
}

function itemPage(id) {
  const product = products.find((entry) => entry.id === id);
  if (!product) return `<p class="empty">Esse item não está mais na vitrine.</p><p><a href="#/">Voltar ao início</a></p>`;
  const set = setOf(product.set_id);
  const qty = onOrder(product) ? "Sob encomenda" : `${product.qty} un.`;
  document.title = `${product.name} · Master Bu`;
  return `
    <a class="back" href="#/${displayKind(product) === "presale" ? "prevenda" : displayKind(product) === "master" ? "masterset" : displayKind(product) === "sealed" ? "lacrados" : "avulsos"}">Voltar</a>
    <article class="detail">
      ${shot(product)}
      <div>
        <h1>${esc(product.name)}</h1>
        <p class="price">${esc(priceLabel(product))}</p>
        <table class="specs">
          <tr><th>Coleção</th><td><a class="set-link" href="#/set/${esc(encodeURIComponent(set.id))}">${set.id ? `<img data-set-logo alt="" src="${esc(setLogoSrc(set.id))}" />` : ""}${esc(set.name)}</a></td></tr>
          <tr><th>Número</th><td>${esc(product.number || "—")}</td></tr>
          <tr><th>Raridade</th><td>${esc(product.rarity || "—")}</td></tr>
          <tr><th>Condição</th><td>${esc(product.condition || "—")}</td></tr>
          <tr><th>Idioma</th><td>${langMark(product.lang)}</td></tr>
          <tr><th>Acabamento</th><td>${esc(product.finish || "—")}</td></tr>
          <tr><th>Quantidade</th><td>${esc(qty)}</td></tr>
          <tr><th>Tipo</th><td>${esc(kindName(product))}</td></tr>
        </table>
        ${buyButton(product, set.name)}
        ${WHATSAPP_PHONE ? "" : `<p class="note">O número do WhatsApp da loja ainda vai ser informado.</p>`}
      </div>
    </article>`;
}

function setsPage() {
  const cards = sets.filter((set) => products.some((product) => product.set_id === set.id)).map((set) => {
    const count = products.filter((product) => product.set_id === set.id).length;
    return `
      <a class="set-card" href="#/set/${esc(encodeURIComponent(set.id))}">
        <img data-set-logo alt="" src="${esc(setLogoSrc(set.id))}" />
        <span><strong>${esc(set.name)}</strong><span>${esc(set.code)}${count ? ` · ${count}` : ""}</span></span>
      </a>`;
  }).join("");
  return page("Coleções", "As coleções que estão na loja.", cards ? `<div class="sets">${cards}</div>` : `<p class="empty">Nenhuma coleção cadastrada.</p>`);
}

function contactPage() {
  const phone = String(WHATSAPP_PHONE || "").replace(/\D/g, "");
  const wa = phone ? `<a href="https://api.whatsapp.com/send?phone=${phone}">WhatsApp</a>` : "WhatsApp — o número ainda vai ser informado";
  return page("Contato", "A compra e as dúvidas seguem por aqui.", `
    <ul class="contact-list">
      <li><a href="${esc(STORE.instagramUrl)}">Instagram ${esc(STORE.instagram)}</a></li>
      <li>${wa}</li>
    </ul>`);
}

function aboutPage() {
  return page("Sobre", "", `
    <div class="prose">
      <p>A Master Bu vende cartas avulsas e produtos lacrados de Pokémon TCG.</p>
      <p>Quem responde pela loja são ${esc(STORE.partners[0])} e ${esc(STORE.partners[1])}, sócios da ${esc(STORE.legal)}, CNPJ ${esc(STORE.cnpj)}.</p>
      <p>O pedido não fecha neste site. O botão do item abre o WhatsApp com o nome, a coleção, o número, o idioma, a condição, o acabamento e o preço.</p>
    </div>`);
}

function render() {
  const skipped = new Set(["cadastro", "entrar", "conta", "termos", "carrinho", "checkout"]);
  const current = route();
  if (skipped.has(current.name)) {
    location.replace("#/");
    return;
  }
  paintNav();
  const { name, id } = current;
  const query = safeSearch(qInput.value);
  if (query && !failed) {
    const found = filterProducts(products, { query, setId: chosenSetId(), fields: "store" });
    main.innerHTML = page(found.length ? `${found.length} ${found.length > 1 ? "resultados" : "resultado"}` : "Nenhum resultado", query, grid(found));
    bindImages();
    return;
  }
  if (name === "contato") main.innerHTML = contactPage();
  else if (name === "sobre") main.innerHTML = aboutPage();
  else if (legal(name)) {
    const doc = legal(name);
    main.innerHTML = page(doc.title, "", `<div class="prose">${doc.body}</div>`);
  } else if (failed) {
    main.innerHTML = `<p class="empty">A vitrine não carregou agora. Tente de novo em instantes.</p>`;
    reveal();
    return;
  } else if (name === "item") main.innerHTML = itemPage(id);
  else if (name === "set") {
    const set = sets.find((entry) => entry.id === id);
    if (!set) main.innerHTML = `<p class="empty">Coleção não encontrada.</p>`;
    else {
      document.title = `${set.name} · Master Bu`;
      main.innerHTML = `<h1 class="with-logo">${set.id ? `<img data-set-logo alt="" src="${esc(setLogoSrc(set.id))}" />` : ""}${esc(set.name)}</h1><p class="lede">${esc(set.code)}</p>${grid(products.filter((product) => product.set_id === set.id))}`;
    }
  } else if (name === "alta") main.innerHTML = page("Em alta", "Cartas a partir de R$ 200.", grid(products.filter((product) => (!chosenSetId() || product.set_id === chosenSetId()) && displayKind(product) === "single" && Number(product.price) >= 200).sort((a, b) => Number(b.price) - Number(a.price))));
  else if (name === "avulsos") main.innerHTML = page("Avulsos", "Cartas soltas.", grid(filtered("single")));
  else if (name === "prevenda") main.innerHTML = page("Pré-venda", "Reinado Delta", grid(sortPresale(filtered("presale"))));
  else if (name === "lacrados") main.innerHTML = lacradosPage();
  else if (name === "masterset") main.innerHTML = page("Master sets", "Coleções completas à venda.", grid(filtered("master")));
  else if (name === "colecoes") main.innerHTML = setsPage();
  else if (name === "home") main.innerHTML = home();
  else main.innerHTML = `<p class="empty">Essa página não existe.</p><p><a href="#/">Voltar ao início</a></p>`;
  bindImages();
  spinHero();
  const jump = sessionStorage.getItem("mbu.scroll");
  if (jump && name === "home") {
    sessionStorage.removeItem("mbu.scroll");
    document.getElementById(jump)?.scrollIntoView({ behavior: "smooth", block: "start" });
  }
}

function reveal() {
  main.classList.remove("is-ready");
  requestAnimationFrame(() => main.classList.add("is-ready"));
}

function bindRails() {
  document.querySelectorAll(".shelf-scroll").forEach((row) => {
    if (row.dataset.drag) return;
    row.dataset.drag = "1";
    let startX = 0;
    let startScroll = 0;
    let moved = false;
    let tracking = false;
    let pointerId = 0;
    row.addEventListener("pointerdown", (event) => {
      if (event.pointerType === "touch" || event.button !== 0) return;
      if (event.target.closest("a.buy")) return;
      startX = event.clientX;
      startScroll = row.scrollLeft;
      moved = false;
      tracking = true;
      pointerId = event.pointerId;
    });
    row.addEventListener("pointermove", (event) => {
      if (!tracking || event.pointerId !== pointerId) return;
      const dx = event.clientX - startX;
      if (!moved && Math.abs(dx) <= 5) return;
      if (!moved) {
        moved = true;
        row.classList.add("is-drag");
        row.setPointerCapture(event.pointerId);
      }
      row.scrollLeft = startScroll - dx;
    });
    const end = (event) => {
      if (event.pointerId !== pointerId) return;
      tracking = false;
      row.classList.remove("is-drag");
    };
    row.addEventListener("pointerup", end);
    row.addEventListener("pointercancel", end);
    row.addEventListener("click", (event) => {
      if (!moved) return;
      event.preventDefault();
      event.stopPropagation();
      moved = false;
    }, true);
  });
}

function bindImages() {
  main.querySelectorAll("[data-card]").forEach((img) => {
    const swap = () => {
      const fallback = img.dataset.fallback;
      if (!fallback || img.dataset.swapped) {
        img.hidden = true;
        return;
      }
      img.dataset.swapped = "1";
      img.removeAttribute("data-card");
      img.setAttribute("data-set-logo", "");
      img.src = fallback;
    };
    const check = () => { if (isCardBack(img.naturalWidth, img.naturalHeight)) swap(); };
    img.addEventListener("load", check);
    img.addEventListener("error", swap);
    if (img.complete) check();
  });
  bindSetLogos(main);
  paintFilterLogo();
  main.classList.toggle("shine", main.querySelectorAll(".card").length > 1);
  bindRails();
  reveal();
}

function paintFilterLogo() {
  const id = chosenSetId();
  const label = document.getElementById("colecao-label");
  const chosen = pickerSets.find((set) => set.id === id) || sets.find((set) => set.id === id);
  showSetLogo(document.getElementById("colecao-logo"), id);
  if (label) label.textContent = chosen?.name || "Todas as coleções";
  document.querySelectorAll("#colecao-menu button").forEach((button) => {
    button.setAttribute("aria-selected", button.dataset.set === id ? "true" : "false");
  });
}

let heroTimer = 0;
function spinHero() {
  clearInterval(heroTimer);
  const box = main.querySelector(".hero-rotator");
  if (!box) return;
  const slides = [...box.querySelectorAll("a")];
  const dots = [...main.querySelectorAll(".hero-dots button")];
  if (slides.length < 2) return;
  let index = 0;
  const show = (next) => {
    index = next;
    slides.forEach((slide, i) => slide.classList.toggle("is-on", i === index));
    dots.forEach((dot, i) => {
      dot.classList.toggle("is-on", i === index);
      if (i !== index) return;
      dot.classList.remove("is-on");
      void dot.offsetWidth;
      dot.classList.add("is-on");
    });
  };
  heroTimer = setInterval(() => show((index + 1) % slides.length), 5000);
  dots.forEach((dot, i) => { dot.onclick = () => show(i); });
}

function catalogSets() {
  const names = { ...SET_PT };
  for (const set of sets) if (set?.name) names[set.id] = set.name;
  const source = catalog.length
    ? catalog
    : Object.keys(SET_PT).map((id) => ({ id, name: SET_PT[id], ptcgoCode: "" }));
  const seen = new Set();
  const list = [];
  for (const set of source) {
    const id = slugId(set.id, 48);
    if (!id || seen.has(id)) continue;
    seen.add(id);
    list.push({ id, name: officialLabel(set, names) || set.name || id });
  }
  for (const set of sets) {
    const id = slugId(set.id, 48);
    if (!id || seen.has(id)) continue;
    seen.add(id);
    list.push({ id, name: set.name || id });
  }
  return list;
}

function fillSets() {
  const current = chosenSetId();
  pickerSets = catalogSets();
  setSelect.innerHTML = `<option value="">Todas as coleções</option>${pickerSets.map((set) => `<option value="${esc(set.id)}">${esc(set.name)}</option>`).join("")}`;
  if ([...setSelect.options].some((option) => option.value === current)) setSelect.value = current;
  const menu = document.getElementById("colecao-menu");
  menu.innerHTML = `<button type="button" role="option" data-set=""><span>Todas as coleções</span></button>${pickerSets.map((set) => `<button type="button" role="option" data-set="${esc(set.id)}"><img data-set-logo alt="" src="${esc(setLogoSrc(set.id))}" /><span>${esc(set.name)}</span></button>`).join("")}`;
  bindSetLogos(menu);
  paintFilterLogo();
}

async function loadCatalog() {
  const key = "mbu.officialSets";
  try {
    const cached = JSON.parse(sessionStorage.getItem(key) || "null");
    if (Array.isArray(cached) && cached.length) return cached;
  } catch {
    /* cache inválido */
  }
  const list = await fetchOfficialSets();
  try { sessionStorage.setItem(key, JSON.stringify(list)); } catch { /* sessão cheia */ }
  return list;
}

async function loadShop() {
  try {
    const sb = await client();
    const [setRes, productRes, bannerRes, tabRes] = await Promise.all([
      sb.from("sets").select("id,name,code,sort").order("sort"),
      sb.from("products").select("id,kind,name,set_id,number,rarity,condition,lang,finish,qty,price,image").order("name"),
      sb.from("banners").select("id,image,href,label,scroll,sort").order("sort"),
      sb.from("tabs").select("id,label,href,icon,sort").order("sort"),
    ]);
    if (!tabRes.error && tabRes.data?.length) siteTabs = tabRes.data;
    if (setRes.error || productRes.error || bannerRes.error) throw setRes.error || productRes.error || bannerRes.error;
    sets = setRes.data || [];
    products = (productRes.data || []).filter(forSale);
    banners = bannerRes.data || [];
    failed = false;
    fillSets();
    loadCatalog().then((list) => {
      catalog = Array.isArray(list) ? list : [];
      fillSets();
      render();
    }).catch((error) => console.error(error));
  } catch (error) {
    failed = true;
    paintNav();
    console.error(error);
  }
  render();
  trackVisit();
}

function trackVisit() {
  if (localStorage.getItem("mbu.cookies") !== "all") return;
  const day = saoPauloDay(new Date());
  if (localStorage.getItem("mbu.visitDay") === day || tracked.has(day)) return;
  tracked.add(day);
  const send = async (visitor, city) => {
    try {
      const sb = await client();
      const row = buildVisit({ path: location.hash || "#/", visitor, city });
      if (!row.visitor) { tracked.delete(day); return; }
      const { error } = await sb.from("visits").insert(row, { returning: "minimal" });
      if (error && error.code !== "23505") { tracked.delete(day); return; }
      localStorage.setItem("mbu.visitDay", day);
    } catch {
      tracked.delete(day);
    }
  };
  const cached = sessionStorage.getItem("mbu.ip");
  if (cached) { send(cached, sessionStorage.getItem("mbu.city") || ""); return; }
  fetch("https://ipwho.is/").then((response) => response.json()).then((geo) => {
    const ip = geo && geo.ip ? String(geo.ip) : "";
    const city = geo && geo.city ? [geo.city, geo.region_code || geo.region].filter(Boolean).join(" — ") : "";
    if (ip) sessionStorage.setItem("mbu.ip", ip);
    if (city) sessionStorage.setItem("mbu.city", city);
    send(ip, city);
  }).catch(() => { tracked.delete(day); });
}

function paintCookies() {
  const choice = localStorage.getItem("mbu.cookies");
  if (choice === "all" || choice === "necessary") { cookieBox.hidden = true; return; }
  cookieBox.hidden = false;
  cookieBox.innerHTML = `
    <p>A visita (página, IP e cidade) só é registrada se você aceitar. <a href="#/cookies">Cookies</a></p>
    <div>
      <button class="ghost" type="button" id="cookie-necessary">Só o necessário</button>
      <button class="solid" type="button" id="cookie-all">Aceitar</button>
    </div>`;
  document.getElementById("cookie-necessary").onclick = () => {
    localStorage.setItem("mbu.cookies", "necessary");
    paintCookies();
  };
  document.getElementById("cookie-all").onclick = () => {
    localStorage.setItem("mbu.cookies", "all");
    paintCookies();
    trackVisit();
  };
}

document.querySelector(".find").addEventListener("submit", (event) => event.preventDefault());
qInput.addEventListener("input", render);
setSelect.addEventListener("change", render);
const setButton = document.getElementById("colecao-btn");
const setMenu = document.getElementById("colecao-menu");
setButton.addEventListener("click", () => {
  const open = setMenu.hidden;
  setMenu.hidden = !open;
  setButton.setAttribute("aria-expanded", String(open));
});
setMenu.addEventListener("click", (event) => {
  const choice = event.target.closest("[data-set]");
  if (!choice) return;
  setSelect.value = slugId(choice.dataset.set, 48);
  setMenu.hidden = true;
  setButton.setAttribute("aria-expanded", "false");
  setSelect.dispatchEvent(new Event("change"));
});
document.addEventListener("click", (event) => {
  if (event.target.closest(".set-pick")) return;
  setMenu.hidden = true;
  setButton.setAttribute("aria-expanded", "false");
});
const menuButton = document.getElementById("menu-btn");
menuButton.addEventListener("click", () => {
  const open = nav.hidden;
  nav.hidden = !open;
  menuButton.setAttribute("aria-expanded", String(open));
});
nav.addEventListener("click", (event) => {
  if (!event.target.closest("a")) return;
  nav.hidden = true;
  menuButton.setAttribute("aria-expanded", "false");
});
document.addEventListener("click", (event) => {
  if (event.target.closest(".menu-wrap")) return;
  nav.hidden = true;
  menuButton.setAttribute("aria-expanded", "false");
});
window.addEventListener("hashchange", () => { render(); trackVisit(); });
document.addEventListener("click", (event) => {
  const link = event.target.closest("[data-scroll]");
  if (!link) return;
  const id = link.getAttribute("data-scroll");
  if ((location.hash || "#/") === "#/") {
    event.preventDefault();
    document.getElementById(id)?.scrollIntoView({ behavior: "smooth", block: "start" });
  } else sessionStorage.setItem("mbu.scroll", id);
});

paintCookies();
loadShop();
