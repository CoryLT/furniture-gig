import { redirect } from 'next/navigation'
import Link from 'next/link'
import {
  Camera,
  Hammer,
  DollarSign,
  LineChart,
  Receipt,
  Users,
  Trophy,
  Wallet,
  MessageCircle,
} from 'lucide-react'
import { createClient } from '@/lib/supabase/server'
import PublicTopBar from '@/components/shared/PublicTopBar'
import { Button } from '@/components/ui/button'
import AnimatedHero from '@/components/landing/AnimatedHero'

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
    redirect('/play')
  }

  // Founding member counter (flippers only — the worker side is retired).
  const { data: foundingRaw } = await supabase.rpc('founding_member_counts')
  const founding = (foundingRaw as Array<{
    workers_taken: number
    flippers_taken: number
    cap: number
  }> | null)?.[0]
  const flippersTaken = founding?.flippers_taken ?? 0
  const cap = founding?.cap ?? 25
  const flipperSpotsLeft = Math.max(0, cap - flippersTaken)

  return (
    <div className="min-h-screen flex flex-col bg-background">
      <PublicTopBar current={null} />

      <main className="flex-1">
        {/* HERO (animated) */}
        <AnimatedHero foundingSpotsLeft={flipperSpotsLeft} />

        {/* HOW IT WORKS — the core loop */}
        <section id="how" className="border-t border-border bg-card scroll-mt-20">
          <div className="max-w-6xl mx-auto px-4 sm:px-6 py-16 sm:py-20">
            <div className="text-center mb-12">
              <h2 className="font-serif text-3xl sm:text-4xl text-foreground mb-3">
                How FlipWork works
              </h2>
              <p className="text-muted-foreground">
                Buy it. Clean it up. Sell it. See your profit. That simple.
              </p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              <Step
                number="1"
                icon={<Camera className="w-6 h-6" strokeWidth={1.5} />}
                title="Log what you grab"
                body="Add an item and what you paid for it — thrift store, estate sale, marketplace, wherever — then snap a photo. It lands in your pipeline and starts tracking its own cost."
              />
              <Step
                number="2"
                icon={<Hammer className="w-6 h-6" strokeWidth={1.5} />}
                title="Get it ready, track every cost"
                body="Cleaning supplies, parts, shipping, repairs, a hand you paid to help — log it all as you go. Snap a receipt and split it across items. Your true cost adds up by itself."
              />
              <Step
                number="3"
                icon={<DollarSign className="w-6 h-6" strokeWidth={1.5} />}
                title="Sell it, see your profit"
                body="Sell it wherever you sell — eBay, Facebook, in person — then mark it sold and enter the price. Your profit and cash-tied-up update instantly, and your lifetime profit climbs you up the ranks."
              />
            </div>
          </div>
        </section>

        {/* WHAT YOU GET */}
        <section className="border-t border-border">
          <div className="max-w-6xl mx-auto px-4 sm:px-6 py-16 sm:py-20">
            <div className="text-center mb-12">
              <h2 className="font-serif text-3xl sm:text-4xl text-foreground mb-3">
                Everything your flip needs, in one place
              </h2>
              <p className="text-muted-foreground">
                No spreadsheets. No shoebox of receipts. No accounting degree.
              </p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <Feature
                icon={<LineChart className="w-6 h-6" strokeWidth={1.5} />}
                title="A pipeline that shows the money"
                body="Watch every piece move from Sourced to Sold, with real profit and how much cash you have frozen in unsold inventory — always up to date."
              />
              <Feature
                icon={<Receipt className="w-6 h-6" strokeWidth={1.5} />}
                title="Books that do themselves"
                body="A real double-entry ledger under the hood, but you'll never feel it. Scan receipts, reconcile your bank feed, and see clean numbers without the headache."
              />
              <Feature
                icon={<Users className="w-6 h-6" strokeWidth={1.5} />}
                title="Your crew, handled"
                body="Keep a private roster with ratings and 'would I rehire' notes. Pay folks however you already do — FlipWork tracks each person's total and flags 1099s automatically."
              />
              <Feature
                icon={<Trophy className="w-6 h-6" strokeWidth={1.5} />}
                title="A game you'll actually want to play"
                body="Ranks, scores, and a 'Needs you' board that points straight at the pieces costing you money — so the boring stuff feels like leveling up."
              />
            </div>

            {/* Trust line */}
            <div className="mt-8 card p-6 sm:p-8 flex flex-col sm:flex-row items-start gap-4">
              <div className="inline-flex items-center justify-center w-12 h-12 rounded-lg bg-accent/10 text-accent shrink-0">
                <Wallet className="w-6 h-6" strokeWidth={1.5} />
              </div>
              <div>
                <h3 className="font-serif text-xl text-foreground mb-1">
                  We never touch your money
                </h3>
                <p className="text-muted-foreground leading-relaxed">
                  Pay your help however you already do — Cash App, Venmo, Zelle, cash.
                  FlipWork never sits between you and your money or takes a cut. It just
                  keeps the records straight and the taxman happy.
                </p>
              </div>
            </div>
          </div>
        </section>

        {/* FOUNDER NOTE */}
        <section className="border-t border-border">
          <div className="max-w-3xl mx-auto px-4 sm:px-6 py-16 sm:py-20">
            <div className="card p-8 sm:p-10">
              <div className="flex flex-col sm:flex-row gap-6 sm:gap-8 items-start">
                {/* Photo */}
                <div className="flex-shrink-0 mx-auto sm:mx-0">
                  <img
                    src="/cory-founder.jpg"
                    alt="Cory, founder of FlipWork"
                    width={120}
                    height={120}
                    className="w-28 h-28 sm:w-32 sm:h-32 rounded-full object-cover border-2 border-border shadow-sm"
                  />
                </div>

                {/* Text */}
                <div className="flex-1 min-w-0">
                  <h2 className="font-serif text-2xl sm:text-3xl text-foreground mb-5 text-center sm:text-left">
                    Why I built FlipWork
                  </h2>
                  <div className="space-y-4 text-muted-foreground leading-relaxed">
                    <p>I'm Cory. I flip furniture in Raleigh, NC.</p>
                    <p>
                      For years I ran my whole flip out of my head, a notes app, and a
                      drawer full of receipts. I never really knew which pieces made
                      money, how much cash I had tied up in stuff that wasn't selling, or
                      what I'd paid my help come tax time.
                    </p>
                    <p>
                      So I built the tool I wished I had — one place to track every piece
                      from curb to sold, see my true profit, manage the people I hire, and
                      keep books that don't make me want to quit. It turned the messy parts
                      of flipping into something I can actually see and steer. Furniture,
                      thrift finds, eBay hauls — whatever you flip, if you buy low and sell
                      high, I built this for you.
                    </p>
                  </div>
                </div>
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

        {/* FINAL CTA */}
        <section className="border-t border-border bg-card">
          <div className="max-w-3xl mx-auto px-4 sm:px-6 py-16 sm:py-20 text-center">
            <h2 className="font-serif text-3xl sm:text-4xl text-foreground mb-3">
              Ready to run your flips like a business?
            </h2>
            <p className="text-muted-foreground mb-8">
              Sign up takes less than a minute. It's free to start.
            </p>
            <div className="flex flex-col sm:flex-row gap-3 justify-center">
              <Link href="/auth/signup">
                <Button variant="accent" size="lg" className="w-full sm:w-auto">
                  Start flipping free
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

function Feature({
  icon,
  title,
  body,
}: {
  icon: React.ReactNode
  title: string
  body: string
}) {
  return (
    <div className="card p-6 sm:p-8">
      <div className="inline-flex items-center justify-center w-12 h-12 rounded-lg bg-accent/10 text-accent mb-4">
        {icon}
      </div>
      <h3 className="font-serif text-2xl text-foreground mb-2">{title}</h3>
      <p className="text-muted-foreground leading-relaxed">{body}</p>
    </div>
  )
}
