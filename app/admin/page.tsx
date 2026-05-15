import Link from 'next/link'
import { Plus } from 'lucide-react'
import { Button } from '@/components/ui/button'

export default function AdminDashboard() {
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

      <div className="grid sm:grid-cols-3 gap-4">
        <Link href="/admin/gigs" className="card card-body hover:shadow-md transition-shadow">
          <p className="font-semibold text-foreground">Manage Gigs</p>
          <p className="text-sm text-muted-foreground mt-1">Create, edit, and update gig statuses.</p>
        </Link>
        <Link href="/admin/payouts" className="card card-body hover:shadow-md transition-shadow">
          <p className="font-semibold text-foreground">Payouts</p>
          <p className="text-sm text-muted-foreground mt-1">Track and record worker payments.</p>
        </Link>
        <Link href="/admin/gigs/new" className="card card-body hover:shadow-md transition-shadow">
          <p className="font-semibold text-foreground">Post New Gig</p>
          <p className="text-sm text-muted-foreground mt-1">Add a new furniture flipping project.</p>
        </Link>
      </div>
    </div>
  )
}
