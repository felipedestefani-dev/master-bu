import { STORE, WHATSAPP_PHONE } from "/js/config.js";
import { legal } from "/js/legal.js";
import { client } from "/js/supabase.js";
import { isCardBack, productImage } from "/lib/image.mjs";
import { displayKind, filterProducts } from "/lib/products.mjs";
import { publicBanners } from "/lib/banners.mjs";
import { DEFAULT_TABS, publicTabs } from "/lib/tabs.mjs";
import { buyLabel, money, onOrder, priceLabel, whatsappUrl } from "/lib/shop.mjs";
import { buildVisit, saoPauloDay } from "/lib/visits.mjs";
import { esc } from "/lib/text.mjs";

const main = document.getElementById("conteudo");
const qInput = document.getElementById("q");
const setSelect = document.getElementById("colecao");
const nav = document.getElementById("nav");
const cookieBox = document.getElementById("cookies");

let sets = [];
let products = [];
let banners = [];
let siteTabs = DEFAULT_TABS;
let failed = false;
const tracked = new Set();

const LANG = {
  PT: "Português", EN: "Inglês", JP: "Japonês", KO: "Coreano", ZH: "Chinês",
  ES: "Espanhol", FR: "Francês", DE: "Alemão", IT: "Italiano",
};

function setOf(id) {
  return sets.find((set) => set.id === id) || { id, name: id || "Sem coleção", code: "" };
}

function setLogo(id) {
  return `https://images.pokemontcg.io/${encodeURIComponent(id)}/logo.png`;
}

function kindName(product) {
  const kind = displayKind(product);
  if (kind === "presale") return "Pré-venda";
  if (kind === "sealed") return "Lacrado";
  return "Carta avulsa";
}

