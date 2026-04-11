// Service Worker - SGQ ISO 9001 PWA
// Strategia: Cache-First per assets, Network-First per API

// Versione cache: aggiornare BUILD_DATE ad ogni deploy per invalidare cache vecchie
// Netlify inietta automaticamente hash nei bundle JS/CSS — questo invalida l'app shell
const BUILD_DATE = '2026-04-11T11:37:58.279Z';
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
    const url = new URL(request.url);

    // BYPASS: Richieste API verso backend esterno (fr-busato.it)
    // Lascia che il browser gestisca direttamente, senza intercettare
    if (url.hostname.includes('fr-busato.it') || url.port === '8443') {
        console.log('[SW] Bypass API request to external backend:', url.href);
        return; // Nessuna intercettazione, fetch nativa del browser
    }

    // API requests: BYPASS totale — non intercettare, lascia passare al browser
    // (evita problemi con proxy Vite in dev e CORS)
    if (url.pathname.startsWith('/api/')) {
        return;
    }

    // Template Word: mai in cache — modifiche in app/public/templates/ devono riflettersi subito
    if (url.pathname.startsWith('/templates/') && url.pathname.endsWith('.docx')) {
        return;
    }

    // Static assets: Cache-First
    event.respondWith(
        caches.match(request).then((cached) => {
            if (cached) {
                console.log('[SW] Serving from cache:', url.pathname);
                return cached;
            }

            // Se non in cache, fetch from network
            return fetch(request).then((response) => {
                // Cache solo successful responses
                if (response.ok && request.method === 'GET') {
                    const responseClone = response.clone();
                    caches.open(CACHE_NAME).then((cache) => {
                        cache.put(request, responseClone);
                    });
                }
                return response;
            });
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
