const prefix = 'spain-deck:' + self.registration.scope + ':';
const version = prefix + '5';
const shell = ['./','./index.html','./deck.css','./deck.js','./tasks.js','./spain3d.js','./three.core.min.js','./three.module.min.js','./manifest.webmanifest','./icons/icon-192.png','./icons/icon-512.png'];
const paths = new Set(shell.map(path => new URL(path,self.registration.scope).href));
self.addEventListener('install',event => {
  event.waitUntil(caches.open(version).then(cache => cache.addAll(shell.map(path => new Request(path, {cache:"reload"})))).then(() => self.skipWaiting()));
});
self.addEventListener('activate',event => {
  event.waitUntil(caches.keys().then(keys => Promise.all(keys.filter(k => k.startsWith(prefix) && k !== version).map(k => caches.delete(k)))).then(() => self.clients.claim()));
});
self.addEventListener('fetch',event => {
  if (event.request.method !== 'GET' || !paths.has(event.request.url)) return;
  event.respondWith(caches.open(version).then(async cache => (await cache.match(event.request)) || fetch(event.request)));
});
