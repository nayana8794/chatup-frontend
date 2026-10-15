// chatup/frontend/public/sw.js
const CACHE_NAME = "chatup-v1";

// Cache core assets on install
self.addEventListener("install", (event) => {
    event.waitUntil(
        caches.open(CACHE_NAME).then((cache) => {
            return cache.addAll(["/", "/index.html", "/manifest.json"]);
        })
    );
    self.skipWaiting();
});

// Activate & clean old caches
self.addEventListener("activate", (event) => {
    event.waitUntil(
        caches.keys().then((keys) => {
            return Promise.all(
                keys.filter((key) => key !== CACHE_NAME).map((key) => caches.delete(key))
            );
        })
    );
    self.clients.claim();
});

// Network first, fallback to cache for offline capabilities
self.addEventListener("fetch", (event) => {
    // Only handle GET requests and skip websocket or API calls
    if (event.request.method !== "GET" || event.request.url.includes("/api/") || event.request.url.includes("/ws/")) {
        return;
    }
    event.respondWith(
        fetch(event.request).catch(() => caches.match(event.request))
    );
});