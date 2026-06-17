import type { MetadataRoute } from 'next'

// Web App Manifest — makes FlipWork installable on a phone home screen.
// Next.js serves this at /manifest.webmanifest (referenced from app/layout.tsx).
export default function manifest(): MetadataRoute.Manifest {
  return {
    name: 'FlipWork',
    short_name: 'FlipWork',
    description: 'Run your flipping business — jobs, crew, pipeline, and payments in one place.',
    start_url: '/play',
    scope: '/',
    display: 'standalone',
    orientation: 'portrait',
    background_color: '#f9f8f6',
    theme_color: '#f9f8f6',
    icons: [
      {
        src: '/icon-192.png',
        sizes: '192x192',
        type: 'image/png',
        purpose: 'any',
      },
      {
        src: '/icon-512.png',
        sizes: '512x512',
        type: 'image/png',
        purpose: 'any',
      },
    ],
  }
}
