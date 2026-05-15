'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { Button } from '@/components/ui/button'
import { Armchair, CheckCircle2 } from 'lucide-react'
import type { LegalAgreementRow } from '@/types/database'

interface Props {
  agreements: LegalAgreementRow[]
  home: string
}

export default function AgreementsClient({ agreements, home }: Props) {
  const router = useRouter()
  const supabase = createClient()

  const [currentIndex, setCurrentIndex] = useState(0)
  const [checked, setChecked] = useState(false)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  const current = agreements[currentIndex]
  const isLast = currentIndex === agreements.length - 1

  async function handleAccept() {
    if (!checked) return
    setLoading(true)
    setError('')

    const { data: { user } } = await supabase.auth.getUser()
    if (!user) { router.push('/auth/login'); return }

    const { error: insertError } = await supabase
      .from('user_agreement_acceptances')
      .upsert({
        user_id: user.id,
        agreement_id: current.id,
        version: current.version,
      })

    if (insertError) {
      setError('Failed to record acceptance. Please try again.')
      setLoading(false)
      return
    }

    if (isLast) {
      router.push(home)
      router.refresh()
    } else {
      setCurrentIndex((i) => i + 1)
      setChecked(false)
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen flex flex-col items-center justify-center px-4 py-12 bg-background">
      <div className="w-full max-w-2xl space-y-6">
        {/* Header */}
        <div className="text-center space-y-2">
          <div className="inline-flex items-center gap-2 font-serif text-2xl text-foreground">
            <Armchair className="w-6 h-6 text-accent" strokeWidth={1.5} />
            FlipWork
          </div>
          <h1 className="text-2xl text-foreground">Review & accept agreements</h1>
          {agreements.length > 1 && (
            <p className="text-sm text-muted-foreground">
              Agreement {currentIndex + 1} of {agreements.length}
            </p>
          )}
        </div>

        {/* Steps indicator */}
        <div className="flex items-center gap-2 justify-center">
          <div className="flex items-center gap-1.5">
            <CheckCircle2 className="w-5 h-5 text-accent" />
            <span className="text-xs font-medium text-muted-foreground">Profile</span>
          </div>
          <div className="w-8 h-px bg-border" />
          <div className="flex items-center gap-1.5">
            <div className="w-6 h-6 rounded-full bg-accent text-accent-foreground text-xs flex items-center justify-center font-medium">2</div>
            <span className="text-xs font-medium text-foreground">Agreement</span>
          </div>
          <div className="w-8 h-px bg-border" />
          <div className="flex items-center gap-1.5">
            <div className="w-6 h-6 rounded-full bg-muted text-muted-foreground text-xs flex items-center justify-center font-medium">3</div>
            <span className="text-xs text-muted-foreground">Gigs</span>
          </div>
        </div>

        {/* Agreement card */}
        <div className="card">
          <div className="card-header">
            <div className="flex items-start justify-between gap-4">
              <div>
                <h2 className="font-serif text-xl text-foreground">{current.title}</h2>
                <p className="text-xs text-muted-foreground font-mono mt-0.5">Version {current.version}</p>
              </div>
            </div>
          </div>
          <div className="card-body">
            {/* Agreement text — scrollable */}
            <div className="bg-muted/40 rounded-md border border-border p-4 h-72 overflow-y-auto">
              <pre className="text-sm text-foreground whitespace-pre-wrap font-sans leading-relaxed">
                {current.content}
              </pre>
            </div>

            {/* Acceptance checkbox */}
            <label className="flex items-start gap-3 mt-4 cursor-pointer group">
              <input
                type="checkbox"
                checked={checked}
                onChange={(e) => setChecked(e.target.checked)}
                className="mt-0.5 h-4 w-4 rounded border-input accent-accent cursor-pointer"
              />
              <span className="text-sm text-foreground group-hover:text-foreground/80">
                I have read and agree to the <strong>{current.title}</strong> (v{current.version}).
              </span>
            </label>

            {error && <p className="text-sm text-destructive mt-3">{error}</p>}

            <Button
              variant="accent"
              className="w-full mt-4"
              disabled={!checked}
              loading={loading}
              onClick={handleAccept}
            >
              {isLast ? 'Accept & finish' : 'Accept & continue'}
            </Button>
          </div>
        </div>
      </div>
    </div>
  )
}
