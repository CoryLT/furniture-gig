import { createClient } from '@/lib/supabase/server'
import PipelineBoard from './PipelineBoard'

// Pipeline reflects live piece data — always fresh.
export const dynamic = 'force-dynamic'
export const revalidate = 0

export default async function PipelinePage() {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  const me = user!.id

  const { data: piecesRaw } = await supabase
    .from('inventory_pieces')
    .select('*')
    .eq('owner_user_id', me)
    .order('created_at', { ascending: false })

  const { data: expRaw } = await supabase
    .from('piece_expenses')
    .select('id, piece_id, amount, category, note, spent_on')
    .eq('owner_user_id', me)
    .order('created_at', { ascending: true })

  const expByPiece: Record<string, any[]> = {}
  for (const e of (expRaw ?? []) as any[]) {
    if (!expByPiece[e.piece_id]) expByPiece[e.piece_id] = []
    expByPiece[e.piece_id].push(e)
  }

  const pieces = ((piecesRaw ?? []) as any[]).map((p) => ({
    ...p,
    expenses: expByPiece[p.id] ?? [],
  }))

  // Is QuickBooks connected AND a cost mapping saved? Controls the
  // "Send costs to QuickBooks" button on each piece.
  const { data: qbConn } = await supabase
    .from('quickbooks_connections')
    .select('owner_user_id')
    .eq('owner_user_id', me)
    .maybeSingle()
  const { data: qbSettings } = await supabase
    .from('quickbooks_settings')
    .select('paid_from_account_id, category_map')
    .eq('owner_user_id', me)
    .maybeSingle()
  const qbReady =
    !!qbConn &&
    !!qbSettings?.paid_from_account_id &&
    !!qbSettings?.category_map &&
    Object.keys(qbSettings.category_map as Record<string, unknown>).length > 0

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-3xl text-foreground">Pipeline</h1>
        <p className="text-muted-foreground mt-1">
          Every piece you&apos;re flipping, from sourced to sold. Move them across as
          they progress and watch the profit land.
        </p>
      </div>
      <PipelineBoard userId={me} initialPieces={pieces} qbReady={qbReady} />
    </div>
  )
}
