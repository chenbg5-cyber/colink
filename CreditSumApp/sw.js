const SW_VERSION = 13;

self.addEventListener('install', () => self.skipWaiting());

self.addEventListener('activate', (e) => {
  e.waitUntil(
    caches.keys().then(keys =>
      Promise.all(keys.filter(k => k !== 'pending-charges').map(k => caches.delete(k)))
    ).then(() => self.clients.claim())
  );
});

function extractText(urlStr) {
  const qIdx = urlStr.indexOf('?');
  if (qIdx === -1) return null;
  const query = urlStr.substring(qIdx + 1);
  for (const key of ['shared_text', 't']) {
    const match = query.match(new RegExp(key + '=(.+)'));
    if (match) {
      const raw = match[1].replace(/\+/g, ' ');
      try { return decodeURIComponent(raw); } catch(e) { return raw; }
    }
  }
  return null;
}

self.addEventListener('fetch', (event) => {
  if (event.request.mode === 'navigate') {
    const text = extractText(event.request.url);
    if (text) {
      event.waitUntil(
        caches.open('pending-charges').then(cache =>
          cache.put('/pending/' + Date.now(), new Response(text))
        ).then(() =>
          self.clients.matchAll({ type: 'window' }).then(clients => {
            clients.forEach(c => c.postMessage({ type: 'shared_text', text }));
          })
        )
      );
    }
  }
});

self.addEventListener('message', (event) => {
  if (event.data === 'get_pending') {
    event.waitUntil(
      caches.open('pending-charges').then(cache =>
        cache.keys().then(keys => {
          if (!keys.length) return;
          return Promise.all(keys.map(req =>
            cache.match(req).then(resp => resp.text()).then(text => {
              event.source.postMessage({ type: 'shared_text', text });
              return cache.delete(req);
            })
          ));
        })
      )
    );
  }
});

self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  event.waitUntil(
    self.clients.matchAll({ type: 'window' }).then(clients => {
      for (const client of clients) {
        if ('focus' in client) return client.focus();
      }
      return self.clients.openWindow('./');
    })
  );
});
