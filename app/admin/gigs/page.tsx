import { createClient } from '@/lib/supabase/server'
import Link from 'next/link'
import {
  formatCurrency,
  formatDate,
  gigStatusClass,
  gigStatusLabel,
} from '@/lib/utils'

export const dynamic = 'force-dynamic'
export const revalidate = 0

// ============================================================
// Admin Gigs — read-only data view
// ============================================================
// Gig creation and editing both live on the user side now
// (/flipper/post-gig, /flipper/dashboard, /flipper/gigs/[id]/edit).
// This page exists so admin can see ALL gigs across the platform
// in one place — sorted by recency, with status, pay, and owner.
// There are intentionally no action buttons here.
// ============================================================

export default async function AdminGigsPage() {
  const supabase = createClient()

  const { data: gigs } = await supabase
    .from('gigs')
    .select('*')
    .order('created_at', { ascending: false })

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl text-foreground">Gigs</h1>
        <p className="text-muted-foreground mt-1">
          {gigs?.length ?? 0} total across the platform
        </p>
      </div>

      <div className="card overflow-hidden">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-border bg-muted/40">
              <th className="text-left px-4 py-3 font-medium text-muted-foreground">
                Title
              </th>
              <th className="text-left px-4 py-3 font-medium text-muted-foreground hidden sm:table-cell">
                Status
              </th>
              <th className="text-left px-4 py-3 font-medium text-muted-foreground hidden md:table-cell">
                Pay
              </th>
              <th className="text-left px-4 py-3 font-medium text-muted-foreground hidden lg:table-cell">
                Posted
              </th>
              <th className="text-left px-4 py-3 font-medium text-muted-foreground hidden lg:table-cell">
                Due
              </th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border">
            {gigs?.map((gig) => (
              <tr key={gig.id} className="hover:bg-muted/20 transition-colors">
                <td className="px-4 py-3">
                  <div>
                    <Link
                      href={`/gigs/${gig.slug}`}
                      className="font-medium text-foreground hover:text-accent"
                    >
                      {gig.title}
                    </Link>
                    <p className="text-xs text-muted-foreground font-mono capitalize">
                      {gig.furniture_type}
                    </p>
                  </div>
                </td>
                <td className="px-4 py-3 hidden sm:table-cell">
                  <span className={gigStatusClass(gig.status)}>
                    {gigStatusLabel(gig.status)}
                  </span>
                </td>
                <td className="px-4 py-3 hidden md:table-cell font-mono text-foreground">
                  {formatCurrency(gig.pay_amount)}
                </td>
                <td className="px-4 py-3 hidden lg:table-cell text-muted-foreground text-xs">
                  {formatDate(gig.created_at)}
                </td>
                <td className="px-4 py-3 hidden lg:table-cell text-muted-foreground text-xs">
                  {formatDate(gig.due_date)}
                </td>
              </tr>
            ))}
          </tbody>
        </table>

        {(!gigs || gigs.length === 0) && (
          <div className="text-center py-16 text-muted-foreground">
            <p>No gigs in the database.</p>
            <p className="text-xs mt-1">
              Gigs appear here as users post them.
            </p>
          </div>
        )}
      </div>
    </div>
  )
}
