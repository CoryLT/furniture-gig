'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { CreditCard, CheckCircle2, AlertTriangle, ArrowRight } from 'lucide-react'

type Status = {
  connected: boolean
  ready: boolean
  charges_enabled: boolean
  payouts_enabled: boolean
  details_submitted: boolean
}

export default function ProfilePaymentsSection() {
  const [status, setStatus] = useState<Status | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    async function load() {
      try {
        const res = await fetch('/api/stripe/connect/status')
        if (res.ok) {
          const data = await res.json()
          setStatus({
            connected: !!data.connected,
            ready: !!data.ready,
            charges_enabled: !!data.charges_enabled,
            payouts_enabled: !!data.payouts_enabled,
            details_submitted: !!data.details_submitted,
          })
        }
      } catch {
        // Silent — show "not connected" state below
      } finally {
        setLoading(false)
      }
    }
    load()
  }, [])

  return (
    <div className="bg-white rounded-lg shadow p-8 mt-6">
      <div className="flex items-center gap-2 mb-2">
        <CreditCard className="w-5 h-5 text-slate-700" />
        <h2 className="text-2xl font-serif font-bold text-slate-900">Payments</h2>
      </div>
      <p className="text-sm text-slate-600 mb-6">
        Connect Stripe to get paid for gigs you complete. Required before you can apply.
      </p>

      {loading ? (
        <div className="p-4 border border-slate-200 rounded-md bg-slate-50">
          <p className="text-sm text-slate-600">Checking your Stripe status…</p>
        </div>
      ) : status?.ready ? (
        <div className="p-4 border border-green-200 rounded-md bg-green-50 flex items-start gap-3">
          <CheckCircle2 className="w-5 h-5 text-green-600 mt-0.5 shrink-0" />
          <div>
            <p className="text-sm font-semibold text-green-900">Stripe connected and verified</p>
            <p className="text-sm text-green-800 mt-1">
              You&apos;re all set to apply for gigs and receive payouts.
            </p>
          </div>
        </div>
      ) : status?.connected ? (
        <div className="p-4 border border-amber-200 rounded-md bg-amber-50 flex items-start gap-3">
          <AlertTriangle className="w-5 h-5 text-amber-600 mt-0.5 shrink-0" />
          <div>
            <p className="text-sm font-semibold text-amber-900">Onboarding not finished</p>
            <p className="text-sm text-amber-800 mt-1">
              You started connecting Stripe but didn&apos;t finish. Pick up where you left off.
            </p>
          </div>
        </div>
      ) : (
        <div className="p-4 border border-amber-200 rounded-md bg-amber-50 flex items-start gap-3">
          <AlertTriangle className="w-5 h-5 text-amber-600 mt-0.5 shrink-0" />
          <div>
            <p className="text-sm font-semibold text-amber-900">Not connected</p>
            <p className="text-sm text-amber-800 mt-1">
              Connect a Stripe account so you can get paid for gigs you complete.
            </p>
          </div>
        </div>
      )}

      <Link
        href="/profile/payments"
        className="mt-4 inline-flex items-center gap-1.5 text-sm font-semibold text-amber-700 hover:text-amber-800"
      >
        {status?.ready ? 'Manage payments' : status?.connected ? 'Finish setup' : 'Set up payments'}
        <ArrowRight className="w-4 h-4" />
      </Link>
    </div>
  )
}
