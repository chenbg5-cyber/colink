const CACHE_NAME = 'colink-v5';
const ASSETS = [
  './colink.html',
  './manifest.json'
];

self.addEventListener('install', e => {
  e.waitUntil(
    caches.open(CACHE_NAME).then(cache => cache.addAll(ASSETS))
  );
  self.skipWaiting();
});

self.addEventListener('activate', e => {
  e.waitUntil(
    caches.keys().then(keys =>
      Promise.all(keys.filter(k => k !== CACHE_NAME).map(k => caches.delete(k)))
    )
  );
  self.clients.claim();
});

self.addEventListener('fetch', e => {
  e.respondWith(
    fetch(e.request).then(response => {
      const clone = response.clone();
      caches.open(CACHE_NAME).then(cache => cache.put(e.request, clone));
      return response;
    }).catch(() => caches.match(e.request))
  );
});

self.addEventListener('periodicsync', e => {
  if (e.tag === 'birthday-check') {
    e.waitUntil(checkBirthdaysBackground());
  }
});

async function checkBirthdaysBackground() {
  const cache = await caches.open('colink-data');
  const resp = await cache.match('birthdays');
  if (!resp) return;
  const data = await resp.json();
  if (!data.kids || !data.kids.length) return;

  const now = new Date();
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const milestones = [30, 14, 7, 1, 0];
  const labels = { 30: 'בעוד 30 יום', 14: 'בעוד שבועיים', 7: 'בעוד שבוע', 1: 'מחר', 0: 'היום!' };

  for (const kid of data.kids) {
    if (!kid.dob) continue;
    const bday = new Date(kid.dob);
    const thisYear = new Date(now.getFullYear(), bday.getMonth(), bday.getDate());
    if (thisYear < today) thisYear.setFullYear(now.getFullYear() + 1);
    const diff = Math.ceil((thisYear - today) / (1000 * 60 * 60 * 24));

    if (milestones.includes(diff)) {
      const sent = data.sent || {};
      const key = kid.name + '_' + diff + '_' + thisYear.getFullYear();
      if (sent[key]) continue;

      self.registration.showNotification('🎂 יום הולדת ' + kid.name, {
        body: 'יום ההולדת של ' + kid.name + ' ' + labels[diff],
        icon: 'icons/icon-192.png',
        badge: 'icons/icon-192.png',
        tag: key
      });
    }
  }
}

self.addEventListener('notificationclick', e => {
  e.notification.close();
  e.waitUntil(
    clients.matchAll({ type: 'window' }).then(cls => {
      if (cls.length > 0) return cls[0].focus();
      return clients.openWindow('./colink.html');
    })
  );
});
