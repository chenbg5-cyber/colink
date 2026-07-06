self.addEventListener('install', () => self.skipWaiting());
self.addEventListener('activate', (e) => e.waitUntil(self.clients.claim()));

self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  event.waitUntil(
    self.clients.matchAll({ type: 'window' }).then((clients) => {
      for (const client of clients) {
        if (client.url.includes('credit-tracker') && 'focus' in client) {
          return client.focus();
        }
      }
      return self.clients.openWindow('./credit-tracker.html');
    })
  );
});
