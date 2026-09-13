const CACHE_NAME = 'evac-cache-v1';
const urlsToCache = [
  '/',
  '/index.html',
  '/manifest.json',
  '/static/style.css',
  '/static/leaflet.css',
  '/static/leaflet.js',
  '/static/app.js',
  '/static/app_icon.jpg',
  '/static/js/data.js',
  '/static/js/geojson_data.js',
  '/static/js/graph_builder.js',
  '/static/js/dstar_lite.js'
];

self.addEventListener('install', event => {
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then(cache => {
        return cache.addAll(urlsToCache);
      })
  );
});

self.addEventListener('fetch', event => {
  event.respondWith(
    caches.match(event.request)
      .then(response => {
        // Cache hit - return response
        if (response) {
          return response;
        }
        return fetch(event.request);
      })
  );
});
