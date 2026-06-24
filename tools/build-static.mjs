#!/usr/bin/env node

import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const dist = path.join(root, "dist");

const COPY_FILES = [
  "index.html",
  "styles.css",
  "manifest.webmanifest",
  "sw.js",
  "labels.js",
  "version.js",
  "auto-backup.js",
  "storage.js",
  "karaoke-rankings.js",
  "artist-genders.js",
  "master-cache.js",
  "karaoke-master.js",
  "karaoke-master-supplement.js",
  "karaoke-master-extra.js",
  "search-aliases.js",
  "app.js"
];

const COPY_DIRS = ["icons"];

function copyFile(src, dest) {
  fs.mkdirSync(path.dirname(dest), { recursive: true });
  fs.copyFileSync(src, dest);
}

function copyDir(src, dest) {
  fs.mkdirSync(dest, { recursive: true });
  for (const entry of fs.readdirSync(src, { withFileTypes: true })) {
    const from = path.join(src, entry.name);
    const to = path.join(dest, entry.name);
    if (entry.isDirectory()) copyDir(from, to);
    else copyFile(from, to);
  }
}

function main() {
  if (fs.existsSync(dist)) fs.rmSync(dist, { recursive: true, force: true });
  fs.mkdirSync(dist, { recursive: true });

  for (const file of COPY_FILES) {
    copyFile(path.join(root, file), path.join(dist, file));
  }
  for (const dir of COPY_DIRS) {
    copyDir(path.join(root, dir), path.join(dist, dir));
  }

  fs.writeFileSync(path.join(dist, ".nojekyll"), "\n");
  console.log(`静的ファイルを dist/ に出力しました（${COPY_FILES.length} ファイル）`);
}

main();
