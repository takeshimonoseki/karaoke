#!/usr/bin/env node

import fs from "node:fs/promises";
import { resolveArtistGender } from "./artist-genders-core.mjs";
import { isKoreanOrChineseArtist, shouldStripWesternGenre } from "./catalog-locale.mjs";

const args = new Map();
for (let i = 2; i < process.argv.length; i += 1) {
  const arg = process.argv[i];
  if (!arg?.startsWith("--")) continue;
  const next = process.argv[i + 1];
  if (next && !next.startsWith("--")) {
    args.set(arg, next);
    i += 1;
  } else {
    args.set(arg, true);
  }
}

const fromYear = Number(args.get("--from") || 1990);
const toYear = Number(args.get("--to") || new Date().getFullYear());
const maxSongs = Number(args.get("--max") || 80000);
const fetchLimit = Number(args.get("--limit") || 500);
const yearSpan = Math.max(1, toYear - fromYear + 1);
const perYearMax = Number(args.get("--per-year") || Math.ceil(maxSongs / yearSpan));
const outFile = args.get("--out") || "karaoke-master-extra.js";
const minify = args.has("--minify");
const includeWestern = args.has("--include-western");
const months = ["01", "02", "03", "04", "05", "06", "07", "08", "09", "10", "11", "12"];

const ANIME_ARTIST_HINTS = [
  "影山ヒロノブ", "水木一郎", "きただにひろし", "Kitadani", "ゴダイゴ", "Godiego",
  "FIELD OF VIEW", "JAM Project", "串田アキラ", "山川豊", "ささきいさお", "大野雄二",
  "北谷洋", "林原めぐみ", "May'n", "fripSide", "ClariS", "LiSA", "Aimer", "ReoNa",
  "Eir Aoi", "TrySail", "KOTOKO", "angela", "m.o.v.e", "SPYAIR", "MAN WITH A MISSION",
  "UVERworld", "BACK-ON", "FLOW", "GENERATIONS", "Da-iCE", "藍井エイル", "fripSide"
];

const ANIME_TITLE_HINTS = [
  "テーゼ", "紅蓮華", "残響散歌", "KICK BACK", "ピースサイン", "廻廻奇譚",
  "アイドル", "新時代", "unravel", "God knows", "インフェルノ",
  "DAN DAN", "ドラえもん", "ONE PIECE", "千本桜", "Bling-Bang-Bang-Born", "オトノケ",
  "銀河鉄道999", "宇宙戦艦ヤマト", "ルパン三世", "タッチ", "CHA-LA", "マジンガー",
  "ギャバン", "仮面ライダー", "We Are", "コネクト", "only my railgun", "crossing field",
  "青のすみか", "カワキヲアメク", "残酷な天使", "聖闘士", "セーラー", "ガンダム",
  "ポケモン", "主題歌", "戦隊", "ライダー", "鉄人", "ロボ", "ヒーロ", "忍",
  "プリキュア", "キン肉", "マクロス", "進撃", "鬼滅", "呪術", "推し", "チェンソ",
  "ヒロアカ", "名探偵", "コナン", "サザエ", "ポケット", "デジモ", "ジブリ", "ワンピ",
  "ナルト", "ドラゴン", "アニメ", "キャラ", "挿入歌", "キャラソン", "OP", "ED"
];

const BALLAD_TITLE_HINTS = [
  "ドライフラワー", "水平線", "マリーゴールド", "Subtitle", "高嶺の花子さん",
  "奏", "香水", "花束", "瞳をとじて", "粉雪", "3月9日", "涙そうそう",
  "ハナミズキ", "糸", "未来予想図", "さよなら", "ベテルギウス", "ラブソング",
  "Love Song", "バラード", "Ballad", "叙情", "永遠", "思い出", "別れ", "失恋"
];

const JAPANESE_LATIN = [
  "Mrs.", "GREEN APPLE", "Official", "back number", "King Gnu", "Creepy Nuts",
  "CUTIE STREET", "ORANGE RANGE", "ONE OK ROCK", "RADWIMPS", "FIELD OF VIEW",
  "MAN WITH A MISSION", "UVERworld", "BE:FIRST", "Da-iCE", "Superfly", "GLAY", "B'z"
];

function normalizeText(value) {
  return String(value || "")
    .normalize("NFKC")
    .toLocaleLowerCase("ja")
    .replace(/\s+/g, "");
}

function hasHint(value, hints) {
  const normalized = normalizeText(value);
  return hints.some((hint) => normalized.includes(normalizeText(hint)));
}

function inferAgeGroups(year) {
  if (year >= 2020) return ["10s", "20s"];
  if (year >= 2010) return ["20s", "30s"];
  if (year >= 2000) return ["30s", "40s"];
  if (year >= 1990) return ["40s", "50s"];
  if (year >= 1980) return ["50s", "60s"];
  return ["60s"];
}

