(() => {
  "use strict";

  const DB_NAME = "uta-note-backups";
  const STORE = "snapshots";
  const MAX_SNAPSHOTS = 5;
  const MIN_INTERVAL_MS = 60 * 1000;

  let dbPromise = null;
  let lastSavedAt = 0;
  let pendingTimer = null;

  function openDb() {
    if (!dbPromise) {
      dbPromise = new Promise((resolve, reject) => {
        const request = indexedDB.open(DB_NAME, 1);
        request.onupgradeneeded = () => {
          const db = request.result;
          if (!db.objectStoreNames.contains(STORE)) {
            const store = db.createObjectStore(STORE, { keyPath: "id" });
            store.createIndex("createdAt", "createdAt", { unique: false });
          }
        };
        request.onsuccess = () => resolve(request.result);
        request.onerror = () => reject(request.error);
      });
    }
    return dbPromise;
  }

  function makeSnapshotId(date = new Date()) {
    return date.toISOString().replace(/[:.]/g, "-");
  }

  async function pruneSnapshots(db) {
    const tx = db.transaction(STORE, "readwrite");
    const store = tx.objectStore(STORE);
    const all = await new Promise((resolve, reject) => {
      const req = store.getAll();
      req.onsuccess = () => resolve(req.result || []);
      req.onerror = () => reject(req.error);
    });

    all.sort((a, b) => String(b.createdAt).localeCompare(String(a.createdAt)));
    const remove = all.slice(MAX_SNAPSHOTS);
    remove.forEach((item) => store.delete(item.id));
    await new Promise((resolve, reject) => {
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
    });
  }

  async function saveSnapshot(songs, settings) {
    if (!Array.isArray(songs)) return false;
    const now = Date.now();
    if (now - lastSavedAt < MIN_INTERVAL_MS) return false;

    try {
      const db = await openDb();
      const createdAt = new Date().toISOString();
      const snapshot = {
        id: makeSnapshotId(new Date(createdAt)),
        createdAt,
        songCount: songs.length,
        songs,
        settings: settings || null
      };

      await new Promise((resolve, reject) => {
        const tx = db.transaction(STORE, "readwrite");
        tx.objectStore(STORE).put(snapshot);
        tx.oncomplete = () => resolve();
        tx.onerror = () => reject(tx.error);
      });

      await pruneSnapshots(db);
      lastSavedAt = now;
      return true;
    } catch (error) {
      console.error("自動バックアップの保存に失敗:", error);
      return false;
    }
  }

  function scheduleSnapshot(songs, settings) {
    clearTimeout(pendingTimer);
    pendingTimer = setTimeout(() => {
      saveSnapshot(songs, settings);
    }, 1500);
  }

  async function listSnapshots() {
    try {
      const db = await openDb();
      const all = await new Promise((resolve, reject) => {
        const tx = db.transaction(STORE, "readonly");
        const req = tx.objectStore(STORE).getAll();
        req.onsuccess = () => resolve(req.result || []);
        req.onerror = () => reject(req.error);
      });
      return all.sort((a, b) => String(b.createdAt).localeCompare(String(a.createdAt)));
    } catch {
      return [];
    }
  }

  async function getLatestSnapshot() {
    const list = await listSnapshots();
    return list[0] || null;
  }

  async function getSnapshot(id) {
    try {
      const db = await openDb();
      return await new Promise((resolve, reject) => {
        const tx = db.transaction(STORE, "readonly");
        const req = tx.objectStore(STORE).get(id);
        req.onsuccess = () => resolve(req.result || null);
        req.onerror = () => reject(req.error);
      });
    } catch {
      return null;
    }
  }

  function formatSnapshotLabel(snapshot) {
    if (!snapshot) return "";
    const date = new Date(snapshot.createdAt);
    if (Number.isNaN(date.getTime())) return `${snapshot.songCount}曲`;
    const stamp = `${date.getFullYear()}/${date.getMonth() + 1}/${date.getDate()} ${String(date.getHours()).padStart(2, "0")}:${String(date.getMinutes()).padStart(2, "0")}`;
    return `${stamp}（${snapshot.songCount}曲）`;
  }

  window.UtaNoteAutoBackup = {
    saveSnapshot,
    scheduleSnapshot,
    listSnapshots,
    getLatestSnapshot,
    getSnapshot,
    formatSnapshotLabel,
    MAX_SNAPSHOTS
  };
})();
