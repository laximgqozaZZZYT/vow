/**
 * Service Worker for Web Push Notifications
 * 
 * Requirements: 12.3 - Web Push notification implementation
 */

// Cache name for offline support
const CACHE_NAME = 'vow-v1';

// Install event - cache essential assets
self.addEventListener('install', (event) => {
  console.log('[SW] Installing service worker...');
  self.skipWaiting();
});

// Activate event - clean up old caches
self.addEventListener('activate', (event) => {
  console.log('[SW] Activating service worker...');
  event.waitUntil(
    caches.keys().then((cacheNames) => {
      return Promise.all(
        cacheNames
          .filter((name) => name !== CACHE_NAME)
          .map((name) => caches.delete(name))
      );
    })
  );
  self.clients.claim();
});

// Push event - handle incoming push notifications
self.addEventListener('push', (event) => {
  console.log('[SW] Push notification received');

  let data = {
    title: 'VOW',
    body: '新しい通知があります',
    icon: '/icon-192.png',
    badge: '/badge-72.png',
    tag: 'vow-notification',
    data: {},
  };

  // Parse push data if available
  if (event.data) {
    try {
      const payload = event.data.json();
      data = {
        title: payload.title || data.title,
        body: payload.body || data.body,
        icon: payload.icon || data.icon,
        badge: payload.badge || data.badge,
        tag: payload.tag || data.tag,
        data: payload.data || {},
      };
    } catch (err) {
      console.error('[SW] Error parsing push data:', err);
    }
  }

  // Show notification
  const options = {
    body: data.body,
    icon: data.icon,
    badge: data.badge,
    tag: data.tag,
    data: data.data,
    vibrate: [100, 50, 100],
    actions: [
      {
        action: 'open',
        title: '開く',
      },
      {
        action: 'dismiss',
        title: '閉じる',
      },
    ],
  };

  event.waitUntil(
    self.registration.showNotification(data.title, options)
  );
});

// Notification click event - handle user interaction
self.addEventListener('notificationclick', (event) => {
  console.log('[SW] Notification clicked:', event.action);

  event.notification.close();

  if (event.action === 'dismiss') {
    return;
  }

  // Determine URL to open
  let url = '/dashboard';
  if (event.notification.data && event.notification.data.url) {
    url = event.notification.data.url;
  }

  // Open or focus the app
  event.waitUntil(
    clients.matchAll({ type: 'window', includeUncontrolled: true }).then((clientList) => {
      // Check if app is already open
      for (const client of clientList) {
        if (client.url.includes(self.location.origin) && 'focus' in client) {
          client.navigate(url);
          return client.focus();
        }
      }
      // Open new window if not already open
      if (clients.openWindow) {
        return clients.openWindow(url);
      }
    })
  );
});

// Notification close event - track dismissals
self.addEventListener('notificationclose', (event) => {
  console.log('[SW] Notification closed');
});

// Background sync event (for offline support)
self.addEventListener('sync', (event) => {
  console.log('[SW] Background sync:', event.tag);
  
  if (event.tag === 'sync-habits') {
    event.waitUntil(syncHabits());
  }
});

// Sync habits when back online
async function syncHabits() {
  try {
    // Get pending habit completions from IndexedDB
    // This would be implemented if offline support is needed
    console.log('[SW] Syncing habits...');
  } catch (err) {
    console.error('[SW] Error syncing habits:', err);
  }
}
