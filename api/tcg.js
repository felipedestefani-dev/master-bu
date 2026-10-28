import { handleTcg } from "../lib/tcg-proxy.mjs";

function send(res, result) {
  res.status(result.status).setHeader("content-type", "application/json; charset=utf-8").send(result.body);
}

export default async function handler(req, res) {
  send(res, await handleTcg(req));
}
