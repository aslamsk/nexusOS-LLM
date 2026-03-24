self.addEventListener('install', () => {
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(self.clients.claim());
});

self.addEventListener('message', async (event) => {
  const data = event.data || {};
  if (data.type === 'SHOW_NOTIFICATION') {
    await self.registration.showNotification(data.title || 'Nexus OS', {
      body: data.body || 'A new update is available.',
      icon: '/pwa-192x192.png',
      badge: '/pwa-192x192.png',
      data: data.payload || {}
    });
  }
});

self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  event.waitUntil(clients.openWindow('/'));
});
