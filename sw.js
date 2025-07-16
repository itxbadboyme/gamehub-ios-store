const CACHE_NAME = 'gamehub-v1.0.0';
const urlsToCache = [
    '/',
    '/index.html',
    '/game-page.html',
    '/manifest.json',
    'https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.4.0/css/all.min.css',
    'https://fonts.googleapis.com/css2?family=-apple-system,BlinkMacSystemFont,SF+Pro+Display,SF+Pro+Text,Helvetica+Neue,Helvetica,Arial,sans-serif'
];

// Install event - cache resources
self.addEventListener('install', function(event) {
    console.log('GameHub Service Worker: Installing...');
    
    event.waitUntil(
        caches.open(CACHE_NAME)
            .then(function(cache) {
                console.log('GameHub Service Worker: Caching files');
                return cache.addAll(urlsToCache);
            })
            .then(function() {
                console.log('GameHub Service Worker: All files cached successfully');
                return self.skipWaiting();
            })
            .catch(function(error) {
                console.error('GameHub Service Worker: Caching failed', error);
            })
    );
});

// Activate event - clean up old caches
self.addEventListener('activate', function(event) {
    console.log('GameHub Service Worker: Activating...');
    
    event.waitUntil(
        caches.keys().then(function(cacheNames) {
            return Promise.all(
                cacheNames.map(function(cacheName) {
                    if (cacheName !== CACHE_NAME) {
                        console.log('GameHub Service Worker: Deleting old cache', cacheName);
                        return caches.delete(cacheName);
                    }
                })
            );
        }).then(function() {
            console.log('GameHub Service Worker: Activated successfully');
            return self.clients.claim();
        })
    );
});

// Fetch event - serve cached content when offline
self.addEventListener('fetch', function(event) {
    // Skip non-GET requests
    if (event.request.method !== 'GET') {
        return;
    }
    
    // Skip cross-origin requests
    if (!event.request.url.startsWith(self.location.origin) && 
        !event.request.url.startsWith('https://cdnjs.cloudflare.com') &&
        !event.request.url.startsWith('https://fonts.googleapis.com')) {
        return;
    }
    
    event.respondWith(
        caches.match(event.request)
            .then(function(response) {
                // Return cached version if available
                if (response) {
                    console.log('GameHub Service Worker: Serving from cache', event.request.url);
                    return response;
                }
                
                // Otherwise fetch from network
                console.log('GameHub Service Worker: Fetching from network', event.request.url);
                return fetch(event.request).then(function(response) {
                    // Don't cache non-successful responses
                    if (!response || response.status !== 200 || response.type !== 'basic') {
                        return response;
                    }
                    
                    // Clone the response for caching
                    const responseToCache = response.clone();
                    
                    caches.open(CACHE_NAME)
                        .then(function(cache) {
                            cache.put(event.request, responseToCache);
                        });
                    
                    return response;
                });
            })
            .catch(function(error) {
                console.error('GameHub Service Worker: Fetch failed', error);
                
                // Return offline page for navigation requests
                if (event.request.destination === 'document') {
                    return caches.match('/index.html');
                }
                
                // Return empty response for other requests
                return new Response('', {
                    status: 408,
                    statusText: 'Request timeout - offline'
                });
            })
    );
});

// Push notification event
self.addEventListener('push', function(event) {
    console.log('GameHub Service Worker: Push notification received');
    
    const options = {
        body: event.data ? event.data.text() : 'New games available on GameHub!',
        icon: '/icon-192x192.png',
        badge: '/badge-72x72.png',
        image: '/notification-image.png',
        vibrate: [100, 50, 100],
        data: {
            dateOfArrival: Date.now(),
            primaryKey: 1
        },
        actions: [
            {
                action: 'explore',
                title: 'Explore Games',
                icon: '/explore-icon.png'
            },
            {
                action: 'close',
                title: 'Close',
                icon: '/close-icon.png'
            }
        ],
        requireInteraction: true,
        silent: false
    };
    
    event.waitUntil(
        self.registration.showNotification('GameHub', options)
    );
});

// Notification click event
self.addEventListener('notificationclick', function(event) {
    console.log('GameHub Service Worker: Notification clicked');
    
    event.notification.close();
    
    if (event.action === 'explore') {
        // Open the app to explore games
        event.waitUntil(
            clients.openWindow('/')
        );
    } else if (event.action === 'close') {
        // Just close the notification
        return;
    } else {
        // Default action - open the app
        event.waitUntil(
            clients.openWindow('/')
        );
    }
});

