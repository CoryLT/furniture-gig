import Link from 'next/link'
import type { Metadata } from 'next'
import { ArrowLeft } from 'lucide-react'
import InstallGraphic from '@/components/install/InstallGraphic'
import InstallSteps from '@/components/install/InstallSteps'

export const metadata: Metadata = {
  title: 'Add FlipWork to your phone',
  description:
    'Install FlipWork on your phone or computer for a real app icon, full-screen use, and notifications.',
}

export default function InstallPage() {
  return (
    <main className="mx-auto max-w-xl px-4 py-8">
      <Link
        href="/"
        className="inline-flex items-center gap-1.5 text-sm font-medium text-accent hover:text-accent/80"
      >
        <ArrowLeft className="h-4 w-4" />
        Home
      </Link>

      <div className="mt-4 text-center">
        <h1 className="font-serif text-3xl text-foreground">Add FlipWork to your phone</h1>
        <p className="mx-auto mt-2 max-w-md text-sm text-muted-foreground">
          Install it like a real app — a one-tap icon on your home screen, full-screen with no
          browser bars, and the first step to getting buzzed about new messages. It&apos;s free and
          takes about 20 seconds.
        </p>
      </div>

      <div className="mt-8">
        <InstallGraphic />
      </div>

      <div className="mt-10">
        <h2 className="mb-3 text-xs font-medium uppercase tracking-wide text-muted-foreground">
          Step-by-step
        </h2>
        <InstallSteps />
      </div>

      <p className="mt-8 text-center text-xs text-muted-foreground">
        Nothing to download from an app store — FlipWork installs straight from your browser.
      </p>
    </main>
  )
}
