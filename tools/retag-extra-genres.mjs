#!/usr/bin/env node
/** Re-tag anime/ballad genres on existing karaoke-master-extra.js */

import fs from "node:fs/promises";
import { shouldStripWesternGenre, hasJapaneseScript } from "./catalog-locale.mjs";

const file = process.argv[2] || "karaoke-master-extra.js";
const minify = process.argv.includes("--minify");

const ANIME_ARTIST_HINTS = [
  "影山ヒロノブ", "水木一郎", "きただにひろし", "Kitadani", "ゴダイゴ", "Godiego",
  "FIELD OF VIEW", "JAM Project", "串田アキラ", "山川豊", "ささきいさお", "大野雄二",
  "北谷洋", "林原めぐみ", "May'n", "fripSide", "ClariS", "LiSA", "Aimer", "ReoNa",
  "KOTOKO", "angela", "m.o.v.e", "SPYAIR", "MAN WITH A MISSION", "UVERworld", "BACK-ON",
  "緒方恵美", "稗田", "羊文学", "SixTONES", "ポケモン", "FANTASTICS", "浪川大輔",
  "じょるじん", "POP ART TOWN", "稲葉浩志", "B'z", "TM NETWORK", "藍井エイル"
];

const ANIME_TITLE_HINTS = [
  "テーゼ", "紅蓮華", "残響散歌", "KICK BACK", "ピースサイン", "廻廻奇譚", "アイドル",
  "新時代", "unravel", "God knows", "インフェルノ", "DAN DAN", "ドラえもん",
  "ONE PIECE", "千本桜", "Bling-Bang-Bang-Born", "銀河鉄道999", "宇宙戦艦ヤマト",
  "ルパン三世", "タッチ", "CHA-LA", "マジンガー", "ギャバン", "仮面ライダー",
  "We Are", "コネクト", "only my railgun", "crossing field", "青のすみか",
  "カワキヲアメク", "残酷な天使", "聖闘士", "セーラー", "ガンダム", "ポケモン",
  "主題歌", "戦隊", "ライダー", "仮面", "鉄人", "ロボ", "ヒーロ", "忍",
  "プリキュア", "キン肉", "ルパン", "ヤマト", "マクロス", "進撃", "鬼滅",
  "呪術", "推し", "チェンソ", "ヒロアカ", "名探偵", "コナン", "サザエ",
  "アンパン", "ポケット", "デジモ", "ゾイド", "ジブリ", "ワンピ", "ナルト",
  "ドラゴン", "アニメ", "キャラ", "防衛隊", "忍者", "ドクタケ", "どうよう"
];

const BALLAD_TITLE_HINTS = [
  "ドライフラワー", "水平線", "マリーゴールド", "Subtitle", "高嶺の花子さん",
  "奏", "香水", "花束", "瞳をとじて", "粉雪", "3月9日", "涙そうそう",
  "ハナミズキ", "糸", "未来予想図", "さよなら", "ベテルギウス", "カーテンコール",
  "ラブソング", "ラブ・ソング", "Love Song", "love song", "バラード", "Ballad",
  "叙情", "永遠", "思い出", "想い出", "別れ", "失恋", "運命", "Memories", "Story"
];

function normalizeText(value) {
  return String(value || "").normalize("NFKC").toLocaleLowerCase("ja").replace(/\s+/g, "");
}

function hasHint(value, hints) {
  const n = normalizeText(value);
  return hints.some((h) => n.includes(normalizeText(h)));
}

const code = await fs.readFile(file, "utf8");
const match = code.match(/window\.UTA_NOTE_MASTER_EXTRA\s*=\s*(\[[\s\S]*\]);/);
if (!match) process.exit(1);

const songs = JSON.parse(match[1]);
let animeTagged = 0;
let balladTagged = 0;
let westernFixed = 0;

songs.forEach((song) => {
  const genres = new Set(Array.isArray(song.genres) ? song.genres : ["jpop-rock"]);
  if (hasHint(song.title, ANIME_TITLE_HINTS) || hasHint(song.artist, ANIME_ARTIST_HINTS)) {
    if (!genres.has("anime")) animeTagged += 1;
    genres.add("anime");
  }
  if (hasHint(song.title, BALLAD_TITLE_HINTS)) {
    if (!genres.has("ballad")) balladTagged += 1;
    genres.add("ballad");
  }
  if (shouldStripWesternGenre(song)) {
    genres.delete("western");
    westernFixed += 1;
  }
  if (!genres.has("jpop-rock") && !genres.has("western")) genres.add("jpop-rock");
  song.genres = [...genres];
});

const body = minify
  ? `window.UTA_NOTE_MASTER_EXTRA=${JSON.stringify(songs)};\n`
  : `window.UTA_NOTE_MASTER_EXTRA = ${JSON.stringify(songs, null, 2)};\n`;

await fs.writeFile(file, body, "utf8");
console.error(`anime +${animeTagged}, ballad +${balladTagged}, western fixed ${westernFixed}, total ${songs.length}`);
