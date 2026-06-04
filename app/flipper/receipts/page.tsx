import Link from 'next/link'
import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import ReceiptScanner from './ReceiptScanner'

export const dynamic = 'force-dynamic'
export const revalidate = 0

export default async function ReceiptsPage() {
  const supabase = createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) redirect('/auth/login')

  const admin = createAdminClient()
  const { data: conn } = await admin
    .from('quickbooks_connections')
    .select('realm_id')
    .eq('owner_user_id', user.id)
    .maybeSingle()
  const connected = !!conn

  const { data: settings } = await admin
    .from('quickbooks_settings')
    .select('paid_from_account_id, category_map')
    .eq('owner_user_id', user.id)
    .maybeSingle()
  const mapped =
    !!settings?.paid_from_account_id &&
    !!settings?.category_map &&
    Object.keys(settings.category_map as Record<string, unknown>).length > 0

  const { data: piecesRaw } = await supabase
    .from('inventory_pieces')
    .select('id, title')
    .eq('owner_user_id', user.id)
    .order('created_at', { ascending: false })
  const pieces = (piecesRaw || []).map((p: any) => ({
    id: p.id,
    title: p.title || 'Untitled piece',
  }))

  return (
    <div className="space-y-6 max-w-xl">
      <div>
        <h1 className="text-3xl text-foreground">Snap a receipt</h1>
        <p className="text-muted-foreground mt-1">
          Take a photo, tag each line to a piece (or leave it general), and it goes to
          QuickBooks once.
        </p>
      </div>

      {!connected ? (
        <div className="card card-body text-sm text-muted-foreground space-y-2">
          <p>Connect QuickBooks first so your receipts have somewhere to go.</p>
          <Link href="/flipper/quickbooks" className="text-accent hover:underline">
            Go to QuickBooks setup
          </Link>
        </div>
      ) : !mapped ? (
        <div className="card card-body text-sm text-muted-foreground space-y-2">
          <p>Set up your cost mapping first so each line knows where to file.</p>
          <Link href="/flipper/quickbooks" className="text-accent hover:underline">
            Go to QuickBooks setup
          </Link>
        </div>
      ) : (
        <ReceiptScanner pieces={pieces} />
      )}
    </div>
  )
}
