import Link from 'next/link'
import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import ReceiptScanner from './ReceiptScanner'

export const dynamic = 'force-dynamic'
export const revalidate = 0

export default async function ReceiptsPage() {
  const supabase = createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) redirect('/auth/login')
  const me = user.id

  // Books accounts: expense ones are the "category", asset ones are "paid from".
  const { data: accountsRaw } = await supabase
    .from('accounts')
    .select('id, name, type')
    .eq('owner_user_id', me)
    .order('name', { ascending: true })
  const accounts = (accountsRaw ?? []) as { id: string; name: string; type: string }[]
  const expenseAccounts = accounts.filter((a) => a.type === 'expense')
  const assetAccounts = accounts.filter((a) => a.type === 'asset')

  const { data: piecesRaw } = await supabase
    .from('inventory_pieces')
    .select('id, title')
    .eq('owner_user_id', me)
    .order('created_at', { ascending: false })
  const pieces = (piecesRaw || []).map((p: any) => ({
    id: p.id,
    title: p.title || 'Untitled piece',
  }))

  const booksReady = expenseAccounts.length > 0 && assetAccounts.length > 0

  return (
    <div className="space-y-6 max-w-xl">
      <div>
        <h1 className="text-3xl text-foreground">Snap a receipt</h1>
        <p className="text-muted-foreground mt-1">
          Take a photo, tag each line to a piece (or leave it general), and it lands in
          your books with the photo attached.
        </p>
      </div>

      {!booksReady ? (
        <div className="card card-body text-sm text-muted-foreground space-y-2">
          <p>
            Set up your books first so each receipt line has a category to land in and an
            account it was paid from.
          </p>
          <Link href="/books" className="text-accent hover:underline">
            Go to Books
          </Link>
        </div>
      ) : (
        <ReceiptScanner
          pieces={pieces}
          expenseAccounts={expenseAccounts}
          assetAccounts={assetAccounts}
        />
      )}
    </div>
  )
}
