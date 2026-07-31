// public/sw.js
// PWA'nın kurulabilir olması için gereken temel service worker - offline
// asset önbellekleme yapmıyor, sadece kurulabilirliği sağlıyor.

self.addEventListener("install", () => {
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(self.clients.claim());
});
