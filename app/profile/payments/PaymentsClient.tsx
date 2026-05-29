'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { Button } from '@/components/ui/button'
import { ArrowLeft, CheckCircle2, AlertTriangle, ExternalLink, ShieldCheck } from 'lucide-react'

type Status = {
  connected: boolean
  account_id: string | null
  charges_enabled: boolean
  payouts_enabled: boolean
  details_submitted: boolean
  ready: boolean
  currently_due?: string[]
  past_due?: string[]
  disabled_reason?: string | null
}

interface Props {
  initial: {
    connected: boolean
    accountId: string | null
    chargesEnabled: boolean
    payoutsEnabled: boolean
    detailsSubmitted: boolean
  }
  hasWorkerProfile: boolean
}

export default function PaymentsClient({ initial, hasWorkerProfile }: Props) {
  const [status, setStatus] = useState<Status>({
    connected: initial.connected,
    account_id: initial.accountId,
    charges_enabled: initial.chargesEnabled,
    payouts_enabled: initial.payoutsEnabled,
    details_submitted: initial.detailsSubmitted,
    ready: initial.chargesEnabled && initial.payoutsEnabled && initial.detailsSubmitted,
  })
  const [refreshing, setRefreshing] = useState(true)
  const [startingOnboarding, setStartingOnboarding] = useState(false)
  const [openingDashboard, setOpeningDashboard] = useState(false)
  const [error, setError] = useState('')

  // Fetch live status from Stripe on mount
  useEffect(() => {
    async function loadLiveStatus() {
      setRefreshing(true)
      try {
        const res = await fetch('/api/stripe/connect/status')
        if (res.ok) {
          const data = await res.json()
          setStatus(data)
        }
      } catch {
        // Silent — we still have the DB-cached status to show
      } finally {
        setRefreshing(false)
      }
    }
    loadLiveStatus()
  }, [])

  async function handleStartOnboarding() {
    setStartingOnboarding(true)
    setError('')
    try {
      const res = await fetch('/api/stripe/connect/onboard', { method: 'POST' })
      const data = await res.json()
      if (!res.ok || !data.url) {
        setError(data.error ?? 'Could not start Stripe onboarding.')
        setStartingOnboarding(false)
        return
      }
      window.location.href = data.url
    } catch {
      setError('Something went wrong. Please try again.')
      setStartingOnboarding(false)
    }
  }

  async function handleOpenDashboard() {
    setOpeningDashboard(true)
    setError('')
    try {
      const res = await fetch('/api/stripe/connect/login-link', { method: 'POST' })
      const data = await res.json()
      if (!res.ok || !data.url) {
        setError(data.error ?? 'Could not open Stripe dashboard.')
        setOpeningDashboard(false)
        return
      }
      window.open(data.url, '_blank', 'noopener,noreferrer')
    } catch {
      setError('Something went wrong. Please try again.')
    } finally {
      setOpeningDashboard(false)
    }
  }

  return (
    <div className="min-h-screen bg-stone-50 py-8 px-4">
      <div className="max-w-2xl mx-auto">
        <Link
          href="/profile"
          className="inline-flex items-center gap-2 text-sm text-slate-600 hover:text-slate-900 mb-6"
        >
          <ArrowLeft className="w-4 h-4" />
          Back to profile
        </Link>

        <div className="bg-white rounded-lg shadow p-8">
          <h1 className="text-3xl font-serif font-bold text-slate-900 mb-2">Payments</h1>
          <p className="text-slate-600 mb-6">
            Connect Stripe to get paid for the gigs you complete. Stripe handles your bank details, tax forms, and payouts directly to your bank account.
          </p>

          {!hasWorkerProfile && (
            <div className="mb-6 p-4 bg-amber-50 border border-amber-200 rounded-md">
              <p className="text-sm font-medium text-amber-900 mb-1">Finish your worker profile first</p>
              <p className="text-sm text-amber-800">
                Before connecting Stripe, head over to your <Link href="/profile" className="underline">profile</Link> and save your basic info.
              </p>
            </div>
          )}

          {error && (
            <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-md">
              <p className="text-sm text-red-700">{error}</p>
            </div>
          )}

          {/* Main status card */}
          <StatusCard status={status} refreshing={refreshing} />

          {/* Action buttons */}
          <div className="mt-6 space-y-3">
            {!status.connected && (
              <Button
                variant="accent"
                onClick={handleStartOnboarding}
                loading={startingOnboarding}
                disabled={!hasWorkerProfile}
                className="w-full sm:w-auto"
              >
                Connect Stripe account
              </Button>
            )}

            {status.connected && !status.ready && (
              <Button
                variant="accent"
                onClick={handleStartOnboarding}
                loading={startingOnboarding}
                className="w-full sm:w-auto"
              >
                Finish Stripe onboarding
              </Button>
            )}

            {status.connected && status.ready && (
              <Button
                variant="outline"
                onClick={handleOpenDashboard}
                loading={openingDashboard}
                className="w-full sm:w-auto gap-2"
              >
                <ExternalLink className="w-4 h-4" />
                Manage Stripe account
              </Button>
            )}
          </div>

          {/* Info section */}
          <div className="mt-8 pt-8 border-t border-slate-200 space-y-4">
            <div className="flex items-start gap-3">
              <ShieldCheck className="w-5 h-5 text-slate-500 mt-0.5 shrink-0" />
              <div>
                <h3 className="text-sm font-semibold text-slate-900">Your info is safe with Stripe</h3>
                <p className="text-sm text-slate-600 mt-1">
                  FlipWork never sees your bank account or tax ID. You enter that directly into Stripe&apos;s secure form.
                </p>
              </div>
            </div>
            <div className="flex items-start gap-3">
              <CheckCircle2 className="w-5 h-5 text-slate-500 mt-0.5 shrink-0" />
              <div>
                <h3 className="text-sm font-semibold text-slate-900">How payouts work</h3>
                <p className="text-sm text-slate-600 mt-1">
                  When a flipper picks you, their card is held for the gig amount. Once your work is approved, the full gig amount is automatically sent to your bank.
                </p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

function StatusCard({ status, refreshing }: { status: Status; refreshing: boolean }) {
  if (refreshing && !status.connected) {
    return (
      <div className="p-4 border border-slate-200 rounded-md bg-slate-50">
        <p className="text-sm text-slate-600">Checking your Stripe status…</p>
      </div>
    )
  }

  if (!status.connected) {
    return (
      <div className="p-4 border border-amber-200 rounded-md bg-amber-50">
        <div className="flex items-start gap-3">
          <AlertTriangle className="w-5 h-5 text-amber-600 mt-0.5 shrink-0" />
          <div>
            <p className="text-sm font-semibold text-amber-900">Not connected</p>
            <p className="text-sm text-amber-800 mt-1">
              You need to connect a Stripe account before you can apply to gigs.
            </p>
          </div>
        </div>
      </div>
    )
  }

  if (!status.ready) {
    return (
      <div className="p-4 border border-amber-200 rounded-md bg-amber-50">
        <div className="flex items-start gap-3">
          <AlertTriangle className="w-5 h-5 text-amber-600 mt-0.5 shrink-0" />
          <div className="flex-1">
            <p className="text-sm font-semibold text-amber-900">Onboarding not finished</p>
            <p className="text-sm text-amber-800 mt-1">
              Your Stripe account was started but isn&apos;t fully set up yet. Click below to finish.
            </p>
            <div className="mt-3 grid grid-cols-2 gap-2 text-xs text-amber-900">
              <StatusPill label="Details submitted" ok={status.details_submitted} />
              <StatusPill label="Charges enabled" ok={status.charges_enabled} />
              <StatusPill label="Payouts enabled" ok={status.payouts_enabled} />
            </div>
            {status.currently_due && status.currently_due.length > 0 && (
              <p className="text-xs text-amber-800 mt-3">
                Still needed: {status.currently_due.join(', ')}
              </p>
            )}
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="p-4 border border-green-200 rounded-md bg-green-50">
      <div className="flex items-start gap-3">
        <CheckCircle2 className="w-5 h-5 text-green-600 mt-0.5 shrink-0" />
        <div>
          <p className="text-sm font-semibold text-green-900">All set — ready to get paid</p>
          <p className="text-sm text-green-800 mt-1">
            Your Stripe account is fully verified. You can apply to gigs and receive payouts.
          </p>
        </div>
      </div>
    </div>
  )
}

function StatusPill({ label, ok }: { label: string; ok: boolean }) {
  return (
    <span className={`inline-flex items-center gap-1.5 px-2 py-1 rounded font-medium ${
      ok ? 'bg-green-100 text-green-900' : 'bg-stone-100 text-stone-700'
    }`}>
      <span className={`w-1.5 h-1.5 rounded-full ${ok ? 'bg-green-500' : 'bg-stone-400'}`} />
      {label}
    </span>
  )
}
