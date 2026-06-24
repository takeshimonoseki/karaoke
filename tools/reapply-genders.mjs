#!/usr/bin/env node
/** Re-apply gender tags to karaoke-master-extra.js using artist-genders-core */

import fs from "node:fs/promises";
import { resolveArtistGender } from "./artist-genders-core.mjs";

const file = process.argv[2] || "karaoke-master-extra.js";
const code = await fs.readFile(file, "utf8");
const match = code.match(/window\.UTA_NOTE_MASTER_EXTRA\s*=\s*(\[[\s\S]*\]);/);
if (!match) {
  console.error("Could not parse", file);
  process.exit(1);
}

const songs = JSON.parse(match[1]);
let updated = 0;
let unknown = 0;

songs.forEach((song) => {
  const resolved = resolveArtistGender(song.artist);
  if (resolved !== "unknown") {
    if (song.gender !== resolved) updated += 1;
    song.gender = resolved;
  } else {
    unknown += 1;
  }
});

const minified = process.argv.includes("--minify");
const body = minified
  ? `window.UTA_NOTE_MASTER_EXTRA=${JSON.stringify(songs)};\n`
  : `window.UTA_NOTE_MASTER_EXTRA = ${JSON.stringify(songs, null, 2)};\n`;

await fs.writeFile(file, body, "utf8");
console.error(`Updated ${updated} songs. Unknown: ${unknown}/${songs.length} (${(unknown / songs.length * 100).toFixed(1)}%)`);
