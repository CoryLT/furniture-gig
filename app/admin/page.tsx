import Link from 'next/link'
import { Plus, AlertCircle } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { createClient } from '@/lib/supabase/server'

export const dynamic = 'force-dynamic'
export const revalidate = 0

export default async function AdminDashboard() {
  const supabase = createClient()

  // Count escalated support conversations
  const { count: escalatedCount } = await supabase
    .from('support_conversations')
    .select('id', { count: 'exact', head: true })
    .eq('status', 'escalated')

  const escalated = escalatedCount || 0

  return (
    <div className="space-y-8">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl text-foreground">Dashboard</h1>
          <p className="text-muted-foreground mt-1">FlipWork admin — welcome back.</p>
        </div>
        <Link href="/admin/gigs/new">
          <Button variant="accent" className="gap-2">
            <Plus className="w-4 h-4" />
            New gig
          </Button>
        </Link>
      </div>

      <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <Link href="/admin/gigs" className="card card-body hover:shadow-md transition-shadow">
          <p className="font-semibold text-foreground">Manage Gigs</p>
          <p className="text-sm text-muted-foreground mt-1">Create, edit, and update gig statuses.</p>
        </Link>
        <Link href="/admin/payouts" className="card card-body hover:shadow-md transition-shadow">
          <p className="font-semibold text-foreground">Payouts</p>
          <p className="text-sm text-muted-foreground mt-1">Track and record worker payments.</p>
        </Link>
        <Link href="/admin/reports" className="card card-body hover:shadow-md transition-shadow">
          <p className="font-semibold text-foreground">Image Reports</p>
          <p className="text-sm text-muted-foreground mt-1">Review user-flagged images.</p>
        </Link>
        <Link href="/admin/support" className="card card-body hover:shadow-md transition-shadow relative">
          <div className="flex items-start justify-between gap-2">
            <p className="font-semibold text-foreground">Support</p>
            {escalated > 0 && (
              <span className="inline-flex items-center gap-1 text-xs px-2 py-0.5 bg-amber-100 text-amber-800 rounded">
                <AlertCircle className="w-3 h-3" />
                {escalated}
              </span>
            )}
          </div>
          <p className="text-sm text-muted-foreground mt-1">
            {escalated > 0
              ? `${escalated} escalated chat${escalated === 1 ? '' : 's'} need${escalated === 1 ? 's' : ''} attention.`
              : 'AI support conversations.'}
          </p>
        </Link>
      </div>
    </div>
  )
}
