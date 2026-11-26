// Service worker: tiene in memoria i file dell'app per aprirla subito.
// Cambia VERSIONE a ogni aggiornamento dell'app.
const VERSIONE = 'pigiama-v18';
const FILE = [
  './', './index.html', './app.js', './config.js', './vendor/supabase.js', './vendor/qrcode.js', './tv.html', './tv.js', './omini.js', './cielo.js', './viso.js',
  './manifest.webmanifest', './icons/icon-192.png', './icons/icon-512.png', './icons/apple-touch-icon.png'
];

self.addEventListener('install', e => {
  e.waitUntil(caches.open(VERSIONE).then(c => c.addAll(FILE)).then(() => self.skipWaiting()));
});

self.addEventListener('activate', e => {
  e.waitUntil(
    caches.keys()
      .then(keys => Promise.all(keys.filter(k => k !== VERSIONE).map(k => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

// Prima la rete (così gli aggiornamenti arrivano subito), poi la copia salvata.
self.addEventListener('fetch', e => {
  const url = new URL(e.request.url);
  if (e.request.method !== 'GET' || url.origin !== location.origin) return;
  e.respondWith(
    fetch(e.request.url, { cache: 'no-cache' })   // chiede sempre al server se c'è una versione nuova
      .then(r => {
        const copia = r.clone();
        caches.open(VERSIONE).then(c => c.put(e.request, copia));
        return r;
      })
      .catch(() => caches.match(e.request).then(r => r || caches.match('./index.html')))
  );
});
