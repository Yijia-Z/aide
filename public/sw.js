const CACHE_NAME = 'aide-v2';
const STATIC_ASSETS = [
    '/',
    '/manifest.json',
    '/android-chrome-192x192.png',
    '/android-chrome-512x512.png',
    '/fonts/JetBrainsMono-Regular.ttf',
    // Add critical app JavaScript and CSS
    '/_next/static/chunks/main.js',
    '/_next/static/chunks/webpack.js',
    '/_next/static/chunks/pages/_app.js',
    '/_next/static/chunks/pages/index.js',
    '/_next/static/css/app.css'
];

// Dynamic cache for runtime resources
const DYNAMIC_CACHE = 'aide-dynamic-v1';

// Install event handler
self.addEventListener('install', (event) => {
    event.waitUntil(
        Promise.all([
            caches.open(CACHE_NAME).then((cache) => cache.addAll(STATIC_ASSETS)),
            caches.open(DYNAMIC_CACHE)
        ])
    );
    self.skipWaiting();
});

// Fetch event - network first with dynamic caching
self.addEventListener('fetch', (event) => {
    // Skip non-GET requests
    if (event.request.method !== 'GET') return;

    // Handle different types of requests
    if (event.request.mode === 'navigate' ||
        event.request.destination === 'style' ||
        event.request.destination === 'script') {

        event.respondWith(
            fetch(event.request)
                .then((response) => {
                    const responseClone = response.clone();
                    caches.open(DYNAMIC_CACHE).then((cache) => {
                        cache.put(event.request, responseClone);
                    });
                    return response;
                })
                .catch(async () => {
                    const cachedResponse = await caches.match(event.request);
                    return cachedResponse || caches.match('/');
                })
        );
    } else {
        // For other resources, try cache first
        event.respondWith(
            caches.match(event.request)
                .then((response) => response || fetch(event.request))
                .catch(() => {
                    // Return appropriate fallbacks
                    if (event.request.destination === 'image') {
                        return new Response(
                            '<svg width="100" height="100"><text x="50%" y="50%" text-anchor="middle">Offline</text></svg>',
                            { headers: { 'Content-Type': 'image/svg+xml' } }
                        );
                    }
                    return new Response('Offline content not available');
                })
        );
    }
});