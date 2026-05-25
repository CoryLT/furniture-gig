import { createClient } from '@/lib/supabase/server'
import Link from 'next/link'
import { Armchair } from 'lucide-react'

/**
 * Renders a single legal agreement by title. Pulls the most recent
 * ACTIVE version from the `legal_agreements` table.
 *
 * If no active version exists in the DB, shows a friendly fallback
 * so the page never 404s during deploys / migrations.
 */
export default async function LegalDocPage({ title }: { title: string }) {
  const supabase = createClient()

  // Cast through `any` because Supabase types don't include the
  // legal_agreements schema here (matches existing codebase pattern).
  const { data: agreement } = (await supabase
    .from('legal_agreements')
    .select('title, version, content, updated_at')
    .eq('title', title)
    .eq('active', true)
    .order('created_at', { ascending: false })
    .limit(1)
    .single()) as {
    data: {
      title: string
      version: string
      content: string
      updated_at: string
    } | null
  }

  return (
    <div className="min-h-screen bg-background">
      {/* Simple top bar — works for logged-out viewers too */}
      <header className="border-b border-border bg-card">
        <div className="max-w-3xl mx-auto px-4 py-4 flex items-center justify-between">
          <Link href="/" className="inline-flex items-center gap-2 font-serif text-xl text-foreground">
            <Armchair className="w-5 h-5 text-accent" strokeWidth={1.5} />
            FlipWork
          </Link>
          <nav className="text-sm text-muted-foreground flex gap-4">
            <Link href="/legal/terms" className="hover:text-foreground">Terms</Link>
            <Link href="/legal/privacy" className="hover:text-foreground">Privacy</Link>
          </nav>
        </div>
      </header>

      <main className="max-w-3xl mx-auto px-4 py-10">
        {agreement ? (
          <>
            <div className="mb-6">
              <h1 className="font-serif text-3xl text-foreground">{agreement.title}</h1>
              <p className="text-xs text-muted-foreground font-mono mt-1">
                Version {agreement.version}
              </p>
            </div>
            <article className="card">
              <div className="card-body">
                <pre className="text-sm text-foreground whitespace-pre-wrap font-sans leading-relaxed">
                  {agreement.content}
                </pre>
              </div>
            </article>
          </>
        ) : (
          <div className="card">
            <div className="card-body text-center py-12">
              <h1 className="font-serif text-2xl text-foreground mb-2">{title}</h1>
              <p className="text-muted-foreground">
                This document isn&apos;t available right now. Please check back soon.
              </p>
            </div>
          </div>
        )}
      </main>
    </div>
  )
}
