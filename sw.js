importScripts('https://www.gstatic.com/firebasejs/10.12.2/firebase-app-compat.js');
importScripts('https://www.gstatic.com/firebasejs/10.12.2/firebase-messaging-compat.js');

firebase.initializeApp({
  apiKey: "AIzaSyAj8Er3isZdjjgZ1AoV4Dh4pQOExIrtYbU",
  authDomain: "colink-4300f.firebaseapp.com",
  projectId: "colink-4300f",
  storageBucket: "colink-4300f.firebasestorage.app",
  messagingSenderId: "984947335109",
  appId: "1:984947335109:web:68dcdc559e8c92796eb5ac"
});

const messaging = firebase.messaging();
messaging.onBackgroundMessage(payload => {
  const { title, body } = payload.notification || {};
  if (title) {
    self.registration.showNotification(title, {
      body: body || '',
      icon: 'icons/icon-192.png',
      badge: 'icons/icon-192.png'
    });
  }
});

const CACHE_NAME = 'colink-v32';
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
    e.waitUntil(checkAllRemindersBackground());
  }
});

async function checkAllRemindersBackground() {
  await checkBirthdaysBackground();
  await checkEventsBackground();
  await checkCampsBackground();
}

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

async function checkEventsBackground() {
  const cache = await caches.open('colink-data');
  const resp = await cache.match('birthdays');
  if (!resp) return;
  const data = await resp.json();
  if (!data.events || !data.events.length) return;

  const now = new Date();
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const milestones = [7, 2, 0];
  const labels = { 7: 'בעוד שבוע', 2: 'בעוד יומיים', 0: 'היום!' };

  for (const ev of data.events) {
    if (!ev.date) continue;
    const evDate = new Date(ev.date);
    const diff = Math.ceil((evDate - today) / (1000 * 60 * 60 * 24));

    if (milestones.includes(diff)) {
      const sent = data.eventSent || {};
      const key = ev.id + '_' + diff;
      if (sent[key]) continue;

      self.registration.showNotification('📅 ' + ev.title + ' — ' + labels[diff], {
        body: ev.title + (ev.forChild ? ' (' + ev.forChild + ')' : ''),
        icon: 'icons/icon-192.png',
        badge: 'icons/icon-192.png',
        tag: 'event_' + key
      });
    }
  }
}

async function checkCampsBackground() {
  const cache = await caches.open('colink-data');
  const resp = await cache.match('birthdays');
  if (!resp) return;
  const data = await resp.json();
  if (!data.camps || !data.camps.length) return;

  const now = new Date();
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const sent = data.campSent || {};

  for (const c of data.camps) {
    if (!c.fromDate) continue;
    const startDate = new Date(c.fromDate);
    const diff = Math.ceil((startDate - today) / (1000 * 60 * 60 * 24));

    if (diff === 5) {
      const key = c.id + '_start_5';
      if (sent[key]) continue;
      const dateStr = startDate.getDate() + '/' + (startDate.getMonth() + 1);
      self.registration.showNotification('☀ קייטנה מתחילה בעוד 5 ימים', {
        body: c.name + ' (' + c.child + ') מתחילה ב-' + dateStr,
        icon: 'icons/icon-192.png',
        badge: 'icons/icon-192.png',
        tag: 'camp_' + key
      });
    }

    if (c.toDate && c.endTime) {
      const endDate = new Date(c.toDate);
      if (today >= startDate && today <= endDate) {
        const [endH, endM] = c.endTime.split(':').map(Number);
        const endTimeToday = new Date(now.getFullYear(), now.getMonth(), now.getDate(), endH, endM);
        const msUntilEnd = endTimeToday - now;
        const minutesUntilEnd = msUntilEnd / (1000 * 60);
        if (minutesUntilEnd > 0 && minutesUntilEnd <= 60) {
          const key = c.id + '_pickup_' + today.toISOString().split('T')[0];
          if (sent[key]) continue;
          self.registration.showNotification('☀ איסוף מהקייטנה בקרוב', {
            body: c.name + ' (' + c.child + ') מסתיימת בשעה ' + c.endTime + (c.location ? ' · ' + c.location : ''),
            icon: 'icons/icon-192.png',
            badge: 'icons/icon-192.png',
            tag: 'camp_' + key
          });
        }
      }
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
