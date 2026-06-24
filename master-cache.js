(() => {
  "use strict";

  const DB_NAME = "uta-note-master";
  const STORE = "meta";
  const EXTRA_KEY = "extra-v1";

  function openDb() {
    return new Promise((resolve, reject) => {
      const request = indexedDB.open(DB_NAME, 1);
      request.onupgradeneeded = () => {
        request.result.createObjectStore(STORE);
      };
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });
  }

  async function getCachedExtra(versionTag) {
    try {
      const db = await openDb();
      const key = `${EXTRA_KEY}:${versionTag}`;
      return new Promise((resolve, reject) => {
        const tx = db.transaction(STORE, "readonly");
        const req = tx.objectStore(STORE).get(key);
        req.onsuccess = () => resolve(req.result || null);
        req.onerror = () => reject(req.error);
      });
    } catch {
      return null;
    }
  }

  async function setCachedExtra(versionTag, songs) {
    try {
      const db = await openDb();
      const key = `${EXTRA_KEY}:${versionTag}`;
      return new Promise((resolve, reject) => {
        const tx = db.transaction(STORE, "readwrite");
        tx.objectStore(STORE).put(songs, key);
        tx.oncomplete = () => resolve(true);
        tx.onerror = () => reject(tx.error);
      });
    } catch {
      return false;
    }
  }

  window.UtaNoteMasterCache = {
    getCachedExtra,
    setCachedExtra
  };
})();
