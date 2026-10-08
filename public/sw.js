// public/sw.js — Service Worker Minimal Patungan
// Kebijakan: Zero Financial Data Caching (Tidak ada data grup/transaksi dalam cache)

const CACHE_NAME = "patungan-static-v1";
const STATIC_ASSETS = [
  "/offline.html",
  "/favicon.ico",
  "/icon-192.png",
  "/icon-512.png",
  "/apple-touch-icon.png",
  "/icon.svg",
];

// Install: Simpan aset statis dasar dan offline fallback
self.addEventListener("install", (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      return cache.addAll(STATIC_ASSETS);
    }).then(() => self.skipWaiting())
  );
});

// Activate: Bersihkan cache versi lama
self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys().then((keys) => {
      return Promise.all(
        keys
          .filter((key) => key !== CACHE_NAME)
          .map((key) => caches.delete(key))
      );
    }).then(() => self.clients.claim())
  );
});

// Fetch: Tangani permintaan
self.addEventListener("fetch", (event) => {
  const { request } = event;
  const url = new URL(request.url);

  // Hanya tangani permintaan GET pada origin yang sama
  if (request.method !== "GET" || url.origin !== self.location.origin) {
    return;
  }

  // 1. Data Keuangan & Rute Dinamis (/groups/*, /api/*, /s/*, /join/*)
  // DILARANG KERAS DISIMPAN DI CACHE (Zero Financial Data Caching)
  const isDynamicRoute =
    url.pathname.startsWith("/groups") ||
    url.pathname.startsWith("/api") ||
    url.pathname.startsWith("/s/") ||
    url.pathname.startsWith("/join/") ||
    url.pathname.startsWith("/settings");

  if (isDynamicRoute) {
    event.respondWith(
      fetch(request).catch(() => {
        // Jika offline saat navigasi halaman, tampilkan offline.html
        if (request.mode === "navigate") {
          return caches.match("/offline.html");
        }
        return new Response("Network error", { status: 503, statusText: "Service Unavailable" });
      })
    );
    return;
  }

  // 2. Aset Statis Next.js (/_next/static/*) & Gambar Publik
  if (url.pathname.startsWith("/_next/static/") || STATIC_ASSETS.includes(url.pathname)) {
    event.respondWith(
      caches.match(request).then((cachedResponse) => {
        if (cachedResponse) {
          // Stale-while-revalidate untuk aset statis
          fetch(request)
            .then((networkResponse) => {
              if (networkResponse && networkResponse.status === 200) {
                caches.open(CACHE_NAME).then((cache) => cache.put(request, networkResponse));
              }
            })
            .catch(() => {});
          return cachedResponse;
        }

        return fetch(request).then((networkResponse) => {
          if (networkResponse && networkResponse.status === 200) {
            const responseClone = networkResponse.clone();
            caches.open(CACHE_NAME).then((cache) => cache.put(request, responseClone));
          }
          return networkResponse;
        });
      })
    );
    return;
  }

  // 3. Navigasi halaman umum lainnya (fallback ke offline.html jika mati koneksi)
  if (request.mode === "navigate") {
    event.respondWith(
      fetch(request).catch(() => {
        return caches.match("/offline.html");
      })
    );
  }
});
