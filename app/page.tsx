import Link from 'next/link'
import { Armchair, ArrowRight, CheckCircle2 } from 'lucide-react'
import { Button } from '@/components/ui/button'

export default function HomePage() {
  return (
    <div className="min-h-screen flex flex-col">
      {/* Simple top bar */}
      <header className="border-b border-border bg-card">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 h-14 flex items-center justify-between">
          <div className="flex items-center gap-2 font-serif text-xl">
            <Armchair className="w-5 h-5 text-accent" strokeWidth={1.5} />
            FlipWork
          </div>
          <div className="flex items-center gap-3">
            <Link href="/auth/login">
              <Button variant="ghost" size="sm">Log in</Button>
            </Link>
            <Link href="/auth/signup">
              <Button variant="accent" size="sm">Get started</Button>
            </Link>
          </div>
        </div>
      </header>

      {/* Hero */}
      <main className="flex-1 flex items-center justify-center px-4 py-20">
        <div className="max-w-2xl mx-auto text-center space-y-8">
          <div className="space-y-4">
            <h1 className="text-5xl sm:text-6xl text-foreground leading-tight">
              Pick up furniture flipping gigs on your schedule
            </h1>
            <p className="text-lg text-muted-foreground">
              Browse available projects, claim what you want, document your work, and get paid via PayPal. Simple as that.
            </p>
          </div>

          <div className="flex flex-col sm:flex-row gap-3 justify-center">
            <Link href="/auth/signup">
              <Button variant="accent" size="lg" className="w-full sm:w-auto gap-2">
                Start working
                <ArrowRight className="w-4 h-4" />
              </Button>
            </Link>
            <Link href="/auth/login">
              <Button variant="outline" size="lg" className="w-full sm:w-auto">
                Log in
              </Button>
            </Link>
          </div>

          {/* Features */}
          <div className="pt-8 grid sm:grid-cols-3 gap-4 text-left">
            {[
              { title: 'Browse & claim', body: 'See all open gigs and lock one in for yourself.' },
              { title: 'Document & submit', body: 'Check off tasks, add notes, upload your proof photos.' },
              { title: 'Get paid', body: 'Owner reviews and pays you via PayPal. No middleman.' },
            ].map((f) => (
              <div key={f.title} className="card card-body space-y-2">
                <CheckCircle2 className="w-5 h-5 text-accent" />
                <h3 className="font-sans font-semibold text-sm">{f.title}</h3>
                <p className="text-sm text-muted-foreground">{f.body}</p>
              </div>
            ))}
          </div>
        </div>
      </main>

      <footer className="border-t border-border py-6 text-center text-xs text-muted-foreground">
        © {new Date().getFullYear()} FlipWork. All rights reserved.
      </footer>
    </div>
  )
}
