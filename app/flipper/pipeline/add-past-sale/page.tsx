import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import Link from 'next/link'
import { ArrowLeft } from 'lucide-react'
import PastSaleForm from './PastSaleForm'

// Always fresh.
export const dynamic = 'force-dynamic'
export const revalidate = 0

export default async function AddPastSalePage() {
  const supabase = createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) redirect('/auth/login')

  return (
    <main className="max-w-xl mx-auto px-4 py-8">
      <Link
        href="/flipper/pipeline"
        className="inline-flex items-center gap-1.5 text-sm font-medium text-accent hover:text-accent/80"
      >
        <ArrowLeft className="w-4 h-4" />
        Back to Pipeline
      </Link>

      <div className="mt-3">
        <h1 className="text-2xl font-semibold text-foreground">Add a past sale</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Punch in flips you already sold. You only need the month it sold — the exact
          day doesn&apos;t matter for your books. Each one is logged to Books on that date.
        </p>
      </div>

      <PastSaleForm me={user.id} />
    </main>
  )
}
