// V: versiunea fișierelor, aceeași ca „?v=” din index.html (teste/versiune.test.mjs). Se mărește la fiecare publicare.
const V = 16;
const CACHE = 'beze-crm-v' + V;
const SHELL = ['./', './index.html', './app.js?v=' + V, './lead.js?v=' + V, './etape.js?v=' + V, './ghid.js?v=' + V, './icon-192.png', './icon-512.png'];

self.addEventListener('install', e => {
  e.waitUntil(caches.open(CACHE).then(c => c.addAll(SHELL)));
  self.skipWaiting();
});

self.addEventListener('activate', e => {
  e.waitUntil(
    caches.keys().then(keys => Promise.all(keys.filter(k => k !== CACHE).map(k => caches.delete(k))))
  );
  self.clients.claim();
});

// Network-first for navigation/app shell so you always get the latest version when online;
// falls back to cache only if you're offline.
// Fișierele CRM-ului (app.js, lead.js…) se cer cu „no-cache”: GitHub Pages le dă max-age=600, iar fără
// asta Safari folosea până la 10 minute versiunea veche după o publicare (23 Nov 2026).
// Navigarea rămâne fetch(e.request): un Request „navigate” nu se poate copia cu opțiuni noi.
self.addEventListener('fetch', e => {
  if (e.request.method !== 'GET') return;
  const local = new URL(e.request.url).origin === self.location.origin && e.request.mode !== 'navigate';
  e.respondWith(
    (local ? fetch(e.request.url, { cache: 'no-cache' }) : fetch(e.request)).then(res => {
      const copy = res.clone();
      caches.open(CACHE).then(c => c.put(e.request, copy)).catch(()=>{});
      return res;
    }).catch(() => caches.match(e.request))
  );
});
