// Tjenestearbeider (service worker) for appen fysikkhjelp.no.
// - Sider og filer hentes alltid fra nettet først, så du får nyeste versjon. Er du uten nett, brukes det som sist ble lastet.
// - Bare filer fra fysikkhjelp.no lagres. Innlogging, svar og KI (Supabase og hint-tjeneren) går aldri via lageret.
// - Ingen personlige data lagres her; lageret inneholder bare offentlige sider, bilder og skript.
var LAGER = 'fh-v1';
var START = ['/offline.html', '/assets/img/app/ikon-192.png'];

self.addEventListener('install', function (e) {
  e.waitUntil(caches.open(LAGER).then(function (c) { return c.addAll(START); }).then(function () { return self.skipWaiting(); }));
});
self.addEventListener('activate', function (e) {
  e.waitUntil(caches.keys().then(function (l) { return Promise.all(l.filter(function (k) { return k !== LAGER; }).map(function (k) { return caches.delete(k); })); })
    .then(function () { return self.clients.claim(); }));
});
self.addEventListener('fetch', function (e) {
  var r = e.request, u = new URL(r.url);
  if (r.method !== 'GET' || u.origin !== location.origin) return;
  e.respondWith(fetch(r).then(function (svar) {
    if (svar.ok && svar.type === 'basic') { var kopi = svar.clone(); caches.open(LAGER).then(function (c) { c.put(r, kopi); }); }
    return svar;
  }).catch(function () {
    return caches.match(r).then(function (lagret) {
      if (lagret) return lagret;
      if (r.mode === 'navigate') return caches.match('/offline.html');
      return new Response('', { status: 504 });
    });
  }));
});
