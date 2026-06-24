#!/usr/bin/env node
/** Auto-classify unknown artists and merge into gender-hints-bulk.mjs */

import fs from "node:fs/promises";
import { resolveArtistGender } from "./artist-genders-core.mjs";
import { hasJapaneseScript, isKoreanOrChineseArtist, isTrueWesternArtist } from "./catalog-locale.mjs";

const extraFile = process.argv[2] || "karaoke-master-extra.js";
const code = await fs.readFile(extraFile, "utf8");
const match = code.match(/window\.UTA_NOTE_MASTER_EXTRA\s*=\s*(\[[\s\S]*\]);/);
if (!match) process.exit(1);

const songs = JSON.parse(match[1]);
const counts = new Map();
songs.forEach((song) => {
  if (resolveArtistGender(song.artist) !== "unknown") return;
  counts.set(song.artist, (counts.get(song.artist) || 0) + 1);
});

const MALE_PATTERNS = [
  /ジャニ|STARTO|KinKi|KAT-TUN|Sexy Zone|SixTONES|Snow Man|BE:FIRST|なにわ|timelesz|Travis Japan/i,
  /EXILE|三代目|GENERATIONS|THE RAMPAGE|FANTASTICS|BALLISTIK|PSYCHIC FEVER|BOYS/i,
  /少年|少女組|男闘|シブがき|光GENJI|チェッカーズ|男組|ズ$|BOYS$|WEST$/i,
  /Project|JAM |HEADS|COLLECTION|DRAGON|RAZOR|NiL|MADKID|HACKER|Horizon/i,
  /すとぷり|ストップ|ぺぽよ|もさを|Tani Yuuki|岩田剛典|五条哲也|楠木康平|吉武千颯|つかさ学/i,
  /酔シグレ|Shozo|NOISEMAKER|BiTE A SHOCK|CODE OF ZERO|RYKEY|Bring Me/i,
  /ENHYPEN|Stray Kids|TREASURE|SUPER JUNIOR|BOYS AND MEN/i
];

const FEMALE_PATTERNS = [
  /46$|坂46|ケ$|乃木坂|日向坂|櫻坂|モーニング娘|AKB|NMB|SKE|HKT|≠ME|=LOVE|でんぱ/i,
  /家入レオ|阿部真央|藍井エイル|香西かおり|川野夏美|夏木綾子|天童よしみ|平山花羽|朝花美穂/i,
  /星街すいせい|ホロライブ|にじさんじ|神楽|宝塚|香西|美穂|綾子|花羽|真央|エイル|かおり/i,
  /彩青|恋川|津吹みゆ|久永さとみ|松原のぶえ|天野涼|erica|家入|Leo/i,
  /TOMOO|Laura day|MYERA|サニーピース|Rin音|酔シグレ/i
];

const MIXED_PATTERNS = [
  /にじさんじ|ホロライブ|VTuber|宝塚|CV[.:：]|feat\.|&|×|✕/i,
  /ポケモン Kids|ぺぽよ|パンダドラゴン|POP ART TOWN/i
];

function guessGender(artist) {
  const raw = String(artist || "").trim();
  if (!raw) return null;
  if (isKoreanOrChineseArtist(raw)) return null;

  if (MIXED_PATTERNS.some((re) => re.test(raw))) return "mixed";
  if (FEMALE_PATTERNS.some((re) => re.test(raw))) return "female";
  if (MALE_PATTERNS.some((re) => re.test(raw))) return "male";

  if (isTrueWesternArtist(raw)) return "male";
  if (hasJapaneseScript(raw)) {
    if (/子$|美$|恵$|愛$|花$|香$|穂$|代$|江$|枝$|奈$|緒$|実$|菜$|音$|鈴$|優$|咲$|彩$|舞$|歩$|帆$|結$|莉$|樱$|桜$/.test(raw)) return "female";
    if (/郎$|男$|樹$|太$|也$|介$|彦$|雄$|司$|治$|武$|剛$|平$|宏$|浩$|健$|進$|学$|紀$|士$|蔵$|助$|之$|吉$|虎$|龍$|馬$/.test(raw)) return "male";
    if (/組$|隊$|ズ$|BOYS$|boys$|Project$|PROJECT$|BAND$|Band$/.test(raw)) return "male";
    if (/歌劇|劇団|宝塚/.test(raw)) return "mixed";
    return "male";
  }
  return null;
}

const bulkFemale = new Set();
const bulkMale = new Set();
const bulkMixed = new Set();

[...counts.entries()]
  .sort((a, b) => b[1] - a[1])
  .forEach(([artist, count]) => {
    const gender = guessGender(artist);
    if (!gender) return;
    if (count >= 1 || hasJapaneseScript(artist) || isTrueWesternArtist(artist)) {
      if (gender === "female") bulkFemale.add(artist);
      else if (gender === "male") bulkMale.add(artist);
      else bulkMixed.add(artist);
    }
  });

const manualFemale = [
  "家入レオ", "阿部真央", "藍井エイル", "香西かおり", "川野夏美", "夏木綾子", "天童よしみ",
  "平山花羽", "朝花美穂", "星街すいせい", "彩青", "恋川いろは", "津吹みゆ", "久永さとみ",
  "松原のぶえ", "天野涼", "erica",   "TOMOO", "MYERA", "サニーピース", "Rin音", "如月マロン(ジェラードン)"
];
const manualMale = [
  "すとぷり", "岩田剛典", "楠木康平", "つかさ学", "吉武千颯", "酔シグレ", "Shozo", "NiL",
  "RAZOR", "MADKID", "BiTE A SHOCK", "NOISEMAKER", "POP ART TOWN", "パンダドラゴン",
  "JAM HEADS", "ACE COLLECTION", "Neko Hacker", "Tani Yuuki", "森雄二とサザンクロス",
  "Bring Me The Horizon", "R.E.M.", "RYKEY DADDY DIRTY", "CODE OF ZERO", "callslow",
  "高木雄太", "すぎもとまさと", "SHOW-WA", "FRAME", "アルコサイト", "もさを。",
  "I'm a Cutie Finder", "Laura day romance", "みらくらぱーく!", "なみぐる", "ぺぽよ",
  "MIAMI SOUND MACHINE", "F-BLOOD", "ナムインス", "五条哲也"
];
const manualMixed = [
  "にじさんじ (緑仙)", "にじさんじ (レヴィ・エリファ)", "ポケモン Kids TV", "神楽こはく"
];

manualFemale.forEach((a) => bulkFemale.add(a));
manualMale.forEach((a) => bulkMale.add(a));
manualMixed.forEach((a) => bulkMixed.add(a));

const body = `/** Auto-generated gender hints — run: node tools/generate-gender-hints.mjs */

export const AUTO_FEMALE = ${JSON.stringify([...bulkFemale].sort(), null, 2)};

export const AUTO_MALE = ${JSON.stringify([...bulkMale].sort(), null, 2)};

export const AUTO_MIXED = ${JSON.stringify([...bulkMixed].sort(), null, 2)};
`;

await fs.writeFile("tools/gender-hints-auto.mjs", body, "utf8");
console.error(`auto hints: female ${bulkFemale.size}, male ${bulkMale.size}, mixed ${bulkMixed.size}`);
