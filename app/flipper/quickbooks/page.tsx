import Link from 'next/link'
import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { qbIsConfigured } from '@/lib/quickbooks'
import { Button } from '@/components/ui/button'

// Always read the live connection state.
export const dynamic = 'force-dynamic'
export const revalidate = 0

export default async function QuickbooksPage({
  searchParams,
}: {
  searchParams: { connected?: string; disconnected?: string; error?: string }
}) {
  const supabase = createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) redirect('/auth/login')

  const admin = createAdminClient()
  const { data: conn } = await admin
    .from('quickbooks_connections')
    .select('realm_id, environment, created_at')
    .eq('owner_user_id', user.id)
    .maybeSingle()

  const configured = qbIsConfigured()
  const connected = !!conn

  return (
    <div className="space-y-6 max-w-xl">
      <div>
        <h1 className="text-3xl text-foreground">QuickBooks</h1>
        <p className="text-muted-foreground mt-1">
          Link your QuickBooks so FlipWork can send your expenses, payments, and sales
          straight to your books.
        </p>
      </div>

      {searchParams.connected && (
        <div className="rounded-lg border border-accent/40 bg-accent/10 px-4 py-3 text-sm text-foreground">
          Connected! Your QuickBooks is now linked to FlipWork.
        </div>
      )}
      {searchParams.disconnected && (
        <div className="rounded-lg border border-border bg-secondary px-4 py-3 text-sm text-foreground">
          Disconnected. FlipWork is no longer linked to your QuickBooks.
        </div>
      )}
      {searchParams.error && (
        <div className="rounded-lg border border-red-300 bg-red-50 px-4 py-3 text-sm text-red-700">
          Something went wrong ({searchParams.error}). Please try connecting again.
        </div>
      )}

      {!configured ? (
        <div className="card card-body text-sm text-muted-foreground">
          QuickBooks isn&apos;t set up on the server yet. Once the QuickBooks keys are
          added in Vercel, this page will show a Connect button.
        </div>
      ) : connected ? (
        <div className="card card-body space-y-3">
          <div className="flex items-center gap-2">
            <span className="inline-block w-2.5 h-2.5 rounded-full bg-accent" />
            <p className="font-medium text-foreground">Connected</p>
          </div>
          <p className="text-sm text-muted-foreground">
            Company ID: <span className="text-foreground">{conn!.realm_id}</span>
            <br />
            Mode: <span className="text-foreground">{conn!.environment}</span>
          </p>
          <form action="/api/quickbooks/disconnect" method="post">
            <button
              type="submit"
              className="text-sm text-muted-foreground hover:text-red-600"
            >
              Disconnect
            </button>
          </form>
        </div>
      ) : (
        <div className="card card-body space-y-3">
          <p className="text-sm text-muted-foreground">
            You haven&apos;t linked QuickBooks yet.
          </p>
          <Button asChild variant="accent" className="w-fit">
            <Link href="/api/quickbooks/connect">Connect QuickBooks</Link>
          </Button>
        </div>
      )}
    </div>
  )
}
