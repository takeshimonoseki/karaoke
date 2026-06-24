const SHELL_CACHE = "uta-note-shell-v48";
const MASTER_CACHE = "uta-note-master-v48";
const CACHE_NAMES = [SHELL_CACHE, MASTER_CACHE];

const APP_FILES = [
  "./",
  "./index.html",
  "./styles.css",
  "./labels.js",
  "./storage.js",
  "./karaoke-rankings.js",
  "./artist-genders.js",
  "./master-cache.js",
  "./version.js",
  "./auto-backup.js",
  "./karaoke-master.js",
  "./karaoke-master-supplement.js",
  "./search-aliases.js",
  "./app.js",
  "./manifest.webmanifest",
  "./icons/icon-192.png",
  "./icons/icon-512.png"
];

const MASTER_FILES = [
  "./karaoke-master-extra.js",
  "./karaoke-master-supplement.js",
  "./artist-genders.js"
];

function isAppShellRequest(request) {
  if (request.method !== "GET") return false;
  const url = new URL(request.url);
  if (url.origin !== self.location.origin) return false;
  return APP_FILES.some((path) => {
    const normalized = new URL(path, self.location.origin);
    return url.pathname === normalized.pathname || url.href === normalized.href;
  }) || /\.(html|js|css|webmanifest|png)$/i.test(url.pathname);
}

async function matchAnyCache(request) {
  for (const name of CACHE_NAMES) {
    const cache = await caches.open(name);
    const hit = await cache.match(request);
    if (hit) return hit;
  }
  return caches.match(request);
}

self.addEventListener("install", (event) => {
  event.waitUntil(
    Promise.all([
      caches.open(SHELL_CACHE).then((cache) => cache.addAll(APP_FILES)),
      caches.open(MASTER_CACHE).then((cache) => cache.addAll(MASTER_FILES))
    ])
  );
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(keys.filter((key) => !CACHE_NAMES.includes(key)).map((key) => caches.delete(key)))
    )
  );
  self.clients.claim();
});

self.addEventListener("fetch", (event) => {
  if (event.request.method !== "GET") return;

  if (!isAppShellRequest(event.request)) {
    event.respondWith(fetch(event.request).catch(() => Response.error()));
    return;
  }

  event.respondWith(
    matchAnyCache(event.request).then((cached) => {
      if (cached) return cached;
      return fetch(event.request)
        .then((response) => {
          if (response && response.ok) {
            const copy = response.clone();
            const bucket = MASTER_FILES.some((path) => event.request.url.endsWith(path.replace("./", "")))
              ? MASTER_CACHE
              : SHELL_CACHE;
            caches.open(bucket).then((cache) => cache.put(event.request, copy));
          }
          return response;
        })
        .catch(() => matchAnyCache("./index.html"));
    })
  );
});
