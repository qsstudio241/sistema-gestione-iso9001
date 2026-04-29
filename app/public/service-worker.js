// Service Worker - SGQ ISO 9001 PWA
// Strategia: Cache-First per assets, Network-First per API

// Versione cache: placeholder sostituito solo in dist/service-worker.js dopo la build.
// Questo evita modifiche locali al file sorgente ad ogni npm run build.
const BUILD_DATE = '__BUILD_DATE__';
const CACHE_NAME = `sgq-iso9001-${BUILD_DATE}`;
const API_CACHE = 'sgq-api-v1';

// Assets da cachare per offline
const STATIC_ASSETS = [
    '/',
    '/index.html',
    '/manifest.json',
    '/icons/icon-192x192.png',
    '/icons/icon-512x512.png'
];

// Install: Pre-cache assets critici
self.addEventListener('install', (event) => {
    console.log('[SW] Install event');
    event.waitUntil(
        caches.open(CACHE_NAME).then((cache) => {
            console.log('[SW] Caching static assets');
            return cache.addAll(STATIC_ASSETS);
        }).then(() => {
            self.skipWaiting(); // Attiva subito nuovo SW
        })
    );
});

// Activate: Cleanup vecchie cache
self.addEventListener('activate', (event) => {
    console.log('[SW] Activate event');
    event.waitUntil(
        caches.keys().then((cacheNames) => {
            return Promise.all(
                cacheNames.map((cacheName) => {
                    if (cacheName !== CACHE_NAME && cacheName !== API_CACHE) {
                        console.log('[SW] Deleting old cache:', cacheName);
                        return caches.delete(cacheName);
                    }
                })
            );
        }).then(() => {
            self.clients.claim(); // Prendi controllo di tutti i client
        })
    );
});

// Fetch: Strategia ibrida
self.addEventListener('fetch', (event) => {
    const { request } = event;

    // Ignora richieste con schema non-HTTP (es. chrome-extension://, moz-extension://).
    // La Cache API non supporta schemi diversi da http/https e genera TypeError
    // per ogni estensione Chrome attiva nel browser (blocchi pub, password manager, ecc.).
    if (!request.url.startsWith('http')) return;

    const url = new URL(request.url);

    // BYPASS: Richieste API verso backend esterno (fr-busato.it)
    if (url.hostname.includes('fr-busato.it') || url.port === '8443') {
        return;
    }

    // API requests: BYPASS totale
    if (url.pathname.startsWith('/api/')) {
        return;
    }

    // Template Word: mai in cache
    if (url.pathname.startsWith('/templates/') && url.pathname.endsWith('.docx')) {
        return;
    }

    // Navigazione (HTML): Network-First — garantisce sempre il bundle più recente dopo un deploy.
    // Fallback a cache solo se offline.
    const isNavigate = request.mode === 'navigate' ||
        request.destination === 'document' ||
        url.pathname === '/' ||
        url.pathname.endsWith('.html');

    if (isNavigate) {
        event.respondWith(
            fetch(request).then((response) => {
                if (response.ok) {
                    const clone = response.clone();
                    caches.open(CACHE_NAME).then((cache) => cache.put(request, clone));
                }
                return response;
            }).catch(() => {
                // Offline: servi da cache (stessa URL o shell SPA)
                return caches.match(request).then((cached) =>
                    cached || caches.match('/index.html') || caches.match('/'),
                );
            })
        );
        return;
    }

    // Static assets (JS, CSS, immagini): Cache-First con fallback network
    event.respondWith(
        caches.match(request).then((cached) => {
            if (cached) return cached;

            return fetch(request).then((response) => {
                if (response.ok && request.method === 'GET') {
                    const responseClone = response.clone();
                    caches.open(CACHE_NAME).then((cache) => {
                        cache.put(request, responseClone);
                    });
                }
                return response;
            }).catch(() =>
                // Evita "Uncaught (in promise) TypeError: Failed to fetch" in SW su rete assente
                caches.match('/index.html').then((c) => c || caches.match('/')),
            );
        })
    );
});

// Sync event: Background sync per queue pending
self.addEventListener('sync', (event) => {
    console.log('[SW] Background sync event:', event.tag);

    if (event.tag === 'sync-audits') {
        event.waitUntil(
            // Frontend gestisce sync tramite SyncService
            self.clients.matchAll().then((clients) => {
                clients.forEach((client) => {
                    client.postMessage({ type: 'SYNC_TRIGGER' });
                });
            })
        );
    }
});

// Push notifications (future implementation)
self.addEventListener('push', (event) => {
    console.log('[SW] Push received:', event.data?.text());

    const options = {
        body: event.data?.text() || 'Nuova notifica SGQ',
        icon: '/icons/icon-192x192.png',
        badge: '/icons/badge-72x72.png',
        vibrate: [200, 100, 200]
    };

    event.waitUntil(
        self.registration.showNotification('SGQ ISO 9001', options)
    );
});
