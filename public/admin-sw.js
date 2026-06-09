// ─── Portfolio Admin PWA — Dedicated Service Worker (scope: /admin) ──────────
// VERSION: 3  ← bumped: fixed push notification handling
//
// CRITICAL FIX: The previous version had a push handler that only handled
// the push event but could fail silently on some devices. This version:
//   1. Uses event.waitUntil() with a proper async IIFE
//   2. Handles both JSON payloads and raw text payloads
//   3. Falls back gracefully if event.data is empty
//   4. Properly awaits showNotification (required on iOS 16.4+)
//   5. Handles notificationclick to open the correct admin URL

const CACHE_NAME = 'admin-panel-v3'

const PRECACHE_URLS = [
  '/admin-manifest.json',
  '/icons/icon-192x192.png',
  '/icons/icon-512x512.png',
]

// ── Install ──────────────────────────────────────────────────────────────────
self.addEventListener('install', (event) => {
  event.waitUntil(
    caches
      .open(CACHE_NAME)
      .then((cache) => cache.addAll(PRECACHE_URLS).catch(() => {}))
      .then(() => self.skipWaiting())
  )
})

// ── Activate ──────────────────────────────────────────────────────────────────
self.addEventListener('activate', (event) => {
  event.waitUntil(
    Promise.all([
      // Delete ALL old caches (including old admin-panel-v2)
      caches.keys().then((keys) =>
        Promise.all(keys.filter((k) => k !== CACHE_NAME).map((k) => caches.delete(k)))
      ),
      // Take control of all open clients immediately
      self.clients.claim(),
    ])
  )
})

// ── Fetch: Network-first for all admin + API routes ──────────────────────────
self.addEventListener('fetch', (event) => {
  const { request } = event
  const url = new URL(request.url)

  if (request.method !== 'GET' || url.origin !== self.location.origin) return
  if (!url.pathname.startsWith('/admin') && !url.pathname.startsWith('/api/')) return

  // API routes: network-only (never cache auth/push endpoints)
  if (url.pathname.startsWith('/api/')) {
    event.respondWith(fetch(request))
    return
  }

  // Admin pages: network-first, cache fallback for offline
  event.respondWith(
    fetch(request)
      .then((res) => {
        if (res.ok) {
          caches.open(CACHE_NAME).then((c) => c.put(request, res.clone()))
        }
        return res
      })
      .catch(() =>
        caches.match(request).then((cached) => cached || Response.error())
      )
  )
})

// ── Push ─────────────────────────────────────────────────────────────────────
// iOS 16.4+ and Android Chrome requirements:
//   ✓ event.waitUntil wraps the entire async operation
//   ✓ showNotification is awaited inside waitUntil
//   ✓ No unsupported options (no `actions`, `vibrate`, `requireInteraction`)
//   ✓ renotify:true ensures repeat notifications with same tag still appear
self.addEventListener('push', (event) => {
  event.waitUntil(
    (async () => {
      // Parse payload — web-push sends JSON, fallback to plain text
      let payload = {}
      try {
        if (event.data) {
          payload = event.data.json()
        }
      } catch {
        try {
          const text = event.data ? event.data.text() : ''
          payload = { title: 'Portfolio Admin', body: text }
        } catch {
          payload = { title: 'Portfolio Admin', body: 'New notification' }
        }
      }

      const {
        title = 'Portfolio Admin',
        body  = 'You have a new notification',
        icon  = '/icons/icon-192x192.png',
        badge = '/icons/icon-192x192.png',
        tag   = 'admin-notification',
        url   = '/admin/dashboard',
      } = payload

      // MUST await showNotification — iOS closes the SW event loop otherwise
      await self.registration.showNotification(title, {
        body,
        icon,
        badge,
        tag,
        renotify: true,  // Show even if same tag is already displayed
        data: { url },
      })
    })()
  )
})

// ── Notification click ────────────────────────────────────────────────────────
self.addEventListener('notificationclick', (event) => {
  event.notification.close()

  const targetUrl = event.notification.data?.url || '/admin/dashboard'

  event.waitUntil(
    clients
      .matchAll({ type: 'window', includeUncontrolled: true })
      .then((windowClients) => {
        // Focus existing admin window if open
        for (const client of windowClients) {
          if (client.url.includes('/admin') && 'focus' in client) {
            client.navigate(targetUrl)
            client.focus()
            return
          }
        }
        // Open new window
        if (clients.openWindow) return clients.openWindow(targetUrl)
      })
  )
})

// ── Skip-waiting message ──────────────────────────────────────────────────────
self.addEventListener('message', (event) => {
  if (event.data?.type === 'SKIP_WAITING') self.skipWaiting()
})
