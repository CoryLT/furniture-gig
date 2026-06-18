import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import Link from 'next/link'
import { ArrowLeft } from 'lucide-react'
import InventoryManager, { type InvItem } from './InventoryManager'

// Live data — always fresh.
export const dynamic = 'force-dynamic'
export const revalidate = 0

export default async function InventoryPage() {
  const supabase = createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) redirect('/auth/login')
  const me = user.id

  const { data: rows } = await supabase
    .from('books_inventory_items')
    .select('id, name, unit, avg_cost, quantity, image_path, reorder_level')
    .eq('owner_user_id', me)
    .order('name', { ascending: true })

  const items: InvItem[] = ((rows ?? []) as any[]).map((r) => ({
    id: r.id,
    name: r.name || 'Untitled item',
    unit: r.unit ?? null,
    avg_cost: Number(r.avg_cost ?? 0),
    quantity: Number(r.quantity ?? 0),
    reorder_level: r.reorder_level == null ? null : Number(r.reorder_level),
    imageUrl: r.image_path
      ? supabase.storage.from('marketplace-photos').getPublicUrl(r.image_path).data.publicUrl
      : null,
  }))

  return (
    <main className="max-w-2xl mx-auto px-4 py-8">
      <Link
        href="/books"
        className="inline-flex items-center gap-1.5 text-sm font-medium text-accent hover:text-accent/80"
      >
        <ArrowLeft className="w-4 h-4" />
        Back to Books
      </Link>

      <div className="mt-3">
        <h1 className="text-2xl font-semibold text-foreground">Supplies inventory</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Your stock of hardware and supplies — knobs, pulls, legs, slides, and more.
        </p>
      </div>

      <InventoryManager initialItems={items} me={me} />
    </main>
  )
}
