// FleetPro Service Worker - PWA Support
const CACHE_VERSION = 'fleetpro-v1.0.0-20260811';
const RUNTIME_CACHE = 'fleetpro-runtime';
const API_CACHE = 'fleetpro-api';

const STATIC_ASSETS = [
  '/',
  '/index.html',
  '/assets/index.es-CaFPsiOR.js',
  '/assets/index-BDfYcrQ0.css',
];

const API_PATTERNS = [
  '/api/health',
  '/api/bookings',
  '/api/customers',
  '/api/drivers',
  '/api/vehicles',
];

// Install: Cache static assets
self.addEventListener('install', (event) => {
  console.log('[ServiceWorker] Installing FleetPro PWA');

  event.waitUntil(
    caches.open(CACHE_VERSION).then((cache) => {
      console.log('[ServiceWorker] Caching static assets');
      return cache.addAll(STATIC_ASSETS).catch(() => {
        console.warn('[ServiceWorker] Some assets could not be cached');
      });
    })
  );

  self.skipWaiting();
});

// Activate: Clean up old caches
self.addEventListener('activate', (event) => {
  console.log('[ServiceWorker] Activating FleetPro PWA');

  event.waitUntil(
    caches.keys().then((cacheNames) => {
      return Promise.all(
        cacheNames.map((cacheName) => {
          if (cacheName !== CACHE_VERSION && cacheName !== RUNTIME_CACHE && cacheName !== API_CACHE) {
            console.log('[ServiceWorker] Deleting old cache:', cacheName);
            return caches.delete(cacheName);
          }
        })
      );
    })
  );

  self.clients.claim();
});

// Fetch: Intelligent caching strategy
self.addEventListener('fetch', (event) => {
  const { request } = event;
  const url = new URL(request.url);

  // Skip non-GET requests
  if (request.method !== 'GET') {
    return;
  }

  // Skip API requests (handle separately)
  if (url.pathname.startsWith('/api/')) {
    return event.respondWith(handleApiRequest(request));
  }

  // Cache-first for static assets
  if (isStaticAsset(url.pathname)) {
    return event.respondWith(handleStaticRequest(request));
  }

  // Network-first for HTML/app shell
  return event.respondWith(handleDynamicRequest(request));
});

// Handle API requests with network-first strategy
async function handleApiRequest(request) {
  try {
    const response = await fetch(request);

    // Only cache successful responses
    if (response.ok) {
      const cache = await caches.open(API_CACHE);
      cache.put(request, response.clone());
    }

    return response;
  } catch (error) {
    console.warn('[ServiceWorker] API request failed:', error);

    // Return cached API response if available
    const cachedResponse = await caches.match(request);
    if (cachedResponse) {
      console.log('[ServiceWorker] Returning cached API response');
      return cachedResponse;
    }

    // Return offline response
    return new Response(
      JSON.stringify({
        offline: true,
        message: 'You are offline. Some FleetPro features are temporarily unavailable.',
      }),
      {
        status: 503,
        statusText: 'Service Unavailable',
        headers: { 'Content-Type': 'application/json' },
      }
    );
  }
}

// Handle static assets with cache-first strategy
async function handleStaticRequest(request) {
  const cached = await caches.match(request);

  if (cached) {
    return cached;
  }

  try {
    const response = await fetch(request);

    if (response.ok) {
      const cache = await caches.open(RUNTIME_CACHE);
      cache.put(request, response.clone());
    }

    return response;
  } catch (error) {
    console.warn('[ServiceWorker] Static asset fetch failed:', error);
    return new Response('Asset not available offline', { status: 404 });
  }
}

// Handle dynamic requests with network-first strategy
async function handleDynamicRequest(request) {
  try {
    const response = await fetch(request);

    if (response.ok) {
      const cache = await caches.open(RUNTIME_CACHE);
      cache.put(request, response.clone());
    }

    return response;
  } catch (error) {
    console.warn('[ServiceWorker] Network request failed:', error);

    // Return cached version if available
    const cached = await caches.match(request);
    if (cached) {
      return cached;
    }

    // Return offline fallback
    return new Response(
      `
      <!DOCTYPE html>
      <html>
        <head>
          <title>FleetPro - Offline</title>
          <style>
            body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; padding: 20px; }
            .offline-notice { background: #fff3cd; padding: 16px; border-radius: 8px; }
            h2 { color: #666; }
          </style>
        </head>
        <body>
          <div class="offline-notice">
            <h2>You are offline</h2>
            <p>Some FleetPro features are temporarily unavailable.</p>
            <p>Check your internet connection and try again.</p>
          </div>
        </body>
      </html>
      `,
      { status: 503, headers: { 'Content-Type': 'text/html' } }
    );
  }
}