function isWesternArtist(artist) {
  const text = String(artist || "").trim();
  if (!text || /[ぁ-んァ-ン一-龯]/.test(text)) return false;
  const normalized = normalizeText(text);
  if (JAPANESE_LATIN.some((hint) => normalized.includes(normalizeText(hint)))) return false;
  if (/^[A-Z0-9&]{2,12}$/.test(text.replace(/\s/g, ""))) return false;
  return /^[A-Za-z0-9\s&'.,\-!?()]+$/.test(text) && /\s/.test(text);
}

function inferGenres(title, artist) {
  const genres = new Set();
  if (includeWestern && isWesternArtist(artist)) genres.add("western");
  if (hasHint(title, ANIME_TITLE_HINTS) || hasHint(artist, ANIME_ARTIST_HINTS)) genres.add("anime");
  if (hasHint(title, BALLAD_TITLE_HINTS)) genres.add("ballad");
  if (!genres.has("western")) genres.add("jpop-rock");
  return [...genres];
}

function cleanSong(row, year, score) {
  const title = String(row.title || "").trim();
  const artist = String(row.singer || row.artist || "").trim();
  if (!title || !artist) return null;
  if (isKoreanOrChineseArtist(artist)) return null;
  if (!includeWestern && isWesternArtist(artist) && !/[ぁ-んァ-ン一-龯]/.test(title)) return null;
  if (title.length > 65) return null;
  if (artist.length > 50) return null;
  if (/off vocal|instrumental|カラオケ音源|オルゴール|メドレー|Remix|リミックス|Live at |Cover Ver\./i.test(`${title} ${artist}`)) {
    return null;
  }
  if (/^(\(|\[|<).*(CV|cv|合唱|一同)/.test(title) && /CV[.:：]|（CV|一同|合唱/i.test(`${title} ${artist}`)) {
    return null;
  }

  const song = {
    title,
    artist,
    year,
    gender: resolveArtistGender(artist),
    genres: inferGenres(title, artist),
    ageGroups: inferAgeGroups(year),
    score: Math.max(10, Math.min(70, score)),
    animeTitle: ""
  };

  if (shouldStripWesternGenre(song)) {
    song.genres = song.genres.filter((g) => g !== "western");
    if (!song.genres.length) song.genres.push("jpop-rock");
  }

  return song;
}

async function fetchReleaseMonth(year, month) {
  const releaseMonth = `${year}${month}`;
  const services = ["joysound", "dam"];
  const rows = [];
  for (const service of services) {
    const url = `https://api.manana.kr/v2/karaoke/release/${releaseMonth}/${service}.json?limit=${fetchLimit}`;
    try {
      const response = await fetch(url);
      if (!response.ok) continue;
      const data = await response.json();
      const list = Array.isArray(data.data) ? data.data : [];
      rows.push(...list);
    } catch {
      /* ignore */
    }
  }
  return rows;
}

async function fetchMonthlyPopular() {
  const urls = [
    "https://api.manana.kr/karaoke/popular/joysound/monthly.json",
    "https://api.manana.kr/karaoke/popular/dam/monthly.json"
  ];
  const rows = [];
  for (const url of urls) {
    try {
      const response = await fetch(url);
      if (!response.ok) continue;
      const data = await response.json();
      const list = Array.isArray(data.data) ? data.data : Array.isArray(data) ? data : [];
      rows.push(...list);
    } catch {
      /* ignore */
    }
  }
  return rows;
}

async function main() {
  const seen = new Set();
  const songs = [];

  const monthly = await fetchMonthlyPopular();
  monthly.forEach((row, index) => {
    const year = row.year || new Date().getFullYear();
    const song = cleanSong(row, year, Math.max(50, 90 - index));
    if (!song) return;
    const key = `${normalizeText(song.title)}|${normalizeText(song.artist)}`;
    if (seen.has(key)) return;
    seen.add(key);
    songs.push(song);
  });
  console.error(`monthly popular: ${songs.length} songs`);

  for (let year = toYear; year >= fromYear && songs.length < maxSongs; year -= 1) {
    let yearCount = 0;
    for (const month of months) {
      if (songs.length >= maxSongs || yearCount >= perYearMax) break;
      const rows = await fetchReleaseMonth(year, month);
      rows.forEach((row, index) => {
        if (songs.length >= maxSongs || yearCount >= perYearMax) return;
        const song = cleanSong(row, year, Math.max(1, 100 - Math.min(index, 99)));
        if (!song) return;
        const key = `${normalizeText(song.title)}|${normalizeText(song.artist)}`;
        if (seen.has(key)) return;
        seen.add(key);
        songs.push(song);
        yearCount += 1;
      });
    }
    if (year % 5 === 0 || year >= toYear - 2) {
      console.error(`${year}: ${songs.length} songs (year +${yearCount})`);
    }
  }

  console.error(`per-year cap: ${perYearMax}, span: ${yearSpan}`);

  if (songs.length < maxSongs) {
    console.error(`fill pass from ${toYear}…`);
    for (let year = toYear; year >= fromYear && songs.length < maxSongs; year -= 1) {
      for (const month of months) {
        if (songs.length >= maxSongs) break;
        const rows = await fetchReleaseMonth(year, month);
        rows.forEach((row, index) => {
          if (songs.length >= maxSongs) return;
          const song = cleanSong(row, year, Math.max(1, 80 - Math.min(index, 79)));
          if (!song) return;
          const key = `${normalizeText(song.title)}|${normalizeText(song.artist)}`;
          if (seen.has(key)) return;
          seen.add(key);
          songs.push(song);
        });
      }
    }
    console.error(`after fill: ${songs.length} songs`);
  }

  const unknown = songs.filter((s) => s.gender === "unknown").length;
  console.error(`gender unknown: ${unknown}/${songs.length} (${(unknown / songs.length * 100).toFixed(1)}%)`);

  const body = minify
    ? `window.UTA_NOTE_MASTER_EXTRA=${JSON.stringify(songs)};\n`
    : `window.UTA_NOTE_MASTER_EXTRA = ${JSON.stringify(songs, null, 2)};\n`;
  await fs.writeFile(outFile, body, "utf8");
  console.error(`wrote ${songs.length} songs to ${outFile}`);
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
