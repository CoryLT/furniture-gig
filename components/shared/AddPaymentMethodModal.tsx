'use client'

import { useEffect, useMemo, useState } from 'react'
import { loadStripe } from '@stripe/stripe-js'
import {
  Elements,
  PaymentElement,
  useStripe,
  useElements,
} from '@stripe/react-stripe-js'
import { Button } from '@/components/ui/button'
import { X } from 'lucide-react'

// Module-level Promise — `loadStripe` should be called once and cached.
const stripePromise = process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY
  ? loadStripe(process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY)
  : null

interface AddPaymentMethodModalProps {
  open: boolean
  onClose: () => void
  onSuccess: () => void
}

export default function AddPaymentMethodModal({
  open,
  onClose,
  onSuccess,
}: AddPaymentMethodModalProps) {
  const [clientSecret, setClientSecret] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  // Kick off a SetupIntent the moment the modal opens
  useEffect(() => {
    if (!open) {
      // Reset on close so the next open starts fresh
      setClientSecret(null)
      setError('')
      return
    }

    let cancelled = false
    setLoading(true)
    setError('')

    fetch('/api/stripe/payment-method/setup-intent', { method: 'POST' })
      .then(async (res) => {
        const data = await res.json()
        if (!res.ok) {
          throw new Error(data?.error || data?.message || 'Could not start card setup.')
        }
        return data
      })
      .then((data) => {
        if (cancelled) return
        setClientSecret(data.clientSecret)
      })
      .catch((err) => {
        if (cancelled) return
        setError(err?.message || 'Could not start card setup.')
      })
      .finally(() => {
        if (!cancelled) setLoading(false)
      })

    return () => {
      cancelled = true
    }
  }, [open])

  const elementsOptions = useMemo(() => {
    if (!clientSecret) return null
    return {
      clientSecret,
      appearance: {
        theme: 'stripe' as const,
        variables: {
          colorPrimary: '#0a0a0a',
          colorBackground: '#ffffff',
          colorText: '#0a0a0a',
          fontFamily: 'DM Sans, system-ui, sans-serif',
          borderRadius: '8px',
        },
      },
    }
  }, [clientSecret])

  if (!open) return null

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
      <div className="card w-full max-w-md card-body relative">
        <button
          type="button"
          onClick={onClose}
          aria-label="Close"
          className="absolute top-3 right-3 text-muted-foreground hover:text-foreground"
        >
          <X className="w-5 h-5" />
        </button>

        <h2 className="text-xl font-serif font-semibold mb-1">Add a payment method</h2>
        <p className="text-sm text-muted-foreground mb-4">
          Save a card so you can pick a worker. Your card won&apos;t be charged yet —
          it&apos;s only charged once you approve the finished work.
        </p>

        {!stripePromise && (
          <p className="text-sm text-destructive">
            Stripe isn&apos;t configured. Missing publishable key.
          </p>
        )}

        {loading && (
          <p className="text-sm text-muted-foreground">Loading secure form…</p>
        )}

        {error && (
          <div className="rounded-md border border-destructive/30 bg-destructive/5 p-3 mb-3">
            <p className="text-sm text-destructive">{error}</p>
          </div>
        )}

        {stripePromise && elementsOptions && (
          <Elements stripe={stripePromise} options={elementsOptions}>
            <CardForm onSuccess={onSuccess} onCancel={onClose} />
          </Elements>
        )}
      </div>
    </div>
  )
}

interface CardFormProps {
  onSuccess: () => void
  onCancel: () => void
}

function CardForm({ onSuccess, onCancel }: CardFormProps) {
  const stripe = useStripe()
  const elements = useElements()
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState('')

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!stripe || !elements) return

    setSubmitting(true)
    setError('')

    const { error: confirmError } = await stripe.confirmSetup({
      elements,
      // Stay on this page — we want to avoid a full page redirect
      redirect: 'if_required',
    })

    if (confirmError) {
      setError(confirmError.message || 'Card could not be saved.')
      setSubmitting(false)
      return
    }

    // Success — the card is now attached to the Customer
    onSuccess()
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <PaymentElement options={{ layout: 'tabs' }} />

      {error && <p className="text-sm text-destructive">{error}</p>}

      <div className="flex gap-2 justify-end">
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={onCancel}
          disabled={submitting}
        >
          Cancel
        </Button>
        <Button
          type="submit"
          variant="accent"
          size="sm"
          loading={submitting}
          disabled={!stripe || !elements || submitting}
        >
          Save card
        </Button>
      </div>
    </form>
  )
}
