/**
 * FleetPro Service Worker
 * Handles push notifications, offline queueing, and background sync
 * Compatible with Chrome, Firefox, Safari, and mobile platforms
 */

// Cache versions for offline support
const CACHE_VERSION = 'fleetpro-v1';
const NOTIFICATION_CACHE = 'fleetpro-notifications-v1';
const API_CACHE = 'fleetpro-api-v1';

// Initialize service worker
self.addEventListener('install', (event) => {
  console.log('[SW] Installing service worker...');
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  console.log('[SW] Activating service worker...');
  event.waitUntil(
    caches.keys().then((cacheNames) => {
      return Promise.all(
        cacheNames.map((cacheName) => {
          if (
            cacheName !== CACHE_VERSION &&
            cacheName !== NOTIFICATION_CACHE &&
            cacheName !== API_CACHE
          ) {
            return caches.delete(cacheName);
          }
        })
      );
    })
  );
  self.clients.claim();
});

/**
 * Handle incoming push notifications
 * Displays notification with title, body, actions, and custom styling
 */
self.addEventListener('push', (event) => {
  console.log('[SW] Push event received', event);

  if (!event.data) {
    console.warn('[SW] Push event has no data');
    return;
  }

  let notificationData = {};
  try {
    notificationData = event.data.json();
  } catch (err) {
    console.error('[SW] Failed to parse push data', err);
    notificationData = {
      title: 'FleetPro Notification',
      body: event.data.text(),
    };
  }

  const {
    title = 'FleetPro',
    body = 'You have a new notification',
    icon = '/icons/icon-192x192.png',
    badge = '/icons/icon-96x96.png',
    tag = 'fleetpro-notification',
    data = {},
    actions = [],
    vibrate = [200, 100, 200],
    requireInteraction = false,
  } = notificationData;

  const notificationOptions = {
    body,
    icon,
    badge,
    tag,
    data: {
      ...data,
      timestamp: new Date().toISOString(),
    },
    vibrate,
    requireInteraction,
    actions: actions.slice(0, 3), // Max 3 actions per notification
    silent: false,
    dir: 'auto',
  };

  // Add custom sound support for Android/mobile
  if (notificationData.sound) {
    notificationOptions.data.sound = notificationData.sound;
  }

  event.waitUntil(
    self.registration.showNotification(title, notificationOptions)
      .then(() => {
        console.log('[SW] Notification displayed:', title);

        // Log notification view for analytics
        logNotificationEvent('displayed', {
          title,
          tag,
          notificationId: data.notificationId,
        });
      })
      .catch((err) => {
        console.error('[SW] Failed to show notification', err);
        logNotificationEvent('display-failed', {
          title,
          error: err.message,
        });
      })
  );
});

/**
 * Handle notification clicks
 * Open relevant page or perform action based on notification type
 */
self.addEventListener('notificationclick', (event) => {
  console.log('[SW] Notification clicked', event.notification.tag);
  event.notification.close();

  const { data, action } = event;
  const notificationData = event.notification.data || {};

  // Log notification interaction
  logNotificationEvent('clicked', {
    tag: event.notification.tag,
    action,
    notificationId: notificationData.notificationId,
  });

  // Handle action buttons (if notification has actions)
  if (action) {
    handleNotificationAction(action, notificationData);
    return;
  }

  // Handle default click - open app
  const urlToOpen = buildNotificationUrl(notificationData);

  event.waitUntil(
    clients.matchAll({ type: 'window', includeUncontrolled: true })
      .then((clientList) => {
        // Check if app window is already open
        for (let i = 0; i < clientList.length; i++) {
          const client = clientList[i];
          if (client.url === urlToOpen && 'focus' in client) {
            return client.focus();
          }
        }

        // If not open, open new window
        if (clients.openWindow) {
          return clients.openWindow(urlToOpen);
        }
      })
  );
});

/**
 * Handle notification close events
 */
self.addEventListener('notificationclose', (event) => {
  console.log('[SW] Notification closed', event.notification.tag);
  const notificationData = event.notification.data || {};

  logNotificationEvent('dismissed', {
    tag: event.notification.tag,
    notificationId: notificationData.notificationId,
  });
});

/**
 * Handle background sync for offline notifications
 * Queues notifications when offline and syncs when back online
 */
self.addEventListener('sync', (event) => {
  console.log('[SW] Background sync event:', event.tag);

  if (event.tag === 'sync-notifications') {
    event.waitUntil(syncPendingNotifications());
  }
});

/**
 * Handle fetch events for offline support
 */
