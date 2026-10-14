const CACHE_NAME = 'shopee-sales-v1';
const STATIC_ASSETS = [
  './',
  './index.html',
  './manifest.json',
  './icons/icon-192.png',
  './icons/icon-512.png',
  'https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2'
];

// Install: cache semua aset statis
self.addEventListener('install', event => {
  event.waitUntil(
    caches.open(CACHE_NAME).then(cache => {
      return cache.addAll(STATIC_ASSETS).catch(() => {
        // Lanjut meski CDN gagal saat install
        return cache.addAll(['./', './index.html', './manifest.json']);
      });
    }).then(() => self.skipWaiting())
  );
});

// Activate: hapus cache lama
self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys().then(keys =>
      Promise.all(keys.filter(k => k !== CACHE_NAME).map(k => caches.delete(k)))
    ).then(() => self.clients.claim())
  );
});

// Fetch: network-first untuk Supabase API, cache-first untuk aset statis
self.addEventListener('fetch', event => {
  const url = new URL(event.request.url);

  // Supabase API — selalu network, jangan cache
  if (url.hostname.includes('supabase.co')) {
    event.respondWith(
      fetch(event.request).catch(() =>
        new Response(JSON.stringify({ error: 'Offline: tidak bisa terhubung ke database' }), {
          status: 503,
          headers: { 'Content-Type': 'application/json' }
        })
      )
    );
    return;
  }

  // CDN (supabase-js) — cache-first
  if (url.hostname.includes('jsdelivr.net') || url.hostname.includes('cdn.')) {
    event.respondWith(
      caches.match(event.request).then(cached => {
        if (cached) return cached;
        return fetch(event.request).then(resp => {
          const clone = resp.clone();
          caches.open(CACHE_NAME).then(c => c.put(event.request, clone));
          return resp;
        });
      })
    );
    return;
  }

  // Aset lokal — cache-first, fallback network
  event.respondWith(
    caches.match(event.request).then(cached => {
      if (cached) return cached;
      return fetch(event.request).then(resp => {
        if (resp.ok) {
          const clone = resp.clone();
          caches.open(CACHE_NAME).then(c => c.put(event.request, clone));
        }
        return resp;
      }).catch(() => {
        // Fallback ke index.html untuk navigasi
        if (event.request.mode === 'navigate') {
          return caches.match('./index.html');
        }
      });
    })
  );
});
