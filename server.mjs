import fs from "node:fs";
import http from "node:http";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { handleSealed } from "./lib/sealed.mjs";
import { handleTcg } from "./lib/tcg-proxy.mjs";

const root = path.dirname(fileURLToPath(import.meta.url));
const port = Number(process.env.PORT) || 5173;
const types = {
  ".html": "text/html; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".mjs": "text/javascript; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".png": "image/png",
  ".webp": "image/webp",
  ".svg": "image/svg+xml",
  ".json": "application/json; charset=utf-8",
};

function sendJson(res, result) {
  res.writeHead(result.status, { "content-type": "application/json; charset=utf-8" });
  res.end(result.body);
}

const server = http.createServer(async (req, res) => {
  const url = new URL(req.url || "/", "http://localhost");
  if (url.pathname === "/api/tcg") {
    sendJson(res, await handleTcg(req));
    return;
  }
  if (url.pathname === "/api/sealed") {
    sendJson(res, await handleSealed(req));
    return;
  }
  let pathname = decodeURIComponent(url.pathname);
  if (pathname === "/admin") pathname = "/admin/index.html";
  if (pathname.includes("..") || pathname.startsWith("/node_modules") || pathname.startsWith("/test") || pathname.startsWith("/supabase")) {
    res.writeHead(404, { "content-type": "text/plain; charset=utf-8" });
    res.end("Não encontrado");
    return;
  }
  const file = path.normalize(path.join(root, pathname));
  if (!file.startsWith(root)) {
    res.writeHead(403).end();
    return;
  }
  fs.stat(file, (error, stat) => {
    const target = !error && stat.isDirectory() ? path.join(file, "index.html") : file;
    fs.readFile(target, (readError, data) => {
      if (readError) {
        res.writeHead(404, { "content-type": "text/plain; charset=utf-8" });
        res.end("Não encontrado");
        return;
      }
      res.writeHead(200, { "content-type": types[path.extname(target)] || "application/octet-stream" });
      res.end(data);
    });
  });
});

server.listen(port, () => {
  console.log(`http://localhost:${port}`);
});