// Utility: Check if URL is a static asset
function isStaticAsset(pathname) {
  return /\.(js|css|png|jpg|jpeg|svg|woff|woff2|ttf|eot|ico)$/.test(pathname) ||
         pathname.startsWith('/icons/') ||
         pathname.startsWith('/screenshots/');
}

// Handle messages from clients
self.addEventListener('message', (event) => {
  if (event.data && event.data.type === 'SKIP_WAITING') {
    self.skipWaiting();
  }

  if (event.data && event.data.type === 'CLEAR_CACHE') {
    caches.keys().then((cacheNames) => {
      return Promise.all(
        cacheNames.map((cacheName) => caches.delete(cacheName))
      );
    });
  }
});

// Background Sync event
self.addEventListener('sync', (event) => {
  console.log('[ServiceWorker] Background sync triggered:', event.tag);

  if (event.tag === 'bookings-sync') {
    event.waitUntil(syncBookings());
  } else if (event.tag === 'customers-sync') {
    event.waitUntil(syncCustomers());
  } else if (event.tag === 'vehicles-sync') {
    event.waitUntil(syncVehicles());
  } else if (event.tag === 'drivers-sync') {
    event.waitUntil(syncDrivers());
  } else if (event.tag === 'general-sync') {
    event.waitUntil(syncAll());
  }
});

async function syncBookings() {
  try {
    const response = await fetch('/api/bookings');
    if (response.ok) {
      const data = await response.json();
      notifyClients('SYNC_COMPLETE', { tag: 'bookings-sync', data });
      return true;
    }
  } catch (error) {
    notifyClients('SYNC_ERROR', { tag: 'bookings-sync', error: error.message });
    throw error;
  }
}

async function syncCustomers() {
  try {
    const response = await fetch('/api/customers');
    if (response.ok) {
      const data = await response.json();
      notifyClients('SYNC_COMPLETE', { tag: 'customers-sync', data });
      return true;
    }
  } catch (error) {
    notifyClients('SYNC_ERROR', { tag: 'customers-sync', error: error.message });
    throw error;
  }
}

async function syncVehicles() {
  try {
    const response = await fetch('/api/vehicles');
    if (response.ok) {
      const data = await response.json();
      notifyClients('SYNC_COMPLETE', { tag: 'vehicles-sync', data });
      return true;
    }
  } catch (error) {
    notifyClients('SYNC_ERROR', { tag: 'vehicles-sync', error: error.message });
    throw error;
  }
}

async function syncDrivers() {
  try {
    const response = await fetch('/api/drivers');
    if (response.ok) {
      const data = await response.json();
      notifyClients('SYNC_COMPLETE', { tag: 'drivers-sync', data });
      return true;
    }
  } catch (error) {
    notifyClients('SYNC_ERROR', { tag: 'drivers-sync', error: error.message });
    throw error;
  }
}

async function syncAll() {
  const results = await Promise.all([
    syncBookings(),
    syncCustomers(),
    syncVehicles(),
    syncDrivers(),
  ]);
  return results.every((r) => r === true);
}

function notifyClients(type, data) {
  self.clients.matchAll().then((clients) => {
    clients.forEach((client) => {
      client.postMessage({ type, ...data });
    });
  });
}

// Push notification event
self.addEventListener('push', (event) => {
  console.log('[ServiceWorker] Push notification received');

  let notificationData = {
    title: 'FleetPro Notification',
    body: 'You have a new notification',
    icon: '/icons/icon-192x192.png',
    badge: '/icons/icon-192x192.png',
    tag: 'fleetpro-push',
  };

  if (event.data) {
    try {
      notificationData = { ...notificationData, ...event.data.json() };
    } catch (error) {
      console.warn('[ServiceWorker] Failed to parse push data:', error);
      notificationData.body = event.data.text();
    }
  }

  event.waitUntil(
    self.registration.showNotification(notificationData.title, {
      body: notificationData.body,
      icon: notificationData.icon,
      badge: notificationData.badge,
      tag: notificationData.tag,
      data: notificationData.data || {},
      actions: notificationData.actions || [],
      requireInteraction: notificationData.requireInteraction || false,
    })
  );
});

// Notification click event
self.addEventListener('notificationclick', (event) => {
  console.log('[ServiceWorker] Notification clicked:', event.notification.tag);

  event.notification.close();

  event.waitUntil(
    self.clients.matchAll({ type: 'window' }).then((clientList) => {
      // Check if app is already open
      for (let i = 0; i < clientList.length; i++) {
        if (clientList[i].url === '/' && 'focus' in clientList[i]) {
          return clientList[i].focus();
        }
      }

      // Open new window if not open
      if (self.clients.openWindow) {
        return self.clients.openWindow('/');
      }
    })
  );

  // Notify client of click
  notifyClients('NOTIFICATION_CLICK', { tag: event.notification.tag });
});

console.log('[ServiceWorker] FleetPro PWA Service Worker ready');
