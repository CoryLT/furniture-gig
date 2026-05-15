import { createClient } from '@/lib/supabase/server'
import Link from 'next/link'
import { formatCurrency, formatDate, gigStatusClass, gigStatusLabel } from '@/lib/utils'
import { Button } from '@/components/ui/button'
import { Plus, Pencil } from 'lucide-react'

export default async function AdminGigsPage() {
  const supabase = createClient()

  const { data: gigs } = await supabase
    .from('gigs')
    .select('*')
    .order('created_at', { ascending: false })

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl text-foreground">Gigs</h1>
          <p className="text-muted-foreground mt-1">{gigs?.length ?? 0} total</p>
        </div>
        <Link href="/admin/gigs/new">
          <Button variant="accent" className="gap-2">
            <Plus className="w-4 h-4" />
            New gig
          </Button>
        </Link>
      </div>

      <div className="card overflow-hidden">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-border bg-muted/40">
              <th className="text-left px-4 py-3 font-medium text-muted-foreground">Title</th>
              <th className="text-left px-4 py-3 font-medium text-muted-foreground hidden sm:table-cell">Status</th>
              <th className="text-left px-4 py-3 font-medium text-muted-foreground hidden md:table-cell">Pay</th>
              <th className="text-left px-4 py-3 font-medium text-muted-foreground hidden lg:table-cell">Due</th>
              <th className="text-right px-4 py-3 font-medium text-muted-foreground">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border">
            {gigs?.map((gig) => (
              <tr key={gig.id} className="hover:bg-muted/20 transition-colors">
                <td className="px-4 py-3">
                  <div>
                    <p className="font-medium text-foreground">{gig.title}</p>
                    <p className="text-xs text-muted-foreground font-mono capitalize">{gig.furniture_type}</p>
                  </div>
                </td>
                <td className="px-4 py-3 hidden sm:table-cell">
                  <span className={gigStatusClass(gig.status)}>{gigStatusLabel(gig.status)}</span>
                </td>
                <td className="px-4 py-3 hidden md:table-cell font-mono text-foreground">
                  {formatCurrency(gig.pay_amount)}
                </td>
                <td className="px-4 py-3 hidden lg:table-cell text-muted-foreground">
                  {formatDate(gig.due_date)}
                </td>
                <td className="px-4 py-3 text-right">
                  <Link href={`/admin/gigs/${gig.id}/edit`}>
                    <Button variant="ghost" size="sm" className="gap-1.5">
                      <Pencil className="w-3.5 h-3.5" />
                      Edit
                    </Button>
                  </Link>
                </td>
              </tr>
            ))}
          </tbody>
        </table>

        {(!gigs || gigs.length === 0) && (
          <div className="text-center py-16 text-muted-foreground">
            <p>No gigs yet.</p>
            <Link href="/admin/gigs/new" className="text-accent text-sm hover:underline mt-2 inline-block">
              Create your first gig →
            </Link>
          </div>
        )}
      </div>
    </div>
  )
}
