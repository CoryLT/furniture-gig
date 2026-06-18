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
  applicationName: 'FlipWork',
  manifest: '/manifest.webmanifest',
  appleWebApp: {
    capable: true,
    title: 'FlipWork',
    statusBarStyle: 'default',
  },
  title: {
    default: 'FlipWork — Flip furniture, build your empire',
    template: '%s · FlipWork',
  },
  description:
    "Turn flipping into a game you'll actually play. Track every dollar from buy to sold, climb the ranks, and watch your real profit grow. Free to start.",
  openGraph: {
    title: 'FlipWork — Flip furniture, build your empire',
    description:
      "Turn flipping into a game you'll actually play. Track every dollar from buy to sold, climb the ranks, and watch your real profit grow. Free to start.",
    url: 'https://myflipwork.com',
    siteName: 'FlipWork',
    type: 'website',
    locale: 'en_US',
    images: [
      {
        url: '/og-image.png',
        width: 1200,
        height: 630,
        alt: 'FlipWork — flip furniture, build your empire. Track every flip and climb the ranks.',
      },
    ],
  },
  twitter: {
    card: 'summary_large_image',
    title: 'FlipWork — Flip furniture, build your empire',
    description:
      "Turn flipping into a game you'll actually play. Track every dollar from buy to sold, climb the ranks, and watch your real profit grow. Free to start.",
    images: ['/og-image.png'],
  },
}

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  maximumScale: 5,
  themeColor: '#f9f8f6',
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="en" suppressHydrationWarning className={`${dmSans.variable} ${dmSerif.variable} ${dmMono.variable}`}>
      <body className="min-h-screen bg-background">
        <script
          dangerouslySetInnerHTML={{
            __html: `try{var t=localStorage.getItem('theme');if(t==='dark'||(!t&&window.matchMedia('(prefers-color-scheme: dark)').matches)){document.documentElement.classList.add('dark')}}catch(e){}`,
          }}
        />
        {children}
        <BackToTopButton />
      </body>
    </html>
  )
}
