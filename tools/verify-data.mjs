#!/usr/bin/env node

import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { resolveArtistGender } from "./artist-genders-core.mjs";

const root = path.dirname(path.dirname(fileURLToPath(import.meta.url)));

async function loadScript(path, exportName) {
  const code = await fs.readFile(`${root}/${path}`, "utf8");
  const fn = new Function(`${code}; return ${exportName};`);
  return fn();
}

function countGender(songs) {
  const counts = { male: 0, female: 0, mixed: 0, unknown: 0 };
  songs.forEach((s) => {
    const g = s.gender || "unknown";
    counts[g] = (counts[g] || 0) + 1;
  });
  return counts;
}

async function main() {
  const failures = [];

  const rankingsCode = await fs.readFile(path.join(root, "karaoke-rankings.js"), "utf8");
  eval(rankingsCode.replace("window.getCuratedKaraokeRanking", "global.getCuratedKaraokeRanking"));
  global.window = global;
  eval((await fs.readFile(path.join(root, "artist-genders.js"), "utf8")).replace(/window\./g, "global."));
  eval((await fs.readFile(path.join(root, "karaoke-master-supplement.js"), "utf8")).replace(/window\./g, "global."));
  eval((await fs.readFile(path.join(root, "karaoke-master-extra.js"), "utf8")).replace(/window\./g, "global."));
  eval((await fs.readFile(path.join(root, "karaoke-master.js"), "utf8")).replace(/window\./g, "global."));

  const extraCode = await fs.readFile(path.join(root, "karaoke-master-extra.js"), "utf8");
  const extraMatch = extraCode.match(/window\.UTA_NOTE_MASTER_EXTRA\s*=\s*(\[[\s\S]*\]);/);
  const extra = extraMatch ? JSON.parse(extraMatch[1]) : [];
  const extraGender = countGender(extra);
  const unknownPct = (extraGender.unknown / extra.length) * 100;
  if (unknownPct > 80) {
    failures.push(`extra unknown gender ${unknownPct.toFixed(1)}% > 80%`);
  }

  const male40Anime = getCuratedKaraokeRanking("forties", "anime").filter((row) => {
    const g = resolveArtistGender(row.artist);
    return g === "male" || g === "mixed";
  }).length;
  if (male40Anime < 15) {
    failures.push(`40s anime male curated ${male40Anime} < 15`);
  }

  const sixtiesTotal = getCuratedKaraokeRanking("sixties", "total");
  const badSixties = ["Lemon", "水平線", "ライラック"].filter((title) =>
    sixtiesTotal.some((row) => row.title.includes(title))
  );
  if (badSixties.length) {
    failures.push(`sixties total contains new songs: ${badSixties.join(", ")}`);
  }

  if (failures.length) {
    console.error("VERIFY FAILED:");
    failures.forEach((f) => console.error(" -", f));
    process.exit(1);
  }

  console.log("VERIFY OK");
  console.log(`extra: ${extra.length} songs, unknown ${unknownPct.toFixed(1)}%`);
  console.log(`40s anime male curated: ${male40Anime}`);
  console.log(`master count: ${global.UtaNoteKaraokeMaster.count}`);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
