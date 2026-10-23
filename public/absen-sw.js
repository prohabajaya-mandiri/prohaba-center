// Service worker web lapangan (/absen, /bbm): halaman dan aset disimpan di HP
// sehingga web tetap terbuka tanpa sinyal. Antrean catatan disimpan oleh halaman, bukan di sini.
// Satu berkas untuk setiap halaman; halaman dan cache-nya mengikuti scope pendaftaran.
const PAGE = new URL(self.registration.scope).pathname.replace(/\/$/, '');
const CACHE = PAGE.slice(1) + '-v1';

self.addEventListener('install', () => self.skipWaiting());
self.addEventListener('activate', (event) => event.waitUntil(self.clients.claim()));

self.addEventListener('fetch', (event) => {
  const request = event.request;
  const url = new URL(request.url);
  if (request.method !== 'GET' || url.origin !== self.location.origin) return;

  // Halaman: ambil terbaru bila online, pakai salinan terakhir bila offline.
  if (request.mode === 'navigate' && url.pathname === PAGE) {
    event.respondWith(
      fetch(request)
        .then((response) => {
          if (response.ok && !response.redirected) {
            const copy = response.clone();
            caches.open(CACHE).then((cache) => cache.put(PAGE, copy));
          }
          return response;
        })
        .catch(() => caches.open(CACHE).then((cache) => cache.match(PAGE)).then((hit) => hit || Response.error())),
    );
    return;
  }

  // Aset build berversi (nama berkas berubah tiap rilis): cukup disimpan sekali.
  if (/^\/(_next\/static|brand)\//.test(url.pathname) || url.pathname === '/icon.png') {
    event.respondWith(
      caches.open(CACHE).then((cache) => cache.match(request)).then(
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
