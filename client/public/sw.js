self.addEventListener("install", (event) => {
  event.waitUntil(
    caches.open("htown-cache").then((cache) => cache.addAll(["/", "/manifest.webmanifest"]))
  );
});

self.addEventListener("fetch", (event) => {
  event.respondWith(
    caches.match(event.request).then((response) => response || fetch(event.request))
  );
});
