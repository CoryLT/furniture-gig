import Link from 'next/link'
import { ChevronRight, Camera, Clock, Tag, UserCheck, Check } from 'lucide-react'

export type NeedItem = {
  id: string
  kind: 'cash_stuck' | 'no_price' | 'no_photo' | 'approve'
  sev: 'danger' | 'warning' | 'info'
  title: string
  badge: string
  detail: string
  fixLabel: string
  href: string
  imageUrl: string | null
}

const SEV: Record<NeedItem['sev'], string> = {
  danger: 'var(--play-red)',
  warning: 'var(--play-gold)',
  info: 'var(--play-green)',
}

function KindIcon({ kind }: { kind: NeedItem['kind'] }) {
  const cls = 'w-5 h-5'
  if (kind === 'no_photo') return <Camera className={cls} />
  if (kind === 'approve') return <UserCheck className={cls} />
  if (kind === 'cash_stuck') return <Clock className={cls} />
  return <Tag className={cls} />
}

export default function NeedsYou({ items, extra }: { items: NeedItem[]; extra: number }) {
  if (items.length === 0) {
    return (
      <section>
        <h2 className="font-serif text-lg mb-2" style={{ color: 'var(--play-ink)' }}>
          Needs you
        </h2>
        <div
          className="rounded-2xl p-6 flex flex-col items-center text-center gap-2"
          style={{ background: 'var(--play-panel)', border: '1px solid var(--play-border)' }}
        >
          <div
            className="w-11 h-11 rounded-full flex items-center justify-center"
            style={{ background: 'var(--play-panel)', border: '1px solid var(--play-green)' }}
          >
            <Check className="w-6 h-6" style={{ color: 'var(--play-green)' }} />
          </div>
          <div className="font-sans text-base font-medium" style={{ color: 'var(--play-green)' }}>
            Floor&apos;s clean — nothing needs you
          </div>
          <div className="font-sans text-xs" style={{ color: 'var(--play-muted)' }}>
            Every piece priced, shot, and working. Nice.
          </div>
        </div>
      </section>
    )
  }

  return (
    <section>
      <div className="flex items-center justify-between mb-2">
        <h2 className="font-serif text-lg" style={{ color: 'var(--play-ink)' }}>
          Needs you
        </h2>
        <span
          className="font-mono text-xs rounded-full px-2 py-0.5"
          style={{ color: 'var(--play-red)', border: '1px solid var(--play-red)' }}
        >
          {items.length + extra}
        </span>
      </div>

      <div className="space-y-2">
        {items.map((it) => {
          const color = SEV[it.sev]
          return (
            <Link
              key={it.id}
              href={it.href}
              className={
                'flex items-center gap-3 rounded-2xl p-3 ' +
                (it.kind === 'cash_stuck' ? 'play-pulse' : '')
              }
              style={{ background: 'var(--play-panel)', border: '1px solid var(--play-border)' }}
            >
              {it.imageUrl ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={it.imageUrl}
                  alt=""
                  className="w-11 h-11 rounded-lg object-cover shrink-0"
                />
              ) : (
                <div
                  className="w-11 h-11 rounded-lg flex items-center justify-center shrink-0"
                  style={{ background: 'var(--play-panel)', border: `1px solid ${color}`, color }}
                >
                  <KindIcon kind={it.kind} />
                </div>
              )}

              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 min-w-0">
                  <span
                    className="font-sans text-sm font-medium truncate"
                    style={{ color: 'var(--play-ink)' }}
                  >
                    {it.title}
                  </span>
                  <span
                    className="shrink-0 font-sans text-[10px] uppercase tracking-wider rounded-full px-1.5 py-0.5"
                    style={{ color, border: `1px solid ${color}` }}
                  >
                    {it.badge}
                  </span>
                </div>
                <div
                  className="font-sans text-xs mt-0.5 truncate"
                  style={{ color: 'var(--play-muted)' }}
                >
                  {it.detail}
                </div>
              </div>

              <span
                className="shrink-0 flex items-center gap-1 font-sans text-xs font-medium"
                style={{ color }}
              >
                <span className="hidden sm:inline">{it.fixLabel}</span>
                <ChevronRight className="w-4 h-4" />
              </span>
            </Link>
          )
        })}

        {extra > 0 && (
          <Link
            href="/flipper/pipeline"
            className="block text-center font-sans text-xs py-2"
            style={{ color: 'var(--play-muted)' }}
          >
            +{extra} more to tackle →
          </Link>
        )}
      </div>
    </section>
  )
}
