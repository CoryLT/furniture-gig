'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { Button } from '@/components/ui/button'
import type { GigChecklistItemRow, GigTaskCompletionRow } from '@/types/database'

interface Props {
  claimId: string
  checklist: GigChecklistItemRow[]
  completionMap: Map<string, GigTaskCompletionRow>
}

export default function SubmitSection({ claimId, checklist, completionMap }: Props) {
  const router = useRouter()
  const supabase = createClient()
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  const requiredItems = checklist.filter((i) => i.required)
  const missingRequired = requiredItems.filter(
    (i) => !completionMap.get(i.id)?.completed
  )

  const canSubmit = missingRequired.length === 0

  async function handleSubmit() {
    setLoading(true)
    setError('')

    const { error: updateError } = await supabase
      .from('gig_claims')
      .update({ status: 'submitted_for_review' })
      .eq('id', claimId)

    if (updateError) {
      setError('Failed to submit. Please try again.')
      setLoading(false)
      return
    }

    router.refresh()
  }

  return (
    <div className="card card-body space-y-3">
      <div>
        <h3 className="font-sans font-semibold text-foreground">Submit for review</h3>
        <p className="text-sm text-muted-foreground mt-1">
          Once submitted, the owner will review your work and approve payment.
        </p>
      </div>

      {!canSubmit && (
        <div className="bg-amber-50 border border-amber-200 rounded-md p-3">
          <p className="text-sm text-amber-800 font-medium">Required items not completed:</p>
          <ul className="mt-1 space-y-0.5">
            {missingRequired.map((item) => (
              <li key={item.id} className="text-xs text-amber-700">• {item.title}</li>
            ))}
          </ul>
        </div>
      )}

      {error && <p className="text-sm text-destructive">{error}</p>}

      <Button
        variant="accent"
        disabled={!canSubmit}
        loading={loading}
        onClick={handleSubmit}
        className="w-full sm:w-auto"
      >
        Submit for review
      </Button>
    </div>
  )
}
