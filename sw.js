var CACHE_NAME = 'sewing-v8';
var URLS_TO_CACHE = [
  './',
  './index.html',
  './manifest.json',
  './css/styles.css',
  './js/core.js',
  './js/fabric-controller.js',
  './js/product-controller.js',
  './js/todo-controller.js',
  './js/dashboard-controller.js',
  './js/print-controller.js',
  './js/option-manager-controller.js',
  './js/data-controller.js',
  './js/pattern-controller.js',
  './js/notion-controller.js',
  './js/page-filter.js',
  './js/home-controller.js',
  './js/community-controller.js',
  './js/main.js',
  './js/supabase-config.js',
  './js/auth.js',
  './js/auth-ui.js',
  './js/data-layer.js'
];

self.addEventListener('install', function(event) {
  event.waitUntil(
    caches.open(CACHE_NAME).then(function(cache) {
      return cache.addAll(URLS_TO_CACHE);
    })
  );
  self.skipWaiting();
});

self.addEventListener('activate', function(event) {
  event.waitUntil(
    caches.keys().then(function(names) {
      return Promise.all(
        names.filter(function(name) { return name !== CACHE_NAME; })
             .map(function(name) { return caches.delete(name); })
      );
    })
  );
  self.clients.claim();
});

self.addEventListener('fetch', function(event) {
  event.respondWith(
    fetch(event.request).then(function(response) {
      if (response && response.status === 200 && response.type === 'basic') {
        var responseClone = response.clone();
        caches.open(CACHE_NAME).then(function(cache) {
          cache.put(event.request, responseClone);
        });
      }
      return response;
    }).catch(function() {
      return caches.match(event.request);
    })
  );
});
