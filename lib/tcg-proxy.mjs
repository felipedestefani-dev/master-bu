export function clampPage(value) {
  const page = Number(value);
  if (!Number.isFinite(page)) return 1;
  return Math.max(1, Math.floor(page));
}

export function clampPageSize(value) {
  const size = Number(value);
  if (!Number.isFinite(size) || size <= 0) return 12;
  return Math.min(250, Math.max(1, Math.floor(size)));
}

export async function proxyCards({ q = "", page = 1, pageSize = 12, fetchImpl = fetch, attempts = 3 } = {}) {
  const safePage = clampPage(page);
  const safeSize = clampPageSize(pageSize);
  const safeQuery = String(q ?? "").replace(/[\u0000-\u001F\u007F]/g, "").slice(0, 120);
  const target = `https://api.pokemontcg.io/v2/cards?page=${safePage}&pageSize=${safeSize}&select=id,name,number,rarity,set,images&q=${encodeURIComponent(safeQuery)}`;
  for (let attempt = 0; attempt < attempts; attempt += 1) {
    try {
      const response = await fetchImpl(target, {
        headers: { Accept: "application/json", "User-Agent": "AMD-TCG/1.0" },
      });
      const text = await response.text();
      if (!response.ok) continue;
      return { status: 200, body: text };
    } catch {
      /* nova tentativa */
    }
  }
  return { status: 502, body: JSON.stringify({ error: "Falha ao consultar o catálogo." }) };
}

export async function handleTcg(req, deps = {}) {
  if ((req.method || "GET") !== "GET") {
    return { status: 405, body: JSON.stringify({ error: "Método não permitido." }) };
  }
  const url = new URL(req.url || "/", "http://localhost");
  const q = (req.query && req.query.q) || url.searchParams.get("q") || "";
  const page = (req.query && req.query.page) || url.searchParams.get("page");
  const pageSize = (req.query && req.query.pageSize) || url.searchParams.get("pageSize");
  return proxyCards({ q, page, pageSize, fetchImpl: deps.fetchImpl, attempts: deps.attempts });
}
