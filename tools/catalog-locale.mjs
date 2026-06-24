/** Shared locale / western detection for build tools */

const JAPANESE_LATIN_HINTS = [
  "Mrs.", "GREEN APPLE", "Official", "back number", "King Gnu", "Creepy Nuts",
  "CUTIE STREET", "Saucy Dog", "Omoinotake", "Number_i", "BE:FIRST", "Da-iCE",
  "ORANGE RANGE", "ONE OK ROCK", "MAN WITH A MISSION", "UVERworld", "RADWIMPS",
  "FIELD OF VIEW", "WhiteFlame", "Superfly", "GLAY", "L'Arc", "B'z", "TM NETWORK",
  "GENERATIONS", "FANTASTICS", "SKYHI", "INI", "Snow Man", "SixTONES", "Travis Japan",
  "timelesz", "FRUITS ZIPPER", "NiziU", "MISIA", "AI", "SKY-HI", "SKYHI", "Kanaria",
  "DECO", "ROSE", "DISH", "WEST.", "WEST", "BOYS AND MEN", "SUPER JUNIOR"
];

export function normalizeText(value) {
  return String(value || "")
    .normalize("NFKC")
    .toLocaleLowerCase("ja")
    .replace(/\s+/g, "");
}

export function hasJapaneseScript(value) {
  return /[ぁ-んァ-ン一-龯]/.test(String(value || ""));
}

export function isKoreanOrChineseArtist(artist) {
  const text = String(artist || "");
  if (/[\uAC00-\uD7AF\u1100-\u11FF]/.test(text)) return true;
  if (/[\u4e00-\u9fff]/.test(text) && !/[ぁ-んァ-ン]/.test(text)) return true;
  return false;
}

export function isJapaneseLatinArtist(artist) {
  const text = String(artist || "").trim();
  if (!text || hasJapaneseScript(text)) return true;
  const normalized = normalizeText(text);
  return JAPANESE_LATIN_HINTS.some((hint) => normalized.includes(normalizeText(hint)));
}

export function isTrueWesternArtist(artist) {
  const text = String(artist || "").trim();
  if (!text || hasJapaneseScript(text)) return false;
  if (isJapaneseLatinArtist(text)) return false;
  if (/^[A-Z0-9&]{2,10}$/.test(text.replace(/\s/g, ""))) return false;
  return /^[A-Za-z0-9\s&'.,\-!?()]+$/.test(text) && /\s/.test(text);
}

export function shouldStripWesternGenre(song) {
  if (!Array.isArray(song.genres) || !song.genres.includes("western")) return false;
  const artist = String(song.artist || "");
  const title = String(song.title || "");
  if (hasJapaneseScript(artist)) return true;
  if (isJapaneseLatinArtist(artist)) return true;
  if (hasJapaneseScript(title) && !isTrueWesternArtist(artist)) return true;
  return false;
}
