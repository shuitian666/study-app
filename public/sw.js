self.addEventListener('push', event => {
  let payload = {};
  try {
    payload = event.data ? event.data.json() : {};
  } catch {
    payload = {};
  }

  const title = payload.title || '智学助手提醒';
  const options = {
    body: payload.body || '今天还有学习任务待完成。',
    tag: payload.tag || 'study-reminder',
    icon: '/favicon.svg',
    badge: '/favicon.svg',
    data: {
      url: payload.url || '/',
    },
  };

  event.waitUntil(self.registration.showNotification(title, options));
});

self.addEventListener('notificationclick', event => {
  event.notification.close();
  const url = event.notification.data?.url || '/';

  event.waitUntil((async () => {
    const windows = await clients.matchAll({ type: 'window', includeUncontrolled: true });
    for (const client of windows) {
      if ('focus' in client) {
        await client.focus();
        if ('navigate' in client) {
          await client.navigate(url);
        }
        return;
      }
    }
    await clients.openWindow(url);
  })());
});
