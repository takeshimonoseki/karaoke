(() => {
  "use strict";

  const L = window.UtaNoteLabels;
  const {
    STORAGE_KEY,
    STORAGE_KEY_V2,
    SETTINGS_KEY,
    RECOVERY_FLAG_KEY,
    IMPORT_MAX_SONGS
  } = L;

  function makeId() {
    if (crypto && crypto.randomUUID) return crypto.randomUUID();
    return `song-${Date.now()}-${Math.random().toString(16).slice(2)}`;
  }

  function normalizeSong(song, index = 0) {
    const singHistory = Array.isArray(song.singHistory)
      ? song.singHistory.filter(Boolean)
      : [];
    const singCount = Number.isFinite(Number(song.singCount))
      ? Number(song.singCount)
      : singHistory.length;

    return {
      id: song.id || makeId(),
      title: String(song.title || "").trim(),
      artist: String(song.artist || "").trim(),
      key: String(song.key || "").trim(),
      tag: String(song.tag || "").trim(),
      memo: String(song.memo || "").trim(),
      favorite: Boolean(song.favorite),
      canSing: song.canSing !== false,
      singCount,
      singHistory,
      order: Number.isFinite(Number(song.order)) ? Number(song.order) : index,
      createdAt: song.createdAt || new Date().toISOString(),
      updatedAt: song.updatedAt || new Date().toISOString()
    };
  }

  function normalizeInitialSongs() {
    if (!Array.isArray(window.INITIAL_SONGS)) return [];
    return window.INITIAL_SONGS.map((song, index) =>
      normalizeSong({
        title: song.title,
        artist: song.artist || "",
        canSing: true,
        order: index,
        createdAt: new Date(Date.now() - index * 1000).toISOString()
      }, index)
    );
  }

  function archiveCorruptData(raw, source = "v3") {
    if (!raw) return;
    const stamp = new Date().toISOString().replace(/[:.]/g, "-");
    try {
      localStorage.setItem(`uta-note-data-v3-corrupt-${stamp}`, raw);
      localStorage.setItem(`${RECOVERY_FLAG_KEY}-meta`, JSON.stringify({ source, at: new Date().toISOString() }));
      localStorage.setItem(RECOVERY_FLAG_KEY, "1");
    } catch (error) {
      console.error("破損データの退避に失敗:", error);
    }
  }

  function migrateFromV2(raw) {
    if (!Array.isArray(raw)) return null;
    return raw.map((song, index) => normalizeSong({ ...song, canSing: true }, index));
  }

  function loadSongs() {
    const storedV3 = localStorage.getItem(STORAGE_KEY);

    if (storedV3) {
      try {
        const parsed = JSON.parse(storedV3);
        if (Array.isArray(parsed)) {
          localStorage.removeItem(RECOVERY_FLAG_KEY);
          const normalized = parsed.map((song, index) => normalizeSong(song, index)).filter((song) => song.title);
          if (normalized.length) return normalized;
          const initial = normalizeInitialSongs();
          if (initial.length) safeSaveSongs(initial);
          return initial;
        }
        archiveCorruptData(storedV3, "v3-not-array");
      } catch (error) {
        console.error("曲データの読込に失敗:", error);
        archiveCorruptData(storedV3, "v3-parse");
      }
      return [];
    }

    const storedV2 = localStorage.getItem(STORAGE_KEY_V2);
    if (storedV2) {
      try {
        const migrated = migrateFromV2(JSON.parse(storedV2));
        if (migrated) {
          try {
            localStorage.setItem(STORAGE_KEY, JSON.stringify(migrated));
          } catch (error) {
            console.error("v2移行データの保存に失敗:", error);
          }
          return migrated;
        }
        archiveCorruptData(storedV2, "v2-not-array");
      } catch (error) {
        console.error("v2データの読込に失敗:", error);
        archiveCorruptData(storedV2, "v2-parse");
      }
      return [];
    }

    const initial = normalizeInitialSongs();
    if (initial.length) {
      safeSaveSongs(initial);
    }
    return initial;
  }

  function loadSettings() {
    try {
      return {
        sort: "manual",
        tab: "canSing",
        searchGender: "male",
        ...JSON.parse(localStorage.getItem(SETTINGS_KEY) || "{}")
      };
    } catch {
      return { sort: "manual", tab: "canSing", searchGender: "male" };
    }
  }

  function safeSaveSongs(songList) {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(songList));
      return true;
    } catch (error) {
      console.error("曲データの保存に失敗:", error);
      return false;
    }
  }

  function saveSettings(settings) {
    localStorage.setItem(SETTINGS_KEY, JSON.stringify(settings));
  }

  function buildBackupPayload(songList) {
    return {
      app: "歌ノート",
      version: 3,
      schema: "uta-note-v3",
      exportedAt: new Date().toISOString(),
      songs: songList
    };
  }

  function downloadBackupFile(payload, filename) {
    const blob = new Blob([JSON.stringify(payload, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = filename;
    document.body.append(link);
    link.click();
    link.remove();
    URL.revokeObjectURL(url);
  }

  function validateImportData(data) {
    const imported = Array.isArray(data) ? data : data?.songs;
    if (!Array.isArray(imported)) {
      throw new Error("曲データがありません");
    }
    if (imported.length > IMPORT_MAX_SONGS) {
      throw new Error(`曲数が多すぎます（上限 ${IMPORT_MAX_SONGS}曲）`);
    }
    const valid = imported.filter((song) => song && String(song.title || "").trim());
    if (!valid.length) {
      throw new Error("有効な曲が1件もありません");
    }
    if (data?.version && ![2, 3].includes(Number(data.version))) {
      console.warn("未対応のバックアップバージョン:", data.version);
    }
    return valid;
  }

  function needsRecovery() {
    return Boolean(localStorage.getItem(RECOVERY_FLAG_KEY));
  }

  function clearRecoveryFlag() {
    localStorage.removeItem(RECOVERY_FLAG_KEY);
  }

  window.UtaNoteStorage = {
    makeId,
    normalizeSong,
    normalizeInitialSongs,
    loadSongs,
    loadSettings,
    safeSaveSongs,
    saveSettings,
    buildBackupPayload,
    downloadBackupFile,
    validateImportData,
    needsRecovery,
    clearRecoveryFlag,
    RECOVERY_FLAG_KEY
  };
})();
