const CACHE_NAME = "solvers-notebook-v11";
const ASSETS = [
  "./",
  "./index.html",
  "./reset.html",
  "./styles.css",
  "./app.js",
  "./sudoku-engine.js",
  "./variant-solver.js",
  "./puzzles.js",
  "./puzzles-ctc.js",
  "./manifest.json",
  "./icons/icon-192.png",
  "./icons/icon-512.png",
  "./icons/icon-maskable-192.png",
  "./icons/icon-maskable-512.png",
];

// Each asset is cached on its own: addAll rejects the whole install if any
// single request fails, which would leave an older worker (and its older
// files) in charge indefinitely. Failing to pre-cache one file only costs
// offline access to it, since fetches go to the network first anyway.
self.addEventListener("install", (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then((cache) => Promise.all(ASSETS.map((asset) => cache.add(asset).catch(() => null))))
      .then(() => self.skipWaiting())
  );
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(keys.filter((k) => k !== CACHE_NAME).map((k) => caches.delete(k)))
    ).then(() => self.clients.claim())
  );
});

// Network-first, falling back to cache only when offline. Cache-first was
// the reason changes kept not showing up: once a version was cached, nothing
// ever asked the network again unless service-worker.js's own bytes changed
// (which only happens when CACHE_NAME is bumped) — every ordinary content
// update after that point was invisible until someone remembered to bump
// it. This way the live site is always what's actually served, and the
// cache is just an offline fallback.
self.addEventListener("fetch", (event) => {
  if (event.request.method !== "GET") return;
  // version.json is how the app decides whether it is running stale files,
  // so it must never come from this cache: a cached copy could report an
  // old build to a new app and send it into a pointless refresh. Letting
  // the request go straight to the browser keeps it honest.
  if (new URL(event.request.url).pathname.endsWith("/version.json")) return;
  event.respondWith(
    fetch(event.request)
      .then((response) => {
        const copy = response.clone();
        caches.open(CACHE_NAME).then((cache) => cache.put(event.request, copy));
        return response;
      })
      // Offline. The page asks for assets with a ?v= build stamp, which no
      // pre-cached entry will match exactly, so ignore the query when
      // falling back -- the bytes are the same file either way.
      .catch(() => caches.match(event.request, { ignoreSearch: true }))
  );
});
