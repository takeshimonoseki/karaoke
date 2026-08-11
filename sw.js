const SHELL_CACHE = "uta-note-shell-v52";
const MASTER_CACHE = "uta-note-master-v52";
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

const NETWORK_FIRST_PATHS = [
  "/",
  "/index.html",
  "/styles.css",
  "/app.js",
  "/version.js",
  "/sw.js",
  "/manifest.webmanifest"
];

function pathnameOf(request) {
  return new URL(request.url).pathname.replace(/\/$/, "") || "/";
}

function isAppShellRequest(request) {
  if (request.method !== "GET") return false;
  const url = new URL(request.url);
  if (url.origin !== self.location.origin) return false;
  return APP_FILES.some((path) => {
    const normalized = new URL(path, self.location.origin);
    return url.pathname === normalized.pathname || url.href === normalized.href;
  }) || /\.(html|js|css|webmanifest|png)$/i.test(url.pathname);
}

function isMasterFile(pathname) {
  return /karaoke-master-extra\.js$|karaoke-master-supplement\.js$/.test(pathname);
}

function isNetworkFirst(request) {
  const path = pathnameOf(request);
  const base = path.split("/").pop() || path;
  if (NETWORK_FIRST_PATHS.some((item) => path.endsWith(item) || `/${base}` === item)) return true;
  if (/\.(html|css)$/i.test(path)) return true;
  if (/(^|\/)(app|version|sw)\.js$/i.test(path)) return true;
  return false;
}

async function matchAnyCache(request) {
  for (const name of CACHE_NAMES) {
    const cache = await caches.open(name);
    const hit = await cache.match(request, { ignoreSearch: true });
    if (hit) return hit;
  }
  return caches.match(request, { ignoreSearch: true });
}

async function putInCache(request, response) {
  if (!response || !response.ok) return;
  const bucket = isMasterFile(new URL(request.url).pathname) ? MASTER_CACHE : SHELL_CACHE;
  const cache = await caches.open(bucket);
  await cache.put(request, response.clone());
}

async function networkFirst(request) {
  try {
    const response = await fetch(request);
    putInCache(request, response);
    return response;
  } catch {
    const cached = await matchAnyCache(request);
    return cached || matchAnyCache("./index.html");
  }
}

async function cacheFirst(request) {
  const cached = await matchAnyCache(request);
  if (cached) return cached;
  try {
    const response = await fetch(request);
    putInCache(request, response);
    return response;
  } catch {
    return matchAnyCache("./index.html");
  }
}

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches.open(SHELL_CACHE).then((cache) => cache.addAll(APP_FILES))
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

self.addEventListener("message", (event) => {
  if (event.data?.type === "CLEAR_CACHES") {
    event.waitUntil(
      caches.keys().then((keys) => Promise.all(keys.map((key) => caches.delete(key)))).then(() => {
        self.clients.matchAll({ type: "window" }).then((clients) => {
          clients.forEach((client) => client.postMessage({ type: "CACHES_CLEARED" }));
        });
      })
    );
  }
});

self.addEventListener("fetch", (event) => {
  if (event.request.method !== "GET") return;

  if (!isAppShellRequest(event.request)) {
    event.respondWith(fetch(event.request).catch(() => Response.error()));
    return;
  }

  if (isMasterFile(new URL(event.request.url).pathname)) {
    event.respondWith(cacheFirst(event.request));
    return;
  }

  if (isNetworkFirst(event.request)) {
    event.respondWith(networkFirst(event.request));
    return;
  }

  event.respondWith(cacheFirst(event.request));
});
