/* RevRule Console service worker.
 *
 * - Cache-first for same-origin static assets (app shell, JS/CSS, icons).
 * - Network-first for navigation requests, falling back to the cached shell.
 * - /v1/* API calls always go to the network and are never cached.
 */

const CACHE_VERSION = "revrule-console-v1";
const SHELL_CACHE = `${CACHE_VERSION}-shell`;
const ASSET_CACHE = `${CACHE_VERSION}-assets`;
const BASE = "/revrule-console";

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches
      .open(SHELL_CACHE)
      .then((cache) => cache.addAll([`${BASE}/`, `${BASE}/index.html`])),
  );
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) =>
        Promise.all(
          keys
            .filter((k) => k.startsWith("revrule-console-") && k !== SHELL_CACHE && k !== ASSET_CACHE)
            .map((k) => caches.delete(k)),
        ),
      )
      .then(() => self.clients.claim()),
  );
});

function isApiRequest(url) {
  return url.pathname.startsWith("/v1/");
}

self.addEventListener("fetch", (event) => {
  const { request } = event;
  if (request.method !== "GET") return;

  const url = new URL(request.url);

  // Never cache API traffic; always hit the network.
  if (isApiRequest(url)) {
    event.respondWith(fetch(request));
    return;
  }

  // Cross-origin: network only.
  if (url.origin !== self.location.origin) {
    return;
  }

  // Navigations: network-first, fall back to cached app shell (SPA routing).
  if (request.mode === "navigate") {
    event.respondWith(
      fetch(request).catch(() =>
        caches.match(`${BASE}/index.html`, { cacheName: SHELL_CACHE }),
      ),
    );
    return;
  }

  // Static assets: cache-first.
  event.respondWith(
    caches.match(request, { cacheName: ASSET_CACHE }).then((cached) => {
      if (cached) return cached;
      return fetch(request).then((response) => {
        if (response.ok) {
          const copy = response.clone();
          caches.open(ASSET_CACHE).then((cache) => cache.put(request, copy));
        }
        return response;
      });
    }),
  );
});
