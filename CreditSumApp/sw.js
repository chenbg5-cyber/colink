const SW_VERSION = 3;
let pendingText = null;

self.addEventListener('install', () => self.skipWaiting());

self.addEventListener('activate', (e) => {
  e.waitUntil(
    caches.keys().then(keys => Promise.all(keys.map(k => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', (event) => {
  const url = new URL(event.request.url);

  if (event.request.mode === 'navigate' && url.searchParams.has('shared_text')) {
    pendingText = url.searchParams.get('shared_text');
    self.clients.matchAll({ type: 'window' }).then(clients => {
      clients.forEach(c => c.postMessage({ type: 'shared_text', text: pendingText }));
    });
  }
});

self.addEventListener('message', (event) => {
  if (event.data === 'get_pending') {
    event.source.postMessage({ type: 'shared_text', text: pendingText });
    pendingText = null;
  }
});

self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  event.waitUntil(
    self.clients.matchAll({ type: 'window' }).then((clients) => {
      for (const client of clients) {
        if ('focus' in client) return client.focus();
      }
      return self.clients.openWindow('./');
    })
  );
});
