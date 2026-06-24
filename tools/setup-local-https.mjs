#!/usr/bin/env node

import { execSync, spawnSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { getBonjourHostname, getLanIp } from "./local-network.mjs";

const root = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const certDir = path.join(root, ".local-certs");
const PORT = Number(process.env.PORT) || 8443;

function run(command, args, options = {}) {
  return spawnSync(command, args, { encoding: "utf8", ...options });
}

function ensureMkcert() {
  const found = run("which", ["mkcert"]);
  if (found.status === 0 && found.stdout.trim()) return found.stdout.trim();

  console.log("mkcert をインストールしています（初回のみ）…");
  const brew = run("which", ["brew"]);
  if (brew.status !== 0 || !brew.stdout.trim()) {
    console.error("mkcert が見つかりません。Homebrew で `brew install mkcert` を実行してください。");
    process.exit(1);
  }

  const install = run("brew", ["install", "mkcert"], { stdio: "inherit" });
  if (install.status !== 0) process.exit(install.status || 1);

  const again = run("which", ["mkcert"]);
  if (again.status !== 0 || !again.stdout.trim()) {
    console.error("mkcert のインストールに失敗しました。");
    process.exit(1);
  }
  return again.stdout.trim();
}

function main() {
  console.log("\n歌ノート — ローカル HTTPS セットアップ（初回のみ）\n");

  ensureMkcert();

  console.log("この Mac に mkcert の信頼設定を追加しています…");
  console.log("（パスワードを聞かれたら Mac のログインパスワードを入力）\n");
  const install = run("mkcert", ["-install"], { stdio: "inherit" });
  if (install.status !== 0) {
    console.warn("\n⚠ mkcert -install はスキップまたは失敗しました。");
    console.warn("  ターミナルで `mkcert -install` を手動実行するか、");
    console.warn("  iPhone 側で rootCA.pem を信頼すれば動作します。\n");
  }

  const bonjourHost = getBonjourHostname();
  const lanIp = getLanIp();
  const hosts = ["localhost", "127.0.0.1", "::1", bonjourHost];
  if (lanIp) hosts.push(lanIp);

  fs.mkdirSync(certDir, { recursive: true });

  const certFile = path.join(certDir, "cert.pem");
  const keyFile = path.join(certDir, "key.pem");

  console.log(`証明書を作成: ${hosts.join(", ")}`);
  execSync(
    ["mkcert", "-cert-file", certFile, "-key-file", keyFile, ...hosts].join(" "),
    { stdio: "inherit", shell: true }
  );

  const caRoot = execSync("mkcert -CAROOT", { encoding: "utf8" }).trim();
  const caFile = path.join(caRoot, "rootCA.pem");
  const caCopy = path.join(certDir, "rootCA.pem");
  fs.copyFileSync(caFile, caCopy);

  const config = {
    port: PORT,
    bonjourHost,
    lanIp,
    certFile,
    keyFile,
    caCopy,
    createdAt: new Date().toISOString()
  };
  fs.writeFileSync(path.join(certDir, "config.json"), `${JSON.stringify(config, null, 2)}\n`);

  const primaryUrl = `https://${bonjourHost}:${PORT}`;

  console.log("\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
  console.log("  セットアップ完了");
  console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n");
  console.log("【この Mac で毎回】");
  console.log("  npm run serve:local\n");
  console.log("【iPhone で開く URL（固定）】");
  console.log(`  ${primaryUrl}`);
  if (lanIp) console.log(`  https://${lanIp}:${PORT}`);
  console.log("\n【iPhone 初回のみ — 証明書の信頼】");
  console.log("  1. AirDrop などで次のファイルを iPhone に送る");
  console.log(`     ${caCopy}`);
  console.log("  2. 設定 → 一般 → VPNとデバイス管理 → プロファイルをインストール");
  console.log("  3. 設定 → 一般 → 情報 → 証明書信頼設定 → mkcert をオン");
  console.log("\n【ホーム画面に追加（初回のみ）】");
  console.log("  Safari で URL を開く → 共有 → ホーム画面に追加\n");
  console.log("【開発の流れ】");
  console.log("  Mac でコードを編集 → iPhone の Safari / ホーム画面アプリを再読み込み\n");
  console.log("※ Mac と iPhone は同じ Wi‑Fi に接続してください。");
  console.log("※ IP が変わる場合はルーターで Mac の IP を固定するか、");
  console.log(`  ${bonjourHost} の URL を使ってください。\n`);
}

main();
