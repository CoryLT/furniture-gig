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

  const pieces = (piecesRaw ?? []) as any[]

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-3xl text-foreground">Pipeline</h1>
        <p className="text-muted-foreground mt-1">
          Every piece you&apos;re flipping, from sourced to sold. Move them across as
          they progress and watch the profit land.
        </p>
      </div>
      <PipelineBoard userId={me} initialPieces={pieces} />
    </div>
  )
}
