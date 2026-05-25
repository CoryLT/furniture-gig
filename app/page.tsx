import { redirect } from 'next/navigation'
import Link from 'next/link'
import { Armchair, Hammer, DollarSign, CheckCircle2, ShoppingBag, MessageCircle, Sparkle } from 'lucide-react'
import { createClient } from '@/lib/supabase/server'
import PublicTopBar from '@/components/shared/PublicTopBar'
import { Button } from '@/components/ui/button'

// Logged-in users go straight to their dashboard.
// Logged-out users see the marketing landing page.
export const dynamic = 'force-dynamic'
export const revalidate = 0

export default async function HomePage() {
  const supabase = createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (user) {
    redirect('/home')
  }

  // Founding member counts for the landing-page counter.
  // We call a SECURITY DEFINER function so anonymous visitors can see
  // counts without exposing the underlying profile tables.
  const { data: foundingRaw } = await supabase.rpc('founding_member_counts')
  const founding = (foundingRaw as Array<{
    workers_taken: number
    flippers_taken: number
    cap: number
  }> | null)?.[0]
  const workersTaken = founding?.workers_taken ?? 0
  const flippersTaken = founding?.flippers_taken ?? 0
  const cap = founding?.cap ?? 25
  const workerSpotsLeft = Math.max(0, cap - workersTaken)
  const flipperSpotsLeft = Math.max(0, cap - flippersTaken)
  const showFoundingCounter = workerSpotsLeft > 0 || flipperSpotsLeft > 0

  return (
    <div className="min-h-screen flex flex-col bg-background">
      <PublicTopBar current={null} />

      <main className="flex-1">
        {/* HERO */}
        <section className="relative overflow-hidden">
          <div className="max-w-6xl mx-auto px-4 sm:px-6 pt-16 pb-20 sm:pt-24 sm:pb-28 text-center">
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-accent/10 text-accent text-xs font-medium font-mono mb-6">
              <Armchair className="w-3.5 h-3.5" strokeWidth={2} />
              FURNITURE FLIPPING, MADE EASY
            </div>
            <h1 className="font-serif text-4xl sm:text-6xl leading-tight tracking-tight text-foreground mb-5">
              Hire a flipper.
              <br />
              <span className="text-accent">Or become one.</span>
            </h1>
            <p className="max-w-2xl mx-auto text-base sm:text-lg text-muted-foreground mb-8 leading-relaxed">
              FlipWork connects people who have furniture to flip with skilled
              workers who do the flipping. Post a project, pick a worker, get
              a refinished piece. Or sign up to work and get paid for projects
              near you.
            </p>
            <div className="flex flex-col sm:flex-row gap-3 justify-center">
              <Link href="/auth/signup">
                <Button variant="accent" size="lg" className="w-full sm:w-auto">
                  Sign up free
                </Button>
              </Link>
              <Link href="/marketplace">
                <Button variant="outline" size="lg" className="w-full sm:w-auto">
                  Browse the marketplace
                </Button>
              </Link>
            </div>

            {/* Founding member counter */}
            {showFoundingCounter && (
              <div className="mt-8 flex justify-center">
                <div className="inline-flex items-center gap-3 px-4 py-2.5 rounded-full bg-amber-50 border border-amber-200">
                  <Sparkle className="w-4 h-4 fill-amber-500 stroke-amber-700" strokeWidth={1.5} />
                  <span className="text-xs sm:text-sm font-medium text-amber-900">
                    {workerSpotsLeft > 0 && flipperSpotsLeft > 0 ? (
                      <>
                        {workerSpotsLeft} worker + {flipperSpotsLeft} flipper
                        founding spots left
                      </>
                    ) : workerSpotsLeft > 0 ? (
                      <>{workerSpotsLeft} founding worker spots left</>
                    ) : (
                      <>{flipperSpotsLeft} founding flipper spots left</>
                    )}
                  </span>
                </div>
              </div>
            )}
          </div>
        </section>

        {/* HOW IT WORKS */}
        <section className="border-t border-border bg-card">
          <div className="max-w-6xl mx-auto px-4 sm:px-6 py-16 sm:py-20">
            <div className="text-center mb-12">
              <h2 className="font-serif text-3xl sm:text-4xl text-foreground mb-3">
                How FlipWork works
              </h2>
              <p className="text-muted-foreground">
                Three steps. No middlemen. Get paid fast.
              </p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              <Step
                number="1"
                icon={<Hammer className="w-6 h-6" strokeWidth={1.5} />}
                title="Post or apply"
                body="Have furniture? Post a gig with photos, a budget, and a checklist. Want work? Browse gigs near you and apply to ones that match your skills."
              />
              <Step
                number="2"
                icon={<CheckCircle2 className="w-6 h-6" strokeWidth={1.5} />}
                title="Match and work"
                body="Posters pick the worker they want. Workers check off tasks and upload photos as they go. Everyone stays in the loop with built-in messaging."
              />
              <Step
                number="3"
                icon={<DollarSign className="w-6 h-6" strokeWidth={1.5} />}
                title="Get paid"
                body="When the work is approved, payment is released through Stripe straight to the worker's bank. No chasing invoices. No PayPal back-and-forth."
              />
            </div>
          </div>
        </section>

        {/* TWO-SIDED PITCH */}
        <section className="border-t border-border">
          <div className="max-w-6xl mx-auto px-4 sm:px-6 py-16 sm:py-20">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {/* For posters */}
              <div className="card p-8">
                <div className="inline-flex items-center justify-center w-12 h-12 rounded-lg bg-accent/10 text-accent mb-4">
                  <Armchair className="w-6 h-6" strokeWidth={1.5} />
                </div>
                <h3 className="font-serif text-2xl text-foreground mb-2">
                  Got a piece to flip?
                </h3>
                <p className="text-muted-foreground mb-6 leading-relaxed">
                  Skip the weekend project. Post your gig, set your budget, and
                  let a skilled flipper handle the sanding, staining, and
                  finishing. You approve the final look before any money moves.
                </p>
                <Link href="/auth/signup?as=flipper">
                  <Button variant="default" size="default">
                    Post a gig
                  </Button>
                </Link>
              </div>

              {/* For workers */}
              <div className="card p-8">
                <div className="inline-flex items-center justify-center w-12 h-12 rounded-lg bg-accent/10 text-accent mb-4">
                  <Hammer className="w-6 h-6" strokeWidth={1.5} />
                </div>
                <h3 className="font-serif text-2xl text-foreground mb-2">
                  Want to flip for money?
                </h3>
                <p className="text-muted-foreground mb-6 leading-relaxed">
                  Turn your skills into income. Browse local gigs, apply to the
                  ones you like, and get paid through Stripe when the work is
                  approved. Build a profile and a portfolio over time.
                </p>
                <Link href="/auth/signup?as=worker">
                  <Button variant="default" size="default">
                    Find work
                  </Button>
                </Link>
              </div>
            </div>
          </div>
        </section>

        {/* FOUNDER NOTE */}
        <section className="border-t border-border">
          <div className="max-w-3xl mx-auto px-4 sm:px-6 py-16 sm:py-20">
            <div className="card p-8 sm:p-10">
              <h2 className="font-serif text-2xl sm:text-3xl text-foreground mb-5">
                Why I built FlipWork
              </h2>
              <div className="space-y-4 text-muted-foreground leading-relaxed">
                <p>
                  I'm Cory. I flip furniture in Raleigh, NC.
                </p>
                <p>
                  I built FlipWork because I got tired of running my business
                  on Facebook Marketplace and Craigslist. Facebook is
                  impossible to escape but full of scams. Craigslist works,
                  but hiring help off it feels sketchy every single time.
                </p>
                <p>
                  So I built somewhere better — a real place for buyers,
                  sellers, and the workers who do the flipping. It's brand
                  new, so we're still filling in. But every listing, every
                  gig, and every dollar paid is real.
                </p>
              </div>
              <div className="mt-6 pt-6 border-t border-border">
                <Link
                  href="/support"
                  className="inline-flex items-center gap-2 text-sm font-medium text-foreground hover:text-accent transition"
                >
                  <MessageCircle className="w-4 h-4" strokeWidth={1.75} />
                  Questions? Our support team is one click away.
                </Link>
              </div>
            </div>
          </div>
        </section>

        {/* MARKETPLACE TEASER */}
        <section className="border-t border-border bg-card">
          <div className="max-w-6xl mx-auto px-4 sm:px-6 py-16 sm:py-20 text-center">
            <div className="inline-flex items-center justify-center w-12 h-12 rounded-lg bg-accent/10 text-accent mb-4">
              <ShoppingBag className="w-6 h-6" strokeWidth={1.5} />
            </div>
            <h2 className="font-serif text-3xl sm:text-4xl text-foreground mb-3">
              Plus a marketplace
            </h2>
            <p className="max-w-xl mx-auto text-muted-foreground mb-6 leading-relaxed">
              Looking to buy a finished piece? Or sell one of yours?
              FlipWork has a public marketplace where flippers list their
              completed work for sale.
            </p>
            <Link href="/marketplace">
              <Button variant="outline" size="default">
                Browse the marketplace
              </Button>
            </Link>
          </div>
        </section>

        {/* FINAL CTA */}
        <section className="border-t border-border">
          <div className="max-w-3xl mx-auto px-4 sm:px-6 py-16 sm:py-20 text-center">
            <h2 className="font-serif text-3xl sm:text-4xl text-foreground mb-3">
              Ready to get started?
            </h2>
            <p className="text-muted-foreground mb-8">
              Sign up takes less than a minute. It's free.
            </p>
            <div className="flex flex-col sm:flex-row gap-3 justify-center">
              <Link href="/auth/signup">
                <Button variant="accent" size="lg" className="w-full sm:w-auto">
                  Sign up free
                </Button>
              </Link>
              <Link href="/auth/login">
                <Button variant="ghost" size="lg" className="w-full sm:w-auto">
                  I already have an account
                </Button>
              </Link>
            </div>
          </div>
        </section>
      </main>

      <footer className="border-t border-border py-6 text-center text-xs text-muted-foreground">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 flex flex-col sm:flex-row gap-3 justify-between items-center">
          <span>© {new Date().getFullYear()} FlipWork. All rights reserved.</span>
          <div className="flex gap-4">
            <Link href="/legal/terms" className="hover:text-foreground">
              Terms
            </Link>
            <Link href="/legal/privacy" className="hover:text-foreground">
              Privacy
            </Link>
          </div>
        </div>
      </footer>
    </div>
  )
}

function Step({
  number,
  icon,
  title,
  body,
}: {
  number: string
  icon: React.ReactNode
  title: string
  body: string
}) {
  return (
    <div className="card p-6">
      <div className="flex items-center gap-3 mb-3">
        <div className="inline-flex items-center justify-center w-9 h-9 rounded-full bg-accent text-accent-foreground font-mono text-sm font-semibold">
          {number}
        </div>
        <div className="text-accent">{icon}</div>
      </div>
      <h3 className="font-serif text-xl text-foreground mb-2">{title}</h3>
      <p className="text-sm text-muted-foreground leading-relaxed">{body}</p>
    </div>
  )
}
