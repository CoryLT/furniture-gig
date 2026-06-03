/* FlipWork service worker — NOTIFICATIONS ONLY.
 * Deliberately has no "fetch" handler, so it never caches or serves
 * pages. That keeps the live site always fresh (no stale-page risk)
 * while still letting the phone receive push notifications.
 */

self.addEventListener('install', () => {
  // Activate this worker right away instead of waiting.
  self.skipWaiting()
})

self.addEventListener('activate', (event) => {
  event.waitUntil(self.clients.claim())
})

// A push arrived from the FlipWork server — show it.
self.addEventListener('push', (event) => {
  let data = {}
  try {
    data = event.data ? event.data.json() : {}
  } catch (e) {
    data = {}
  }

  const title = data.title || 'FlipWork'
  const body = data.body || 'You have a new notification.'
  const url = data.url || '/messages'
  const tag = data.tag || url

  event.waitUntil(
    self.registration.showNotification(title, {
      body,
      tag, // same tag = replaces an older buzz for the same conversation
      icon: '/icon-192.png',
      badge: '/icon-192.png',
      data: { url },
    })
  )
})

// User tapped the notification — open/focus FlipWork at the right page.
self.addEventListener('notificationclick', (event) => {
  event.notification.close()
  const targetUrl =
    (event.notification.data && event.notification.data.url) || '/messages'

  event.waitUntil(
    self.clients
      .matchAll({ type: 'window', includeUncontrolled: true })
      .then((clientList) => {
        for (const client of clientList) {
          if ('focus' in client) {
            client.focus()
            if ('navigate' in client) {
              try {
                client.navigate(targetUrl)
              } catch (e) {
                /* ignore */
              }
            }
            return
          }
        }
        if (self.clients.openWindow) {
          return self.clients.openWindow(targetUrl)
        }
      })
  )
})
