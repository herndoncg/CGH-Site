// Service worker for the CGH app. Its only jobs: let the app be installed, and show lead alerts.
self.addEventListener('install', () => self.skipWaiting());
self.addEventListener('activate', (e) => e.waitUntil(self.clients.claim()));
self.addEventListener('fetch', () => {}); // no offline copy: the app always shows live data
self.addEventListener('push', (e) => {
  let d = {}; try { d = e.data.json(); } catch (err) {}
  e.waitUntil(self.registration.showNotification(d.title || 'CGH Operations', { body: d.body || '', icon: '/android-chrome-192x192.png', badge: '/android-chrome-192x192.png', data: { url: d.url || '/app/' } }));
});
self.addEventListener('notificationclick', (e) => {
  e.notification.close();
  const url = (e.notification.data && e.notification.data.url) || '/app/';
  e.waitUntil(self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then((list) => { for (const c of list) if (c.url.includes('/app') && 'focus' in c) return c.focus(); return self.clients.openWindow(url); }));
});
