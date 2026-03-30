import http from "node:http";
import https from "node:https";

const TARGET_URL = "https://panel.idf-map.fr/idfmap/stats/statsDedicatedServer.php";
const PORT = process.env.PORT ? Number(process.env.PORT) : 8787;

function sendJson(res, status, body) {
  const payload = JSON.stringify(body);
  res.writeHead(status, {
    "Content-Type": "application/json; charset=utf-8",
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Methods": "GET, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type"
  });
  res.end(payload);
}

const server = http.createServer((req, res) => {
  if (!req || !req.url) {
    sendJson(res, 400, { error: "invalid request" });
    return;
  }

  if (req.method === "OPTIONS") {
    res.writeHead(204, {
      "Access-Control-Allow-Origin": "*",
      "Access-Control-Allow-Methods": "GET, OPTIONS",
      "Access-Control-Allow-Headers": "Content-Type",
      "Access-Control-Max-Age": "86400"
    });
    res.end();
    return;
  }

  if (req.method !== "GET") {
    sendJson(res, 405, { error: "method not allowed" });
    return;
  }

  const url = new URL(req.url, `http://127.0.0.1:${PORT}`);
  if (url.pathname !== "/convoy-status") {
    sendJson(res, 404, { error: "not found" });
    return;
  }

  https.get(TARGET_URL, (proxyRes) => {
    let data = "";
    proxyRes.on("data", (chunk) => {
      data += chunk;
    });
    proxyRes.on("end", () => {
      try {
        const parsed = JSON.parse(data);
        sendJson(res, 200, parsed);
      } catch {
        sendJson(res, 502, { error: "invalid upstream response" });
      }
    });
  }).on("error", () => {
    sendJson(res, 502, { error: "upstream request failed" });
  });
});

server.listen(PORT, "127.0.0.1", () => {
  process.stdout.write(`Convoy status proxy listening on http://127.0.0.1:${PORT}/convoy-status\n`);
});
