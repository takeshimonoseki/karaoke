#!/usr/bin/env node

import fs from "node:fs";
import https from "node:https";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { getBonjourHostname, getLanIp, readLocalConfig } from "./local-network.mjs";

const root = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const PORT = Number(process.env.PORT) || 8443;

const MIME = {
  ".html": "text/html; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".webmanifest": "application/manifest+json; charset=utf-8",
  ".png": "image/png",
  ".svg": "image/svg+xml",
  ".ico": "image/x-icon",
  ".txt": "text/plain; charset=utf-8"
};

function contentType(filePath) {
  return MIME[path.extname(filePath).toLowerCase()] || "application/octet-stream";
}

function safePath(urlPath) {
  const decoded = decodeURIComponent(urlPath.split("?")[0]);
  const relative = decoded === "/" ? "index.html" : decoded.replace(/^\//, "");
  const resolved = path.normalize(path.join(root, relative));
  if (!resolved.startsWith(root)) return null;
  return resolved;
}

function sendFile(res, filePath) {
  const stream = fs.createReadStream(filePath);
  stream.on("error", () => {
    if (!res.headersSent) {
      res.writeHead(404, { "Content-Type": "text/plain; charset=utf-8" });
      res.end("Not Found");
    }
  });
  res.writeHead(200, {
    "Content-Type": contentType(filePath),
    "Cache-Control": "no-cache"
  });
  stream.pipe(res);
}

function requestHandler(req, res) {
  const target = safePath(req.url || "/");
  if (!target) {
    res.writeHead(403, { "Content-Type": "text/plain; charset=utf-8" });
    res.end("Forbidden");
    return;
  }

  fs.stat(target, (error, stats) => {
    if (!error && stats.isFile()) {
      sendFile(res, target);
      return;
    }

    const withHtml = target.endsWith(".html") ? target : `${target}.html`;
    if (fs.existsSync(withHtml) && fs.statSync(withHtml).isFile()) {
      sendFile(res, withHtml);
      return;
    }

    const indexPath = path.join(target, "index.html");
    if (fs.existsSync(indexPath) && fs.statSync(indexPath).isFile()) {
      sendFile(res, indexPath);
      return;
    }

    if (req.url && !path.extname(req.url)) {
      sendFile(res, path.join(root, "index.html"));
      return;
    }

    res.writeHead(404, { "Content-Type": "text/plain; charset=utf-8" });
    res.end("Not Found");
  });
}

function printBanner(config) {
  const bonjourHost = config?.bonjourHost || getBonjourHostname();
  const lanIp = config?.lanIp || getLanIp();
  const primaryUrl = `https://${bonjourHost}:${PORT}`;

  console.log("\n歌ノート — ローカル開発サーバー（HTTPS）\n");
  console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
  console.log("  iPhone / Mac で開く URL");
  console.log(`  ${primaryUrl}`);
  if (lanIp) console.log(`  https://${lanIp}:${PORT}`);
  console.log(`  https://localhost:${PORT}`);
  console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n");
  console.log("コードを編集したら iPhone で再読み込みしてください。");
  console.log("終了: Ctrl+C\n");
}

function main() {
  const config = readLocalConfig(root);
  const certFile = config?.certFile || path.join(root, ".local-certs", "cert.pem");
  const keyFile = config?.keyFile || path.join(root, ".local-certs", "key.pem");

  if (!fs.existsSync(certFile) || !fs.existsSync(keyFile)) {
    console.error("証明書がありません。先に次を実行してください:\n  npm run setup:local\n");
    process.exit(1);
  }

  const server = https.createServer(
    {
      cert: fs.readFileSync(certFile),
      key: fs.readFileSync(keyFile)
    },
    requestHandler
  );

  server.listen(PORT, "0.0.0.0", () => {
    printBanner(config);
  });

  process.on("SIGINT", () => {
    server.close(() => process.exit(0));
  });
}

main();