// Background sync event
self.addEventListener('sync', function(event) {
    console.log('GameHub Service Worker: Background sync triggered');
    
    if (event.tag === 'game-download') {
        event.waitUntil(
            syncGameDownloads()
        );
    }
});

// Sync game downloads when back online
function syncGameDownloads() {
    return new Promise(function(resolve) {
        // Get pending downloads from IndexedDB or localStorage
        const pendingDownloads = JSON.parse(localStorage.getItem('pendingDownloads') || '[]');
        
        if (pendingDownloads.length > 0) {
            console.log('GameHub Service Worker: Syncing', pendingDownloads.length, 'pending downloads');
            
            // Process pending downloads
            const syncPromises = pendingDownloads.map(function(download) {
                return processDownload(download);
            });
            
            Promise.all(syncPromises).then(function() {
                // Clear pending downloads
                localStorage.setItem('pendingDownloads', '[]');
                console.log('GameHub Service Worker: All downloads synced');
                resolve();
            });
        } else {
            resolve();
        }
    });
}

// Process individual download
function processDownload(download) {
    return new Promise(function(resolve) {
        // Simulate download processing
        console.log('GameHub Service Worker: Processing download for', download.gameTitle);
        
        // In a real app, this would handle actual download logic
        setTimeout(function() {
            console.log('GameHub Service Worker: Download completed for', download.gameTitle);
            resolve();
        }, 1000);
    });
}

// Message event - communicate with main thread
self.addEventListener('message', function(event) {
    console.log('GameHub Service Worker: Message received', event.data);
    
    if (event.data && event.data.type === 'SKIP_WAITING') {
        self.skipWaiting();
    }
    
    if (event.data && event.data.type === 'GET_VERSION') {
        event.ports[0].postMessage({
            version: CACHE_NAME
        });
    }
    
    if (event.data && event.data.type === 'CACHE_GAME') {
        const gameData = event.data.gameData;
        
        caches.open(CACHE_NAME).then(function(cache) {
            // Cache game assets
            const gameAssets = [
                `/game-${gameData.id}/icon.png`,
                `/game-${gameData.id}/screenshots/`,
                `/game-${gameData.id}/trailer.mp4`
            ];
            
            return cache.addAll(gameAssets);
        }).then(function() {
            console.log('GameHub Service Worker: Game assets cached for', gameData.title);
            
            event.ports[0].postMessage({
                success: true,
                message: 'Game assets cached successfully'
            });
        }).catch(function(error) {
            console.error('GameHub Service Worker: Failed to cache game assets', error);
            
            event.ports[0].postMessage({
                success: false,
                message: 'Failed to cache game assets'
            });
        });
    }
});

// Error event
self.addEventListener('error', function(event) {
    console.error('GameHub Service Worker: Error occurred', event.error);
});

// Unhandled rejection event
self.addEventListener('unhandledrejection', function(event) {
    console.error('GameHub Service Worker: Unhandled promise rejection', event.reason);
    event.preventDefault();
});

// Periodic background sync (if supported)
self.addEventListener('periodicsync', function(event) {
    if (event.tag === 'game-updates') {
        event.waitUntil(checkForGameUpdates());
    }
});

// Check for game updates
function checkForGameUpdates() {
    return fetch('/api/check-updates')
        .then(function(response) {
            return response.json();
        })
        .then(function(data) {
            if (data.hasUpdates) {
                return self.registration.showNotification('GameHub', {
                    body: `${data.updateCount} games have new updates available!`,
                    icon: '/icon-192x192.png',
                    badge: '/badge-72x72.png',
                    tag: 'game-updates'
                });
            }
        })
        .catch(function(error) {
            console.error('GameHub Service Worker: Failed to check for updates', error);
        });
}

// Service worker update available
self.addEventListener('message', function(event) {
    if (event.data && event.data.type === 'UPDATE_AVAILABLE') {
        console.log('GameHub Service Worker: Update available, preparing to update...');
        
        // Notify the main thread that update is ready
        self.clients.matchAll().then(function(clients) {
            clients.forEach(function(client) {
                client.postMessage({
                    type: 'UPDATE_READY',
                    message: 'A new version of GameHub is available!'
                });
            });
        });
    }
});

console.log('GameHub Service Worker: Script loaded successfully');
