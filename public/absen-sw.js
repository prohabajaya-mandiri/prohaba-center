// Service worker web absensi lapangan (/absen): halaman dan aset disimpan di HP
// sehingga web tetap terbuka tanpa sinyal. Antrean scan disimpan oleh halaman, bukan di sini.
const CACHE = 'absen-v1';

self.addEventListener('install', () => self.skipWaiting());
self.addEventListener('activate', (event) => event.waitUntil(self.clients.claim()));

self.addEventListener('fetch', (event) => {
  const request = event.request;
  const url = new URL(request.url);
  if (request.method !== 'GET' || url.origin !== self.location.origin) return;

  // Halaman: ambil terbaru bila online, pakai salinan terakhir bila offline.
  if (request.mode === 'navigate' && url.pathname === '/absen') {
    event.respondWith(
      fetch(request)
        .then((response) => {
          if (response.ok && !response.redirected) {
            const copy = response.clone();
            caches.open(CACHE).then((cache) => cache.put('/absen', copy));
          }
          return response;
        })
        .catch(() => caches.match('/absen').then((hit) => hit || Response.error())),
    );
    return;
  }

  // Aset build berversi (nama berkas berubah tiap rilis): cukup disimpan sekali.
  if (/^\/(_next\/static|brand)\//.test(url.pathname) || url.pathname === '/icon.png') {
    event.respondWith(
      caches.match(request).then(
        (hit) =>
          hit ||
          fetch(request).then((response) => {
            if (response.ok) {
              const copy = response.clone();
              caches.open(CACHE).then((cache) => cache.put(request, copy));
            }
            return response;
          }),
      ),
    );
  }
});
