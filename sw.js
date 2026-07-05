// Service Worker for MoodMeter
const CACHE_NAME = 'moodmeter-v29';
const IMAGE_CACHE_NAME = 'moodmeter-images-v1';
const CACHE_DURATION = 30 * 24 * 60 * 60 * 1000; // 30 days in milliseconds

// Files to cache immediately
const STATIC_ASSETS = [
    './',
    './index.html',
    './css/styles.css?v=29',
    './js/firebase-cloud.js?v=29',
    './js/app.js?v=29',
    './moodmeter.json',
    './icon.png',
    './manifest.json'
];

// Install event - cache static assets
self.addEventListener('install', event => {
    event.waitUntil(
        caches.open(CACHE_NAME)
            .then(cache => cache.addAll(STATIC_ASSETS))
            .then(() => self.skipWaiting())
    );
});

// Activate event - clean up old caches
self.addEventListener('activate', event => {
    event.waitUntil(
        caches.keys()
            .then(cacheNames => {
                return Promise.all(
                    cacheNames
                        .filter(name => name !== CACHE_NAME && name !== IMAGE_CACHE_NAME)
                        .map(name => caches.delete(name))
                );
            })
            .then(() => self.clients.claim())
    );
});

// Fetch event - serve from cache, fallback to network
self.addEventListener('fetch', event => {
    const url = new URL(event.request.url);

    // Handle image requests with cache-first strategy and 30-day expiration
    if (url.pathname.includes('/images/') && event.request.destination === 'image') {
        event.respondWith(handleImageRequest(event.request));
        return;
    }

    // Handle other requests with network-first strategy
    event.respondWith(
        fetch(event.request)
            .then(response => {
                // Clone the response before caching
                const responseClone = response.clone();
                caches.open(CACHE_NAME)
                    .then(cache => cache.put(event.request, responseClone));
                return response;
            })
            .catch(() => caches.match(event.request))
    );
});

// Handle image requests with cache-first and expiration
async function handleImageRequest(request) {
    const cache = await caches.open(IMAGE_CACHE_NAME);
    const cachedResponse = await cache.match(request);

    if (cachedResponse) {
        // Check if cache is still valid
        const cachedDate = cachedResponse.headers.get('sw-cache-date');
        if (cachedDate) {
            const cacheAge = Date.now() - parseInt(cachedDate, 10);
            if (cacheAge < CACHE_DURATION) {
                return cachedResponse;
            }
        }
    }

    // Fetch from network
    try {
        const networkResponse = await fetch(request);

        if (networkResponse.ok) {
            // Clone response and add cache date header
            const responseClone = networkResponse.clone();
            const headers = new Headers(responseClone.headers);
            headers.set('sw-cache-date', Date.now().toString());

            const cachedResponseWithDate = new Response(await responseClone.blob(), {
                status: responseClone.status,
                statusText: responseClone.statusText,
                headers: headers
            });

            cache.put(request, cachedResponseWithDate);
        }

        return networkResponse;
    } catch (error) {
        // Return cached response even if expired, as fallback
        if (cachedResponse) {
            return cachedResponse;
        }
        throw error;
    }
}
