// ZHIROX Service Worker - Conservative Production PWA Cache Strategy
const CACHE_VERSION = 'zhirox-v1.3.0';
const STATIC_CACHE_NAME = `zhirox-static-${CACHE_VERSION}`;
const DYNAMIC_CACHE_NAME = `zhirox-dynamic-${CACHE_VERSION}`;

const PRECACHE_ASSETS = [
  '/',
  '/index.html',
  '/manifest.webmanifest',
  '/favicon.ico',
  '/icons/icon-192.png',
  '/icons/icon-512.png',
  '/icons/icon-maskable-512.png',
  '/apple-touch-icon.png'
];

const STATIC_ASSET_RE = /\.(?:js|css|png|jpg|jpeg|svg|gif|webp|woff|woff2|ttf|eot|ico)$/i;

function isSensitiveRequest(request, url) {
  if (request.method !== 'GET') return true;
  if (url.origin !== self.location.origin) return true;
  if (request.headers.has('authorization')) return true;
  if (url.search) return true;

  return (
    url.pathname.startsWith('/api/') ||
    url.pathname.includes('/auth/') ||
    url.pathname.startsWith('/supabase') ||
    url.pathname.startsWith('/portal/') ||
    url.pathname.startsWith('/activate') ||
    url.pathname.startsWith('/b/') ||
    url.pathname.startsWith('/balance/') ||
    url.pathname.startsWith('/customer-balance/')
  );
}

function canCacheResponse(response) {
  if (!response || response.status !== 200 || response.type !== 'basic') return false;
  const cacheControl = (response.headers.get('cache-control') || '').toLowerCase();
  return !cacheControl.includes('no-store') && !cacheControl.includes('private');
}

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(STATIC_CACHE_NAME).then((cache) =>
      cache.addAll(PRECACHE_ASSETS).catch((err) => {
        console.warn('[SW] Pre-cache warning:', err);
      })
    )
  );
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys()
      .then((cacheNames) => Promise.all(
        cacheNames.map((cacheName) => {
          if (
            cacheName.startsWith('zhirox-') &&
            cacheName !== STATIC_CACHE_NAME &&
            cacheName !== DYNAMIC_CACHE_NAME
          ) {
            return caches.delete(cacheName);
          }
          return Promise.resolve(false);
        })
      ))
      .then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', (event) => {
  const request = event.request;
  const url = new URL(request.url);

  // Financial, auth, customer portal and all token/query-bearing requests are NetworkOnly.
  if (isSensitiveRequest(request, url)) return;

  // Navigations use NetworkFirst. Only the static app shell is used as offline fallback.
  if (request.mode === 'navigate') {
    event.respondWith(
      fetch(request).catch(async () => {
        return (await caches.match('/index.html')) || (await caches.match('/')) || Response.error();
      })
    );
    return;
  }

  // Cache only explicit static file types. Never cache arbitrary same-origin GET responses.
  if (!STATIC_ASSET_RE.test(url.pathname)) return;

  event.respondWith(
    caches.match(request).then((cachedResponse) => {
      const networkPromise = fetch(request)
        .then((networkResponse) => {
          if (canCacheResponse(networkResponse)) {
            const copy = networkResponse.clone();
            event.waitUntil(
              caches.open(DYNAMIC_CACHE_NAME).then((cache) => cache.put(request, copy))
            );
          }
          return networkResponse;
        })
        .catch(() => cachedResponse || Response.error());

      return cachedResponse || networkPromise;
    })
  );
});

self.addEventListener('message', (event) => {
  if (event.data && event.data.type === 'SKIP_WAITING') {
    self.skipWaiting();
  }
});
