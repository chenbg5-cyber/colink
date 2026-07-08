const SW_VERSION = 5;
let pendingText = null;

self.addEventListener('install', () => self.skipWaiting());

self.addEventListener('activate', (e) => {
  e.waitUntil(
    caches.keys().then(keys => Promise.all(keys.map(k => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

function extractText(urlStr) {
  const qIdx = urlStr.indexOf('?');
  if (qIdx === -1) return null;
  const query = urlStr.substring(qIdx + 1);
  for (const key of ['shared_text', 't']) {
    const match = query.match(new RegExp(key + '=(.+)'));
    if (match) {
      try { return decodeURIComponent(match[1]); } catch(e) { return match[1]; }
    }
  }
  return null;
}

self.addEventListener('fetch', (event) => {
  if (event.request.mode === 'navigate') {
    const text = extractText(event.request.url);
    if (text) {
      pendingText = text;
      self.clients.matchAll({ type: 'window' }).then(clients => {
        clients.forEach(c => c.postMessage({ type: 'shared_text', text: pendingText }));
      });
    }
  }
});

self.addEventListener('message', (event) => {
  if (event.data === 'get_pending') {
    if (pendingText) {
      event.source.postMessage({ type: 'shared_text', text: pendingText });
      pendingText = null;
    }
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
