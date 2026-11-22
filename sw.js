// The inventory is generated from the static files, including every guide photo.
importScripts('./precache.js');

const scope = self.registration.scope;
const prefix = 'melbourne-field-guide:' + scope + ':';
const version = prefix + self.PRECACHE.revision;
const assets = new Set(self.PRECACHE.files.map(path => new URL(path, scope).href));
const entry = new URL('./index.html', scope).href;

self.addEventListener('install', event => {
  event.waitUntil((async () => {
    if (!assets.has(entry)) throw new Error('The offline inventory is missing index.html');
    const cache = await caches.open(version);
    await cache.addAll([...assets].map(url => new Request(url, { cache: 'reload' })));
    await self.skipWaiting();
  })());
});

self.addEventListener('activate', event => {
  event.waitUntil((async () => {
    for (const key of await caches.keys()) {
      if (key.startsWith(prefix) && key !== version) await caches.delete(key);
    }
    await self.clients.claim();
  })());
});

self.addEventListener('fetch', event => {
  const request = event.request;
  if (request.method !== 'GET') return;
  const url = new URL(request.url);
  if (!url.href.startsWith(scope)) return;
  // The HTML and its modules are served as one version, including when offline.
  const isHome = request.mode === 'navigate' &&
    (url.pathname === new URL(scope).pathname || url.pathname === new URL(entry).pathname);
  url.search = '';
  const key = isHome ? entry : url.href;
  if (!assets.has(key)) return;
  event.respondWith((async () => {
    const cached = await (await caches.open(version)).match(key);
    return cached || fetch(request);
  })());
});
