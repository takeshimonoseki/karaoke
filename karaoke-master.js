(() => {
  "use strict";

  const AGE_GROUPS = {
    teens: "10s",
    twenties: "20s",
    thirties: "30s",
    forties: "40s",
    fifties: "50s",
    sixties: "60s"
  };

  const SOURCE_GENRES = ["total", "jpop", "rock", "pop", "ballad", "anime", "western"];
  const GENRE_MAP = {
    jpop: "jpop-rock",
    rock: "jpop-rock",
    pop: "jpop-rock",
    ballad: "ballad",
    anime: "anime",
    western: "western"
  };

  function normalizeText(value) {
    return String(value || "")
      .normalize("NFKC")
      .toLocaleLowerCase("ja")
      .replace(/\s+/g, "");
  }

  function songKey(song) {
    return `${normalizeText(song.title)}|${normalizeText(song.artist)}`;
  }

  function mapGenre(sourceGenre, song) {
    if (sourceGenre !== "total") return GENRE_MAP[sourceGenre] || "jpop-rock";
    if (song.animeShow) return "anime";
    return "jpop-rock";
  }

  function inferAgeGroupsFromYear(year, fallbackAgeId) {
    const y = Number(year);
    if (Number.isFinite(y)) {
      if (y >= 2020) return ["10s", "20s"];
      if (y >= 2010) return ["20s", "30s"];
      if (y >= 2000) return ["30s", "40s"];
      if (y >= 1990) return ["40s", "50s"];
      if (y >= 1980) return ["50s", "60s"];
      return ["60s"];
    }
    const fallback = AGE_GROUPS[fallbackAgeId];
    return fallback ? [fallback] : [];
  }

  function resolveGender(artist, explicit) {
    if (explicit === "male" || explicit === "female" || explicit === "mixed") return explicit;
    if (typeof window.resolveArtistGender === "function") {
      return window.resolveArtistGender(artist);
    }
    return "unknown";
  }

  function upsertSong(map, raw, ageId, sourceGenre, index) {
    if (!raw?.title || !raw?.artist) return;

    const key = songKey(raw);
    const curatedAge = AGE_GROUPS[ageId];
    const ageGroups = Array.isArray(raw.ageGroups) && raw.ageGroups.length
      ? [...raw.ageGroups]
      : [...inferAgeGroupsFromYear(raw.year, ageId)];
    if (curatedAge && !ageGroups.includes(curatedAge)) ageGroups.unshift(curatedAge);
    const genre = mapGenre(sourceGenre, raw);
    const current = map.get(key) || {
      title: raw.title,
      artist: raw.artist,
      year: raw.year || null,
      gender: resolveGender(raw.artist, raw.gender),
      genres: [],
      ageGroups: [],
      score: 1,
      animeTitle: raw.animeShow || ""
    };

    if (raw.year && !current.year) current.year = raw.year;
    if (raw.animeShow && !current.animeTitle) current.animeTitle = raw.animeShow;
    if (raw.gender && raw.gender !== "unknown") current.gender = raw.gender;
    else if (current.gender === "unknown") current.gender = resolveGender(raw.artist, raw.gender);
    ageGroups.forEach((ageGroup) => {
      if (ageGroup && !current.ageGroups.includes(ageGroup)) current.ageGroups.push(ageGroup);
    });
    if (genre && !current.genres.includes(genre)) current.genres.push(genre);

    const sourceBoost = sourceGenre === "total" ? 8 : 0;
    current.score = Math.max(current.score, Math.max(1, 100 - index + sourceBoost));
    map.set(key, current);
  }

  function buildFromCurated() {
    const map = new Map();
    if (typeof window.getCuratedKaraokeRanking === "function") {
      Object.keys(AGE_GROUPS).forEach((ageId) => {
        SOURCE_GENRES.forEach((sourceGenre) => {
          const rows = window.getCuratedKaraokeRanking(ageId, sourceGenre) || [];
          rows.forEach((row, index) => upsertSong(map, row, ageId, sourceGenre, index));
        });
      });
    }

    if (Array.isArray(window.INITIAL_SONGS)) {
      window.INITIAL_SONGS.forEach((song, index) => {
        upsertSong(map, { ...song, year: null }, "forties", "total", index + 20);
      });
    }

    [
      ...(Array.isArray(window.UTA_NOTE_MASTER_EXTRA) ? window.UTA_NOTE_MASTER_EXTRA : []),
      ...(Array.isArray(window.UTA_NOTE_MASTER_SUPPLEMENT) ? window.UTA_NOTE_MASTER_SUPPLEMENT : [])
    ].forEach((song, index) => {
        const key = songKey(song);
        if (!song.title || !song.artist) return;
        const current = map.get(key) || {
          title: song.title,
          artist: song.artist,
          year: song.year || null,
          gender: resolveGender(song.artist, song.gender),
          genres: [],
          ageGroups: [],
          score: 1,
          animeTitle: song.animeTitle || ""
        };
        (Array.isArray(song.genres) ? song.genres : ["jpop-rock"]).forEach((genre) => {
          if (!current.genres.includes(genre)) current.genres.push(genre);
        });
        (Array.isArray(song.ageGroups) ? song.ageGroups : inferAgeGroupsFromYear(song.year, "forties")).forEach((ageGroup) => {
          if (!current.ageGroups.includes(ageGroup)) current.ageGroups.push(ageGroup);
        });
        const resolvedGender = resolveGender(song.artist, song.gender);
        if (resolvedGender !== "unknown") current.gender = resolvedGender;
        else if (song.gender && song.gender !== "unknown") current.gender = song.gender;
        if (song.animeTitle) current.animeTitle = song.animeTitle;
        const rawScore = Number(song.score) || Math.max(1, 100 - index);
        current.score = Math.max(current.score, Math.min(rawScore, 102));
        map.set(key, current);
      });

    for (const song of map.values()) {
      if (song.gender === "unknown") {
        const resolved = resolveGender(song.artist, song.gender);
        if (resolved !== "unknown") song.gender = resolved;
      }
    }

    return [...map.values()].sort((a, b) =>
      b.score - a.score ||
      normalizeText(a.title).localeCompare(normalizeText(b.title), "ja")
    );
  }

  let master = buildFromCurated();
  let searchHaystack = master.map((song) =>
    `${normalizeText(song.title)} ${normalizeText(song.artist)} ${normalizeText(song.animeTitle || "")}`
  );

  function matchesGenre(song, genreId) {
    if (genreId === "total") return true;
    if (genreId === "jpop-rock" || genreId === "jpop" || genreId === "rock" || genreId === "pop") {
      return song.genres.includes("jpop-rock");
    }
    return song.genres.includes(genreId);
  }

  function matchesAge(song, ageId) {
    const ageGroup = AGE_GROUPS[ageId];
    return !ageGroup || song.ageGroups.includes(ageGroup);
  }

  function matchesGender(song, gender) {
    if (gender !== "male" && gender !== "female") return true;
    if (song.gender === "mixed") return true;
    if (song.gender === "male" || song.gender === "female") return song.gender === gender;
    return false;
  }

  function toRankingSong(song) {
    return {
      title: song.title,
      artist: song.artist,
      year: song.year,
      gender: song.gender,
      genres: song.genres,
      curatedGenre: song.genres[0] || "jpop-rock",
      animeShow: song.animeTitle || "",
      popularity: song.score,
      source: "master"
    };
  }

  function getRanking({ ageId, genreId = "total", gender = "male", limit = 100 } = {}) {
    return master
      .filter((song) => matchesAge(song, ageId))
      .filter((song) => matchesGenre(song, genreId))
      .filter((song) => matchesGender(song, gender))
      .sort((a, b) => b.score - a.score)
      .slice(0, limit)
      .map(toRankingSong);
  }

  function search(query, limit = 100) {
    const q = normalizeText(query);
    if (!q) return [];
    const terms = q.split(/\s+/).filter(Boolean);
    if (terms.length === 0) return [];
    const hits = [];
    for (let i = 0; i < master.length; i += 1) {
      if (!terms.every((term) => searchHaystack[i].includes(term))) continue;
      hits.push(master[i]);
    }
    return hits
      .sort((a, b) => b.score - a.score)
      .slice(0, limit)
      .map(toRankingSong);
  }

  function searchByArtist(artist, limit = 500) {
    const raw = String(artist || "").trim();
    if (!raw) return [];
    const key = normalizeText(raw);
    return master
      .filter((song) => {
        const a = normalizeText(song.artist);
        return a === key || a.includes(key) || key.includes(a);
      })
      .sort((a, b) => b.score - a.score || normalizeText(a.title).localeCompare(normalizeText(b.title), "ja"))
      .slice(0, limit)
      .map(toRankingSong);
  }

  function rebuild() {
    master = buildFromCurated();
    searchHaystack = master.map((song) =>
      `${normalizeText(song.title)} ${normalizeText(song.artist)} ${normalizeText(song.animeTitle || "")}`
    );
    window.UtaNoteKaraokeMaster.count = master.length;
  }

  window.UtaNoteKaraokeMaster = {
    version: 1,
    count: master.length,
    getAll: () => master.map((song) => ({ ...song, genres: [...song.genres], ageGroups: [...song.ageGroups] })),
    getRanking,
    search,
    searchByArtist,
    rebuild
  };
})();
