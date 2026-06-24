#!/usr/bin/env node

import { spawn } from "node:child_process";
import { fileURLToPath } from "node:url";
import path from "node:path";

const root = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const PORT = Number(process.env.PORT) || 8080;

function run(command, args, options = {}) {
  const child = spawn(command, args, {
    cwd: root,
    stdio: options.stdio || "inherit",
    shell: process.platform === "win32"
  });
  return child;
}

console.log("\n歌ノート — iPhone 確認用サーバー\n");
console.log(`静的ファイル: http://127.0.0.1:${PORT}`);
console.log("HTTPS トンネルを起動しています…\n");

const serve = run("npx", ["--yes", "serve", ".", "-l", String(PORT)]);
const tunnel = run("cloudflared", ["tunnel", "--url", `http://127.0.0.1:${PORT}`], {
  stdio: ["ignore", "pipe", "pipe"]
});

let tunnelUrl = "";

function onTunnelData(chunk) {
  const text = chunk.toString();
  process.stderr.write(text);
  const match = text.match(/https:\/\/[a-z0-9-]+\.trycloudflare\.com/);
  if (match && !tunnelUrl) {
    tunnelUrl = match[0];
    printInstructions(tunnelUrl);
  }
}

tunnel.stdout.on("data", onTunnelData);
tunnel.stderr.on("data", onTunnelData);

function printInstructions(url) {
  console.log("\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
  console.log("  iPhone で開く URL（HTTPS）");
  console.log(`  ${url}`);
  console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n");
  console.log("【ホーム画面に追加してアプリ化】");
  console.log("  1. iPhone の Safari で上の URL を開く");
  console.log("  2. 共有ボタン（□↑）→「ホーム画面に追加」");
  console.log("  3. 「追加」→ ホーム画面のアイコンから起動\n");
  console.log("※ 初回は曲データの読み込みに 1〜2 分かかることがあります。");
  console.log("※ 終了: Ctrl+C\n");
}

function shutdown() {
  serve.kill("SIGTERM");
  tunnel.kill("SIGTERM");
  process.exit(0);
}

process.on("SIGINT", shutdown);
process.on("SIGTERM", shutdown);

serve.on("exit", (code) => {
  if (code) process.exit(code);
});
tunnel.on("exit", (code) => {
  if (code) process.exit(code);
});
