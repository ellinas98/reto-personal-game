/* sw.js — Update-freundlich für GitHub Pages
   - Navigations (index.html) = NETWORK FIRST (wenn online, immer frisch)
   - Assets = stale-while-revalidate
   - Kein manuelles Cache-Version-Bumping nötig
*/

const CACHE_NAME = "reto-game-cache";
const CORE_ASSETS = [
  "./",
  "./index.html",
  "./manifest.webmanifest"
  // optional später:
  // "./icon-192.png",
  // "./icon-512.png"
];

self.addEventListener("install", (event) => {
  event.waitUntil((async () => {
    const cache = await caches.open(CACHE_NAME);

    // "reload" um Browser-HTTP-Cache zu umgehen
    await Promise.all(
      CORE_ASSETS.map((url) => cache.add(new Request(url, { cache: "reload" })))
    );

    self.skipWaiting();
  })());
});

self.addEventListener("activate", (event) => {
  event.waitUntil((async () => {
    // Lösche alte Caches, die nicht unser Cache sind
    const keys = await caches.keys();
    await Promise.all(keys.map((k) => (k === CACHE_NAME ? null : caches.delete(k))));
    self.clients.claim();
  })());
});

// Helper: Network-first mit Timeout (für Navigation)
async function networkFirst(request, timeoutMs = 2500) {
  const cache = await caches.open(CACHE_NAME);

  const timeout = new Promise((_, reject) =>
    setTimeout(() => reject(new Error("timeout")), timeoutMs)
  );

  try {
    const response = await Promise.race([fetch(request), timeout]);
    if (response && response.ok) {
      cache.put(request, response.clone());
    }
    return response;
  } catch (e) {
    const cached = await cache.match(request, { ignoreSearch: true });
    if (cached) return cached;
    throw e;
  }
}

// Helper: Stale-while-revalidate (für Assets)
async function staleWhileRevalidate(request) {
  const cache = await caches.open(CACHE_NAME);
  const cached = await cache.match(request, { ignoreSearch: true });

  const fetchPromise = fetch(request)
    .then((response) => {
      if (response && response.ok) cache.put(request, response.clone());
      return response;
    })
    .catch(() => null);

  return cached || (await fetchPromise) || cached;
}

self.addEventListener("fetch", (event) => {
  const req = event.request;

  // Nur GET cachen
  if (req.method !== "GET") return;

  // Navigation (Seite laden) -> NETWORK FIRST
  if (req.mode === "navigate" || (req.headers.get("accept") || "").includes("text/html")) {
    event.respondWith(networkFirst(req));
    return;
  }

  // Alles andere -> stale-while-revalidate
  event.respondWith(staleWhileRevalidate(req));
});

// Optional: SKIP_WAITING Trigger vom Client
self.addEventListener("message", (event) => {
  if (event.data && event.data.type === "SKIP_WAITING") {
    self.skipWaiting();
  }
});
