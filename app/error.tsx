'use client'

import { useEffect } from 'react'
import { Button } from '@/components/ui/button'
import { Armchair } from 'lucide-react'

export default function Error({
  error,
  reset,
}: {
  error: Error & { digest?: string }
  reset: () => void
}) {
  useEffect(() => {
    console.error(error)
  }, [error])

  return (
    <div className="min-h-screen flex flex-col items-center justify-center px-4 text-center space-y-6">
      <div className="space-y-2">
        <Armchair className="w-12 h-12 text-muted-foreground mx-auto" strokeWidth={1} />
        <h2 className="text-2xl text-foreground">Something went wrong</h2>
        <p className="text-sm text-muted-foreground max-w-sm">
          An unexpected error occurred. Try refreshing the page, or go back and try again.
        </p>
      </div>
      <div className="flex gap-3">
        <Button variant="accent" onClick={reset}>Try again</Button>
        <Button variant="outline" onClick={() => window.history.back()}>Go back</Button>
      </div>
    </div>
  )
}
