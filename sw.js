// Service Worker pour Prout'VS
const CACHE_NAME = 'proutvs-v1';
const URLS_A_CACHER = [
  'index.html',
  'style.css',
  'game.js?ts=6',
  'manifest.json',
  'images/icon-192.svg',
  'images/icon-512.svg',
  'images/character_idle.png',
  'images/character_prepare.png',
  'images/character_basic_fart.png',
  'images/character_after_fart.png',
  'images/character_skill_medium.png',
  'images/character_skill_super.png',
  'images/character_skill_mega.png',
  'images/fond.png',
  'images/titre.png',
];

// Installation : mise en cache
self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      return cache.addAll(URLS_A_CACHER);
    })
  );
  self.skipWaiting();
});

// Activation : nettoyage anciens caches
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) => {
      return Promise.all(
        keys.filter((key) => key !== CACHE_NAME).map((key) => caches.delete(key))
      );
    })
  );
  self.clients.claim();
});

// Interception des requêtes
self.addEventListener('fetch', (event) => {
  event.respondWith(
    caches.match(event.request).then((response) => {
      return response || fetch(event.request);
    })
  );
});