function route() {
  const parts = (location.hash || "#/").replace(/^#\/?/, "").split("/").filter(Boolean);
  let id = parts[1] || "";
  try { id = decodeURIComponent(id); } catch { /* mantém */ }
  return { name: parts[0] || "home", id };
}

function paintNav() {
  nav.innerHTML = publicTabs(siteTabs).map((tab) => `<a href="${esc(tab.href)}"><img src="${esc(tab.icon)}" alt="" width="22" height="22" />${esc(tab.label)}</a>`).join("");
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
  if (!src) return `<div class="shot"></div>`;
  return `<div class="shot"><img data-card src="${esc(src)}" alt="${esc(product.name)}" loading="lazy" /></div>`;
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

function shelf(id, title, href, items) {
  return `
    <section class="shelf" id="${id}">
      <div class="section-head">
        <h2>${esc(title)}</h2>
        <a href="${href}">Ver todos</a>
      </div>
      ${grid(items.slice(0, 8))}
    </section>`;
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

function filtered(kind) {
  const setId = setSelect.value;
  return filterProducts(products, { kind, setId, fields: "store" }).filter((product) => !kind || kind === "all" || displayKind(product) === kind);
}

function home() {
  const setId = setSelect.value;
  const list = products.filter((product) => !setId || product.set_id === setId);
  const alta = list.filter((product) => displayKind(product) === "single" && Number(product.price) >= 200).sort((a, b) => Number(b.price) - Number(a.price));
  const avulsos = list.filter((product) => displayKind(product) === "single");
  const prevenda = list.filter((product) => displayKind(product) === "presale");
  const lacrados = list.filter((product) => displayKind(product) === "sealed");
  document.title = "Master Bu";
  return `
    ${bannerHtml()}
    <p class="lede">Cartas avulsas e lacrados de Pokémon. A compra segue no WhatsApp.</p>
    <p class="shortcuts">
      <a href="#/avulsos">Avulsos</a>
      <a href="#/prevenda">Pré-venda</a>
      <a href="#/lacrados">Lacrados</a>
    </p>
    ${shelf("loja-alta", "Em alta", "#/alta", alta)}
    ${shelf("loja-avulsos", "Avulsos", "#/avulsos", avulsos)}
    ${shelf("loja-prevenda", "Pré-venda", "#/prevenda", prevenda)}
    ${shelf("loja-lacrados", "Lacrados", "#/lacrados", lacrados)}`;
}

function itemPage(id) {
  const product = products.find((entry) => entry.id === id);
  if (!product) return `<p class="empty">Esse item não está mais na vitrine.</p><p><a href="#/">Voltar ao início</a></p>`;
  const set = setOf(product.set_id);
  const qty = onOrder(product) ? "Sob encomenda" : `${product.qty} un.`;
  document.title = `${product.name} · Master Bu`;
  return `
    <a class="back" href="#/${displayKind(product) === "presale" ? "prevenda" : displayKind(product) === "sealed" ? "lacrados" : "avulsos"}">Voltar</a>
    <article class="detail">
      ${shot(product)}
      <div>
        <h1>${esc(product.name)}</h1>
        <p class="price">${esc(priceLabel(product))}</p>
        <table class="specs">
          <tr><th>Coleção</th><td><a href="#/set/${esc(encodeURIComponent(set.id))}">${esc(set.name)}</a></td></tr>
          <tr><th>Número</th><td>${esc(product.number || "—")}</td></tr>
          <tr><th>Raridade</th><td>${esc(product.rarity || "—")}</td></tr>
          <tr><th>Condição</th><td>${esc(product.condition || "—")}</td></tr>
          <tr><th>Idioma</th><td>${esc(LANG[product.lang] || product.lang || "—")}</td></tr>
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
  const cards = sets.map((set) => {
    const count = products.filter((product) => product.set_id === set.id).length;
    return `
      <a class="set-card" href="#/set/${esc(encodeURIComponent(set.id))}">
        <img data-set-logo alt="" src="${esc(setLogo(set.id))}" />
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
  markNav(current.name);
  const { name, id } = current;
  const query = qInput.value.trim();
  if (query && !failed) {
    const found = filterProducts(products, { query, setId: setSelect.value, fields: "store" });
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
    return;
  } else if (name === "item") main.innerHTML = itemPage(id);
  else if (name === "set") {
    const set = sets.find((entry) => entry.id === id);
    if (!set) main.innerHTML = `<p class="empty">Coleção não encontrada.</p>`;
    else main.innerHTML = page(set.name, set.code, grid(products.filter((product) => product.set_id === set.id)));
  } else if (name === "alta") main.innerHTML = page("Em alta", "Cartas a partir de R$ 200.", grid(products.filter((product) => (!setSelect.value || product.set_id === setSelect.value) && displayKind(product) === "single" && Number(product.price) >= 200).sort((a, b) => Number(b.price) - Number(a.price))));
  else if (name === "avulsos") main.innerHTML = page("Avulsos", "Cartas soltas.", grid(filtered("single")));
  else if (name === "prevenda") main.innerHTML = page("Pré-venda", "Itens para reservar.", grid(filtered("presale")));
  else if (name === "lacrados") main.innerHTML = page("Lacrados", "Booster, caixa e coleção fechada.", grid(filtered("sealed")));
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

function bindImages() {
  main.querySelectorAll("[data-card]").forEach((img) => {
    const check = () => { if (isCardBack(img.naturalWidth, img.naturalHeight)) img.hidden = true; };
    img.addEventListener("load", check);
    img.addEventListener("error", () => { img.hidden = true; });
    if (img.complete) check();
  });
  main.querySelectorAll("[data-set-logo]").forEach((img) => {
    const symbol = () => {
      if (img.dataset.step === "symbol") { img.hidden = true; return; }
      img.dataset.step = "symbol";
      img.src = img.src.replace("/logo.png", "/symbol.png");
    };
    const check = () => {
      if (!img.naturalWidth || isCardBack(img.naturalWidth, img.naturalHeight) || img.naturalHeight > img.naturalWidth * 1.05) symbol();
    };
    img.addEventListener("load", check);
    img.addEventListener("error", symbol);
    if (img.complete && img.naturalWidth) check();
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
    dots.forEach((dot, i) => dot.classList.toggle("is-on", i === index));
  };
  heroTimer = setInterval(() => show((index + 1) % slides.length), 5000);
  dots.forEach((dot, i) => { dot.onclick = () => show(i); });
}

function fillSets() {
  const current = setSelect.value;
  setSelect.innerHTML = `<option value="">Todas as coleções</option>${sets.map((set) => `<option value="${esc(set.id)}">${esc(set.name)}</option>`).join("")}`;
  if ([...setSelect.options].some((option) => option.value === current)) setSelect.value = current;
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
    paintNav();
    if (setRes.error || productRes.error || bannerRes.error) throw setRes.error || productRes.error || bannerRes.error;
    sets = setRes.data || [];
    products = productRes.data || [];
    banners = bannerRes.data || [];
    failed = false;
    fillSets();
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
