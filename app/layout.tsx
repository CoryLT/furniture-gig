import type { Metadata, Viewport } from 'next'
import { DM_Sans, DM_Serif_Display, DM_Mono } from 'next/font/google'
import BackToTopButton from '@/components/shared/BackToTopButton'
import './globals.css'

const dmSans = DM_Sans({
  subsets: ['latin'],
  variable: '--font-dm-sans',
  display: 'swap',
})

const dmSerif = DM_Serif_Display({
  subsets: ['latin'],
  weight: '400',
  variable: '--font-dm-serif',
  display: 'swap',
})

const dmMono = DM_Mono({
  subsets: ['latin'],
  weight: ['300', '400', '500'],
  variable: '--font-dm-mono',
  display: 'swap',
})

export const metadata: Metadata = {
  metadataBase: new URL('https://myflipwork.com'),
  title: {
    default: 'FlipWork — The marketplace for furniture flippers',
    template: '%s · FlipWork',
  },
  description:
    'The marketplace for furniture flippers. Post gigs, find work, get paid.',
  openGraph: {
    title: 'FlipWork — The marketplace for furniture flippers',
    description:
      'The marketplace for furniture flippers. Post gigs, find work, get paid.',
    url: 'https://myflipwork.com',
    siteName: 'FlipWork',
    type: 'website',
    locale: 'en_US',
    images: [
      {
        url: '/og-image.png',
        width: 1200,
        height: 630,
        alt: 'FlipWork — The marketplace for furniture flippers. Post gigs, find work, get paid.',
      },
    ],
  },
  twitter: {
    card: 'summary_large_image',
    title: 'FlipWork — The marketplace for furniture flippers',
    description:
      'The marketplace for furniture flippers. Post gigs, find work, get paid.',
    images: ['/og-image.png'],
  },
}

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  maximumScale: 5,
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="en" className={`${dmSans.variable} ${dmSerif.variable} ${dmMono.variable}`}>
      <body className="min-h-screen bg-background">
        {children}
        <BackToTopButton />
      </body>
    </html>
  )
}
