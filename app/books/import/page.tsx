import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import Link from 'next/link'
import { ArrowLeft } from 'lucide-react'
import StatementImport from '@/components/books/StatementImport'

export const dynamic = 'force-dynamic'
export const revalidate = 0

export default async function ImportStatementPage() {
  const supabase = createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) redirect('/auth/login')

  return (
    <main className="max-w-xl mx-auto px-4 py-8">
      <Link
        href="/books"
        className="inline-flex items-center gap-1.5 text-sm font-medium text-accent hover:text-accent/80"
      >
        <ArrowLeft className="w-4 h-4" />
        Back to Books
      </Link>

      <div className="mt-3">
        <h1 className="text-2xl font-semibold text-foreground">Import a statement</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Upload a bank statement and I&apos;ll sort every line into the right bucket for you —
          materials, fuel, software, owner draws, and so on — and add them to your books. Sale
          money and ATM cash you already tracked won&apos;t get counted twice.
        </p>
      </div>

      <div className="mt-6">
        <StatementImport />
      </div>

      <p className="mt-6 text-xs text-muted-foreground">
        Your Relay export is a CSV; your Wells Fargo statement is a PDF. Both work. If a few lines
        aren&apos;t obvious, they&apos;ll wait for you on the reconcile screen — nothing gets stuck.
      </p>
    </main>
  )
}
