// Basic Service Worker for PWABuilder compliance
self.addEventListener('install', (event) => {
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(clients.claim());
});

self.addEventListener('fetch', (event) => {
  // Pass all network requests straight through to your live server
  event.respondWith(fetch(event.request));
});
