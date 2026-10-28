import { plain } from "./text.mjs";

export function buildVisit(input = {}) {
  return {
    path: plain(input.path, 120) || "/",
    visitor: plain(input.visitor, 64),
    city: plain(input.city, 80),
  };
}

export function saoPauloDay(value) {
  const date = value instanceof Date ? value : new Date(value);
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "America/Sao_Paulo",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(date);
}

function saoPauloParts(date) {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: "America/Sao_Paulo",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(date);
  return Object.fromEntries(parts.map((part) => [part.type, part.value]));
}

export function visitBounds(range, { from = "", to = "", now = new Date() } = {}) {
  if (range === "all") return { from: "", to: "" };
  if (range === "custom") return { from: from || "", to: to || "" };
  const parts = saoPauloParts(now);
  const year = Number(parts.year);
  const month = Number(parts.month);
  if (range === "prev") {
    const prevMonth = month === 1 ? 12 : month - 1;
    const prevYear = month === 1 ? year - 1 : year;
    const last = new Date(Date.UTC(year, month - 1, 0)).getUTCDate();
    return {
      from: `${prevYear}-${String(prevMonth).padStart(2, "0")}-01`,
      to: `${prevYear}-${String(prevMonth).padStart(2, "0")}-${String(last).padStart(2, "0")}`,
    };
  }
  return {
    from: `${parts.year}-${parts.month}-01`,
    to: `${parts.year}-${parts.month}-${parts.day}`,
  };
}

export function pageLabel(path) {
  if (!path || path === "#/" || path === "#" || path === "/") return "Início";
  if (path.startsWith("#/item") || path.startsWith("#/carta")) return "Item";
  if (path.startsWith("#/set")) return "Coleção";
  const names = {
    "#/avulsos": "Avulsos",
    "#/lacrados": "Lacrados",
    "#/prevenda": "Pré-venda",
    "#/colecoes": "Coleções",
    "#/contato": "Contato",
    "#/sobre": "Sobre",
    "#/privacidade": "Privacidade",
    "#/cookies": "Cookies",
    "#/envio": "Envio",
    "#/trocas": "Trocas",
    "#/reembolso": "Reembolso",
  };
  return names[path] || path;
}

export function summarizeVisits(visits, range, options = {}) {
  const bounds = visitBounds(range, options);
  const inRange = (visits || [])
    .filter((visit) => {
      const day = saoPauloDay(visit.created_at);
      if (bounds.from && day < bounds.from) return false;
      if (bounds.to && day > bounds.to) return false;
      return true;
    })
    .sort((a, b) => String(b.created_at).localeCompare(String(a.created_at)));
  const perDayMap = new Map();
  const pages = new Map();
  const cities = new Map();
  const people = new Set();
  for (const visit of inRange) {
    const day = saoPauloDay(visit.created_at);
    if (!perDayMap.has(day)) perDayMap.set(day, new Set());
    if (visit.visitor) {
      perDayMap.get(day).add(visit.visitor);
      people.add(visit.visitor);
    }
    pages.set(visit.path || "/", (pages.get(visit.path || "/") || 0) + 1);
    const city = visit.city || "Não informado";
    cities.set(city, (cities.get(city) || 0) + 1);
  }
  const today = saoPauloDay(options.now || new Date());
  return {
    rows: inRange,
    people: people.size,
    today: perDayMap.get(today)?.size || 0,
    perDay: [...perDayMap.keys()].sort().map((day) => ({
      day,
      label: `${day.slice(8, 10)}/${day.slice(5, 7)}`,
      people: perDayMap.get(day).size,
    })),
    pages: [...pages.entries()]
      .map(([path, count]) => ({ path, label: pageLabel(path), count }))
      .sort((a, b) => b.count - a.count || a.label.localeCompare(b.label, "pt")),
    cities: [...cities.entries()]
      .map(([city, count]) => ({ city, count }))
      .sort((a, b) => b.count - a.count || a.city.localeCompare(b.city, "pt")),
  };
}
