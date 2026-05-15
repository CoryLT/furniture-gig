import Link from 'next/link'
import { Button } from '@/components/ui/button'
import { Armchair } from 'lucide-react'

export default function NotFound() {
  return (
    <div className="min-h-screen flex flex-col items-center justify-center px-4 text-center space-y-6">
      <div className="space-y-2">
        <Armchair className="w-12 h-12 text-accent mx-auto" strokeWidth={1} />
        <h1 className="text-4xl text-foreground">404</h1>
        <p className="text-muted-foreground">This page doesn&apos;t exist.</p>
      </div>
      <div className="flex gap-3">
        <Link href="/gigs">
          <Button variant="accent">Browse gigs</Button>
        </Link>
        <Link href="/">
          <Button variant="outline">Home</Button>
        </Link>
      </div>
    </div>
  )
}
