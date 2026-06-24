#!/usr/bin/env node
/** Generate artist-genders.js from artist-genders-core.mjs (single source of truth) */

import fs from "node:fs/promises";
import { FEMALE_HINTS, MALE_HINTS, MIXED_HINTS } from "./artist-genders-core.mjs";

const outFile = process.argv[2] || "artist-genders.js";

const body = `(() => {
  "use strict";

  const FEMALE_HINTS = ${JSON.stringify(FEMALE_HINTS, null, 4).replace(/^/gm, "  ")};

  const MALE_HINTS = ${JSON.stringify(MALE_HINTS, null, 4).replace(/^/gm, "  ")};

  const MIXED_HINTS = ${JSON.stringify(MIXED_HINTS, null, 4).replace(/^/gm, "  ")};

  function normalizeArtistKey(value) {
    return String(value || "")
      .normalize("NFKC")
      .toLocaleLowerCase("ja")
      .replace(/\\s+/g, " ")
      .trim();
  }

  function buildGenderMap() {
    const map = {
      smap: "mixed",
      "dreams come true": "mixed",
      "whiteflame feat.初音ミク": "mixed",
      "みきとp feat.鏡音リン": "mixed"
    };
    FEMALE_HINTS.forEach((hint) => {
      map[normalizeArtistKey(hint)] = "female";
    });
    MALE_HINTS.forEach((hint) => {
      const key = normalizeArtistKey(hint);
      if (!map[key]) map[key] = "male";
    });
    MIXED_HINTS.forEach((hint) => {
      map[normalizeArtistKey(hint)] = "mixed";
    });
    return map;
  }

  const ARTIST_GENDERS = buildGenderMap();

  function resolveArtistGender(artist) {
    const raw = String(artist || "").trim();
    if (!raw) return "unknown";

    const key = normalizeArtistKey(raw);
    if (ARTIST_GENDERS[key]) return ARTIST_GENDERS[key];

    for (const [hint, gender] of Object.entries(ARTIST_GENDERS)) {
      if (key.includes(hint) || hint.includes(key)) return gender;
    }

    if (/feat\\.|featuring|&|×|✕|with/i.test(raw)) return "mixed";
    if (/初音ミク|鏡音リン|鏡音レン|ボーカロイド|vocaloid/i.test(raw)) return "mixed";
    if (/cv[.:：]|（cv|一同|合唱/i.test(raw)) return "mixed";
    if (/^(ive|itzy|twice|aespa|nmixx|blackpink)$/i.test(raw)) return "female";
    if (/AKB48|乃木坂|櫻坂|日向坂|モーニング娘|℃-ute|NMB48|SKE48|HKT48|Berryz|Buono!|PASSOLOG/i.test(raw)) {
      return "female";
    }
    if (/ジャニーズ|KAT-TUN|Sexy Zone|King & Prince|SixTONES|Snow Man|BE:FIRST|なにわ男子|timelesz|Travis Japan|関ジャニ|Hey! Say! JUMP|Kis-My-Ft2|ジャニーズWEST|TOKIO|V6|KinKi|嵐|NEWS|少年隊|STARTO/i.test(raw)) {
      return "male";
    }
    if (/EXILE|三代目|GENERATIONS|THE RAMPAGE|FANTASTICS|BALLISTIK BOYZ|PSYCHIC FEVER/i.test(raw)) {
      return "male";
    }
    if (/光GENJI|少年隊|シブがき隊|チェッカーズ|男闘呼|男闘呼組|TIM|ZOO|ZOO$/i.test(raw)) {
      return "male";
    }
    if (/GARNET CROW|Every Little Thing|SPEED|MAX|Wink|ZARD|TRF|S\\.E\\.S\\.|≠ME|=LOVE|ももいろ/i.test(raw)) {
      return "female";
    }
    if (/SUPER JUNIOR|BOYS AND MEN|VISUAL KEi|V系|メタル/i.test(raw)) return "male";
    if (/^(AC\\/DC|T\\.Rex|Oasis|Queen|Eagles|Metallica|Nirvana|Guns N)/i.test(raw)) return "male";
    if (/北島|五木|細川|森進/.test(raw)) return "male";
    if (/都はるみ|八代|美空|坂本冬美/.test(raw)) return "female";
    if (/にじさんじ|ホロライブ|VTuber|星街|宝塚/i.test(raw)) return "mixed";
    if (/すとぷり|Stray Kids|ENHYPEN|TREASURE|BOYS/i.test(raw)) return "male";
    if (/家入レオ|阿部真央|藍井エイル|香西|星街|でんぱ/i.test(raw)) return "female";

    return "unknown";
  }

  window.UTA_NOTE_ARTIST_GENDERS = ARTIST_GENDERS;
  window.resolveArtistGender = resolveArtistGender;
})();
`;

await fs.writeFile(outFile, body, "utf8");
console.error(`wrote ${outFile}`);
