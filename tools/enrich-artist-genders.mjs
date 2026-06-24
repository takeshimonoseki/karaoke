#!/usr/bin/env node
/** Report unknown artists from master extra for dictionary expansion */

import fs from "node:fs/promises";
import { resolveArtistGender } from "./artist-genders-core.mjs";

const file = process.argv[2] || "karaoke-master-extra.js";
const code = await fs.readFile(file, "utf8");
const match = code.match(/window\.UTA_NOTE_MASTER_EXTRA\s*=\s*(\[[\s\S]*\]);/);
if (!match) process.exit(1);

const songs = JSON.parse(match[1]);
const counts = new Map();

songs.forEach((song) => {
  if (resolveArtistGender(song.artist) !== "unknown") return;
  counts.set(song.artist, (counts.get(song.artist) || 0) + 1);
});

const top = [...counts.entries()].sort((a, b) => b[1] - a[1]).slice(0, 80);
console.log("Top unknown artists:");
top.forEach(([artist, n]) => console.log(`${n}\t${artist}`));
