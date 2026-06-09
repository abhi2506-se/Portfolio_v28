/**
 * app/admin/layout.tsx
 *
 * This layout's metadata OVERRIDES the root layout's metadata for all /admin/*
 * pages. The key override is `manifest: '/admin-manifest.json'` — this is
 * what tells iOS to use the admin-specific manifest when the user visits any
 * /admin/* page and taps "Add to Home Screen".
 *
 * Because we removed the hardcoded <link rel="manifest" href="/manifest.json">
 * from app/layout.tsx's <head>, Next.js now correctly injects ONLY the admin
 * manifest link on admin pages (instead of both, with the root one winning).
 *
 * iOS PWA install flow on /admin/dashboard:
 *   1. iOS reads <link rel="manifest" href="/admin-manifest.json">   ← this layout
 *   2. Fetches admin-manifest.json → start_url: "/admin", scope: "/admin"
 *   3. Installs PWA with correct start_url → opens /admin on launch  ✓
 *   4. Wakes admin-sw.js (scope "/admin") for push delivery          ✓
 */
import type { Metadata, Viewport } from 'next'
import { Suspense } from 'react'

export const metadata: Metadata = {
  title: 'Admin | Portfolio CMS',
  description: 'Portfolio admin panel',
  robots: { index: false, follow: false },

  // ── Manifest — the ONLY manifest link that will appear on /admin/* pages ──
  // This works because app/layout.tsx no longer hardcodes <link rel="manifest">
  manifest: '/admin-manifest.json',

  // ── iOS "Add to Home Screen" PWA meta ────────────────────────────────────
  // Next.js injects these as apple-mobile-web-app-* meta tags
  appleWebApp: {
    capable:         true,
    title:           'Portfolio Admin',
    statusBarStyle:  'black-translucent',
    startupImage:    '/icons/icon-512x512.png',
  },

  // ── Apple touch icons for admin home screen icon ──────────────────────────
  // These override the root layout's icon declarations for /admin/* pages
  icons: {
    apple: [
      { url: '/icons/icon-192x192.png', sizes: '192x192', type: 'image/png' },
      { url: '/icons/icon-180x180.png', sizes: '180x180', type: 'image/png' },
      { url: '/icons/icon-152x152.png', sizes: '152x152', type: 'image/png' },
    ],
  },
}

export const viewport: Viewport = {
  themeColor:    '#dc2626',   // Red — visually distinct from main portfolio
  width:         'device-width',
  initialScale:  1,
  maximumScale:  1,
  userScalable:  false,
}

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  return (
    <Suspense>
      {children}
    </Suspense>
  )
}
