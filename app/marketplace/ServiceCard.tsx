'use client'

import Link from 'next/link'
import { Hammer, MapPin } from 'lucide-react'

export interface ServiceCardData {
  id: string
  categoryLabel: string
  blurb: string
  price_type: 'flat' | 'hourly' | 'starting_at' | 'contact_for_quote'
  price_amount: number | null
  provider_username: string | null
  provider_display_name: string | null
  provider_city: string | null
}

function formatPrice(s: ServiceCardData): string {
  if (s.price_type === 'contact_for_quote') return 'Contact for quote'
  const amt = s.price_amount ? `$${Number(s.price_amount).toFixed(2)}` : ''
  if (s.price_type === 'flat') return amt ? `${amt} flat` : 'Flat rate'
  if (s.price_type === 'hourly') return amt ? `${amt}/hr` : 'Hourly'
  if (s.price_type === 'starting_at') return amt ? `Starting at ${amt}` : 'Starting at'
  return ''
}

export default function ServiceCard({ service }: { service: ServiceCardData }) {
  const providerName =
    service.provider_display_name || service.provider_username || 'A FlipWork member'

  // Tapping the card goes to the provider's public profile if we have a
  // username; otherwise the card is non-clickable (rare edge case).
  const href = service.provider_username ? `/u/${service.provider_username}` : null

  const inner = (
    <div className="h-full rounded-lg border border-border bg-card p-3 flex flex-col gap-2 hover:border-accent hover:shadow-sm transition">
      <div className="flex items-center gap-2">
        <div className="w-8 h-8 rounded-lg bg-accent/10 flex items-center justify-center shrink-0">
          <Hammer className="w-4 h-4 text-accent" />
        </div>
        <p className="text-sm font-semibold text-foreground leading-tight">
          {service.categoryLabel}
        </p>
      </div>

      {service.blurb && (
        <p className="text-xs text-muted-foreground line-clamp-3">
          {service.blurb}
        </p>
      )}

      <div className="mt-auto space-y-1">
        <p className="text-sm font-medium text-foreground">
          {formatPrice(service)}
        </p>
        <p className="text-xs text-muted-foreground truncate">
          by {providerName}
        </p>
        {service.provider_city && (
          <p className="text-xs text-muted-foreground flex items-center gap-1">
            <MapPin className="w-3 h-3" />
            {service.provider_city}
          </p>
        )}
      </div>
    </div>
  )

  if (href) {
    return (
      <Link href={href} className="block h-full">
        {inner}
      </Link>
    )
  }
  return <div className="h-full">{inner}</div>
}
