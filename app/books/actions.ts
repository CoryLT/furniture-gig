'use server'

import { createClient } from '@/lib/supabase/server'

// Delete a whole ledger entry: its balanced lines, then the header.
// RLS + the owner check make sure you can only delete your own.
// (This removes the bookkeeping entry; any tagged piece stays in your
// Pipeline.)
export async function deleteTransaction(
  id: string
): Promise<{ ok: boolean; error?: string }> {
  if (!id) return { ok: false, error: 'Missing id' }
  const supabase = createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return { ok: false, error: 'Not signed in' }
  const me = user.id

  await supabase.from('entry_lines').delete().eq('transaction_id', id).eq('owner_user_id', me)
  const { error } = await supabase.from('transactions').delete().eq('id', id).eq('owner_user_id', me)
  if (error) return { ok: false, error: error.message }
  return { ok: true }
}
