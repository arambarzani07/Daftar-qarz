// ZHIROX Service Worker - Conservative Production PWA Cache Strategy
const CACHE_VERSION = 'zhirox-v1.2.0';
const STATIC_CACHE_NAME = `zhirox-static-${CACHE_VERSION}`;
const DYNAMIC_CACHE_NAME = `zhirox-dynamic-${CACHE_VERSION}`;

// Static immutable assets to pre-cache
const PRECACHE_ASSETS = [
  '/',
  '/index.html',
  '/manifest.webmanifest',
  '/favicon.ico',
  '/icons/icon-192.png',
  '/icons/icon-512.png',
  '/apple-touch-icon.png'
];

// Install Event - Pre-cache minimal app shell
self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(STATIC_CACHE_NAME).then((cache) => {
      return cache.addAll(PRECACHE_ASSETS).catch((err) => {
        console.warn('[SW] Pre-cache warning:', err);
      });
    })
  );
  self.skipWaiting();
});

// Activate Event - Clean up stale caches
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((cacheNames) => {
      return Promise.all(
        cacheNames.map((cacheName) => {
          if (
            cacheName.startsWith('zhirox-') &&
            cacheName !== STATIC_CACHE_NAME &&
            cacheName !== DYNAMIC_CACHE_NAME
          ) {
            console.log('[SW] Removing old cache:', cacheName);
            return caches.delete(cacheName);
          }
        })
      );
    }).then(() => self.clients.claim())
  );
});

// Fetch Event - Strict Policy: Let browser handle API & Sensitive Data natively (NetworkOnly)
self.addEventListener('fetch', (event) => {
  const url = new URL(event.request.url);

  // 1. NEVER intercept any /api/ requests, auth endpoints, or backend queries (Browser handles natively)
  if (
    url.pathname.startsWith('/api/') ||
    url.pathname.includes('/auth/') ||
    url.pathname.startsWith('/supabase') ||
    event.request.method !== 'GET'
  ) {
    return; // Pass through natively to network without SW interference
  }

  // 2. Navigation Requests - Serve App Shell with NetworkFirst fallback to cached index.html
  if (event.request.mode === 'navigate') {
    event.respondWith(
      fetch(event.request).catch(() => {
        return caches.match('/index.html') || caches.match('/');
      })
    );
    return;
  }

  // 3. Static Assets (JS, CSS, Images, Fonts) - StaleWhileRevalidate or CacheFirst
  if (
    url.pathname.match(/\.(js|css|png|jpg|jpeg|svg|gif|webp|woff|woff2|ttf|eot|ico)$/) ||
    url.origin === location.origin
  ) {
    event.respondWith(
      caches.match(event.request).then((cachedResponse) => {
        const fetchPromise = fetch(event.request).then((networkResponse) => {
          if (networkResponse && networkResponse.status === 200 && networkResponse.type === 'basic') {
            const responseToCache = networkResponse.clone();
            caches.open(DYNAMIC_CACHE_NAME).then((cache) => {
              cache.put(event.request, responseToCache);
            });
          }
          return networkResponse;
        }).catch(() => cachedResponse);

        return cachedResponse || fetchPromise;
      })
    );
    return;
  }
});

// Skip waiting message listener
self.addEventListener('message', (event) => {
  if (event.data && event.data.type === 'SKIP_WAITING') {
    self.skipWaiting();
  }
});
