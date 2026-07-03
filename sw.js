// Service Worker for background notifications
const CACHE_NAME = 'alarm-pwa-v1';
const ASSETS = [
    '/',
    '/index.html',
    '/manifest.json',
    '/icon-192.png',
    '/icon-512.png'
];

// Install and cache assets
self.addEventListener('install', event => {
    event.waitUntil(
        caches.open(CACHE_NAME)
            .then(cache => cache.addAll(ASSETS))
            .then(() => self.skipWaiting())
    );
});

// Activate and clean old caches
self.addEventListener('activate', event => {
    event.waitUntil(
        caches.keys().then(keys => {
            return Promise.all(
                keys.filter(key => key !== CACHE_NAME)
                    .map(key => caches.delete(key))
            );
        }).then(() => self.clients.claim())
    );
});

// Serve from cache, fallback to network
self.addEventListener('fetch', event => {
    event.respondWith(
        caches.match(event.request)
            .then(response => response || fetch(event.request))
    );
});

// Push notifications for alarms
self.addEventListener('push', event => {
    const data = event.data ? event.data.json() : { title: '⏰ Alarm!', body: 'Time to wake up!' };
    
    event.waitUntil(
        self.registration.showNotification(data.title, {
            body: data.body,
            icon: '/icon-192.png',
            badge: '/icon-192.png',
            vibrate: [200, 100, 200, 100, 200],
            requireInteraction: true,
            tag: 'alarm_' + Date.now(),
            actions: [
                { action: 'stop', title: 'Stop' },
                { action: 'snooze', title: 'Snooze 5min' }
            ]
        })
    );
});

// Handle notification clicks
self.addEventListener('notificationclick', event => {
    event.notification.close();

    if (event.action === 'stop') {
        // Send message to client to stop alarm
        self.clients.matchAll().then(clients => {
            clients.forEach(client => {
                client.postMessage({ type: 'STOP_ALARM' });
            });
        });
    } else if (event.action === 'snooze') {
        // Snooze: add 5 minutes
        self.clients.matchAll().then(clients => {
            clients.forEach(client => {
                client.postMessage({ type: 'SNOOZE', minutes: 5 });
            });
        });
    }

    // Open the app
    event.waitUntil(
        self.clients.openWindow('/')
    );
});

// Background sync for offline alarms
self.addEventListener('sync', event => {
    if (event.tag === 'sync-alarms') {
        event.waitUntil(syncAlarms());
    }
});

async function syncAlarms() {
    // Check for missed alarms when back online
    const cache = await caches.open('alarm-data');
    const response = await cache.match('/alarms.json');
    if (response) {
        const alarms = await response.json();
        // Check if any alarms were missed
        const now = Date.now();
        const missed = alarms.filter(a => 
            !a.triggered && new Date(a.time).getTime() <= now
        );
        if (missed.length > 0) {
            // Show notification for missed alarms
            self.registration.showNotification('⏰ Missed Alarm!', {
                body: `You missed ${missed.length} alarm${missed.length > 1 ? 's' : ''}`,
                icon: '/icon-192.png'
            });
        }
    }
}
