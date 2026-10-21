/* Works offline: tries the network first (so updates arrive), falls back to the saved copy. */
var CACHE = 'rajendra-quote-v4';
var FILES = ['./', 'index.html', 'auth-config.js', 'auth.js', 'manifest.webmanifest', 'apple-touch-icon.png', 'icon-192.png', 'icon-512.png'];
self.addEventListener('install', function (e) {
  e.waitUntil(caches.open(CACHE).then(function (c) { return c.addAll(FILES); }).then(function () { return self.skipWaiting(); }));
});
self.addEventListener('activate', function (e) {
  e.waitUntil(caches.keys().then(function (keys) {
    return Promise.all(keys.filter(function (k) { return k !== CACHE; }).map(function (k) { return caches.delete(k); }));
  }).then(function () { return self.clients.claim(); }));
});
self.addEventListener('fetch', function (e) {
  if (e.request.method !== 'GET' || e.request.url.indexOf(self.location.origin) !== 0) return;
  e.respondWith(new Promise(function (resolve) {
    var done = false;
    function fromCache() { return caches.match(e.request, { ignoreSearch: true }); }
    var timer = setTimeout(function () { fromCache().then(function (hit) { if (hit && !done) { done = true; resolve(hit); } }); }, 3000);
    fetch(e.request).then(function (res) {
      clearTimeout(timer);
      if (res && res.ok) { var copy = res.clone(); caches.open(CACHE).then(function (c) { c.put(e.request, copy); }); }
      if (!done) { done = true; resolve(res); }
    }).catch(function () {
      clearTimeout(timer);
      fromCache().then(function (hit) { if (!done) { done = true; resolve(hit || Response.error()); } });
    });
  }));
});