self.addEventListener('fetch', (event) => {
  const { request } = event;
  const url = new URL(request.url);

  // Skip non-GET requests
  if (request.method !== 'GET') {
    return;
  }

  // Skip API requests for now (cache per request)
  if (url.pathname.startsWith('/api/')) {
    return handleApiRequest(event);
  }

  // Cache-first strategy for static assets
  event.respondWith(
    caches.match(request)
      .then((response) => {
        if (response) {
          return response;
        }

        return fetch(request)
          .then((response) => {
            if (!response || response.status !== 200) {
              return response;
            }

            const responseToCache = response.clone();
            caches.open(CACHE_VERSION)
              .then((cache) => {
                cache.put(request, responseToCache);
              });

            return response;
          });
      })
      .catch(() => {
        // Return offline page if available
        return caches.match('/offline.html').catch(() => new Response(
          'Offline - Please check your connection',
          { status: 503 }
        ));
      })
  );
});

/**
 * Handle API requests with network-first strategy
 */
function handleApiRequest(event) {
  event.respondWith(
    fetch(event.request)
      .then((response) => {
        if (!response || response.status !== 200) {
          return response;
        }

        const responseToCache = response.clone();
        caches.open(API_CACHE)
          .then((cache) => {
            cache.put(event.request, responseToCache);
          });

        return response;
      })
      .catch(() => {
        return caches.match(event.request)
          .catch(() => new Response(
            JSON.stringify({ error: 'Offline' }),
            { status: 503, headers: { 'Content-Type': 'application/json' } }
          ));
      })
  );
}

/**
 * Handle notification action button clicks
 */
function handleNotificationAction(action, notificationData) {
  console.log('[SW] Handling action:', action);

  switch (action) {
    case 'approve':
      sendNotificationResponse(notificationData.notificationId, 'approved');
      break;
    case 'reject':
      sendNotificationResponse(notificationData.notificationId, 'rejected');
      break;
    case 'reply':
      // Open reply dialog in app
      if (clients.openWindow) {
        clients.openWindow(`/?reply_to=${notificationData.notificationId}`);
      }
      break;
    case 'view':
      if (clients.openWindow) {
        clients.openWindow(buildNotificationUrl(notificationData));
      }
      break;
    default:
      console.warn('[SW] Unknown action:', action);
  }
}

/**
 * Build URL to open based on notification type
 */
function buildNotificationUrl(data) {
  const baseUrl = self.registration.scope;

  if (data.type === 'booking') {
    return `${baseUrl}?view=booking&id=${data.resourceId}`;
  }
  if (data.type === 'driver') {
    return `${baseUrl}?view=driver&id=${data.resourceId}`;
  }
  if (data.type === 'vehicle') {
    return `${baseUrl}?view=vehicle&id=${data.resourceId}`;
  }
  if (data.url) {
    return new URL(data.url, baseUrl).toString();
  }

  return baseUrl;
}

/**
 * Send notification response to server
 */
function sendNotificationResponse(notificationId, action) {
  fetch('/api/notifications/response', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      notificationId,
      action,
      respondedAt: new Date().toISOString(),
    }),
  }).catch((err) => {
    console.error('[SW] Failed to send notification response', err);
  });
}

/**
 * Log notification events for analytics
 */
function logNotificationEvent(eventType, data) {
  const eventData = {
    type: eventType,
    timestamp: new Date().toISOString(),
    ...data,
  };

  // Queue event for analytics
  self.clients.matchAll().then((clients) => {
    clients.forEach((client) => {
      client.postMessage({
        type: 'NOTIFICATION_EVENT',
        data: eventData,
      });
    });
  });

  // Also attempt to send to server (best effort)
  fetch('/api/notification-analytics/event', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(eventData),
  }).catch((err) => {
    console.error('[SW] Failed to log notification event', err);
  });
}

/**
 * Sync pending notifications when back online
 */
async function syncPendingNotifications() {
  try {
    const cache = await caches.open(NOTIFICATION_CACHE);
    const keys = await cache.keys();

    console.log('[SW] Syncing', keys.length, 'pending notifications');

    for (const request of keys) {
      try {
        const response = await fetch(request);
        if (response.ok) {
          await cache.delete(request);
        }
      } catch (err) {
        console.error('[SW] Failed to sync notification', err);
      }
    }
  } catch (err) {
    console.error('[SW] Sync failed', err);
  }
}

/**
 * Message handler for client communication
 */
self.addEventListener('message', (event) => {
  console.log('[SW] Message received:', event.data);

  if (event.data && event.data.type === 'SKIP_WAITING') {
    self.skipWaiting();
  }

  if (event.data && event.data.type === 'QUEUE_NOTIFICATION') {
    queueOfflineNotification(event.data.payload);
  }
});

/**
 * Queue notification for offline delivery
 */
async function queueOfflineNotification(payload) {
  try {
    const cache = await caches.open(NOTIFICATION_CACHE);
    const request = new Request('/api/notifications/queue', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });

    const response = new Response(JSON.stringify({ queued: true }), {
      status: 202,
      headers: { 'Content-Type': 'application/json' },
    });

    await cache.put(request, response);
    console.log('[SW] Notification queued for offline delivery');
  } catch (err) {
    console.error('[SW] Failed to queue offline notification', err);
  }
}

console.log('[SW] Service worker loaded successfully');
