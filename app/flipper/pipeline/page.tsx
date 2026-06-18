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

  // Expenses AND the purchase price now live in the ledger, tagged to the
  // piece. The purchase entry is marked with an 'acq:' / 'mig:acq:' memo.
  const { data: txnRaw } = await supabase
    .from('transactions')
    .select('id, piece_id, date, description, memo, entry_lines(debit, credit, accounts(name, type))')
    .eq('owner_user_id', me)
    .not('piece_id', 'is', null)
    .order('date', { ascending: true })

  const acqByPiece: Record<string, number> = {}
  const expByPiece: Record<string, any[]> = {}
  for (const t of (txnRaw ?? []) as any[]) {
    const lines = (t.entry_lines ?? []) as any[]
    const expLine = lines.find((l) => l.accounts?.type === 'expense')
    if (!expLine) continue
    const amount = Number(expLine.debit) - Number(expLine.credit)
    const memo = typeof t.memo === 'string' ? t.memo : ''
    const isPurchase = memo.startsWith('acq:') || memo.startsWith('mig:acq:')
    if (isPurchase) {
      acqByPiece[t.piece_id] = (acqByPiece[t.piece_id] ?? 0) + amount
    } else {
      if (!expByPiece[t.piece_id]) expByPiece[t.piece_id] = []
      expByPiece[t.piece_id].push({
        id: t.id,
        amount,
        category: expLine.accounts?.name ?? null,
        note: t.description ?? '',
        spent_on: t.date,
      })
    }
  }

  // Supplies used on each piece (from the inventory tracker).
  const { data: psRaw } = await supabase
    .from('piece_supplies')
    .select('id, piece_id, item_id, item_name, unit_cost, qty')
    .eq('owner_user_id', me)
    .order('created_at', { ascending: true })
  const suppliesByPiece: Record<string, any[]> = {}
  for (const s of (psRaw ?? []) as any[]) {
    if (!suppliesByPiece[s.piece_id]) suppliesByPiece[s.piece_id] = []
    suppliesByPiece[s.piece_id].push({
      id: s.id,
      item_id: s.item_id,
      item_name: s.item_name,
      unit_cost: Number(s.unit_cost ?? 0),
      qty: Number(s.qty ?? 0),
    })
  }

  const pieces = ((piecesRaw ?? []) as any[]).map((p) => ({
    ...p,
    acquisition_cost: acqByPiece[p.id] ?? 0,
    expenses: expByPiece[p.id] ?? [],
    supplies: suppliesByPiece[p.id] ?? [],
  }))

  // Crew list for the "who did you pay?" picker on labor expenses.
  const { data: crewRaw } = await supabase
    .from('crew_members')
    .select('id, worker_user_id, worker_name')
    .eq('operator_user_id', me)
    .eq('hidden', false)
  const onIds = ((crewRaw ?? []) as any[]).map((c) => c.worker_user_id).filter(Boolean)
  const nameById: Record<string, string> = {}
  if (onIds.length) {
    const { data: profs } = await supabase
      .from('worker_profiles')
      .select('user_id, full_name, first_name, last_name')
      .in('user_id', onIds)
    for (const p of (profs ?? []) as any[]) {
      nameById[p.user_id] =
        (p.full_name || '').trim() ||
        [p.first_name, p.last_name].filter(Boolean).join(' ').trim() ||
        'Crew'
    }
  }
  const crew = ((crewRaw ?? []) as any[]).map((c) => ({
    id: c.id,
    label: c.worker_user_id ? nameById[c.worker_user_id] || 'Crew' : c.worker_name || 'Crew',
  }))

  // Supplies stock for the "use a supply" picker on each piece.
  const { data: invRaw } = await supabase
    .from('books_inventory_items')
    .select('id, name, unit, avg_cost, quantity, reorder_level')
    .eq('owner_user_id', me)
    .order('name', { ascending: true })
  const inventory = ((invRaw ?? []) as any[]).map((r) => ({
    id: r.id,
    name: r.name || 'Untitled item',
    unit: r.unit ?? null,
    avg_cost: Number(r.avg_cost ?? 0),
    quantity: Number(r.quantity ?? 0),
    reorder_level: r.reorder_level == null ? null : Number(r.reorder_level),
  }))

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-3xl text-foreground">Pipeline</h1>
        <p className="text-muted-foreground mt-1">
          Every piece you&apos;re flipping, from sourced to sold. Move them across as
          they progress and watch the profit land.
        </p>
      </div>
      <PipelineBoard userId={me} initialPieces={pieces} crew={crew} inventory={inventory} />
    </div>
  )
}
