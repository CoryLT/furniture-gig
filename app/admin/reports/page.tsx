import { createClient } from '@/lib/supabase/server'
import Link from 'next/link'
import { formatDate } from '@/lib/utils'
import ReportActions from './ReportActions'
import { ArrowLeft, Flag } from 'lucide-react'

type ReportRow = {
  id: string
  reporter_user_id: string | null
  image_kind: string
  file_path: string
  bucket: string
  source_row_id: string | null
  owner_user_id: string | null
  reason: string
  status: string
  admin_notes: string | null
  created_at: string
  resolved_at: string | null
}

const TABS = [
  { key: 'pending', label: 'Pending' },
  { key: 'resolved', label: 'Resolved' },
] as const

export default async function AdminReportsPage({
  searchParams,
}: {
  searchParams: { tab?: string }
}) {
  const supabase = createClient()

  const tabFromUrl = (searchParams?.tab ?? 'pending') as 'pending' | 'resolved'
  const currentTab = tabFromUrl === 'resolved' ? 'resolved' : 'pending'

  const statusFilter =
    currentTab === 'pending'
      ? ['pending']
      : ['resolved_removed', 'resolved_kept', 'dismissed']

  const { data: reportsRaw } = await supabase
    .from('image_reports')
    .select('*')
    .in('status', statusFilter)
    .order('created_at', { ascending: false })

  const reports = (reportsRaw ?? []) as unknown as ReportRow[]

  // Build public URLs for the images
  const reportsWithUrls = reports.map((r) => ({
    ...r,
    publicUrl: supabase.storage.from(r.bucket).getPublicUrl(r.file_path).data.publicUrl,
  }))

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      <Link
        href="/admin"
        className="inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground transition-colors"
      >
        <ArrowLeft className="w-4 h-4" />
        Back to dashboard
      </Link>

      <div>
        <h1 className="text-3xl text-foreground flex items-center gap-2">
          <Flag className="w-7 h-7" />
          Image reports
        </h1>
        <p className="text-muted-foreground mt-1">
          Review user-reported images and decide whether to remove them.
        </p>
      </div>

      {/* Tabs */}
      <div className="border-b border-border">
        <nav className="flex gap-1 -mb-px" aria-label="Tabs">
          {TABS.map((tab) => {
            const isActive = currentTab === tab.key
            return (
              <Link
                key={tab.key}
                href={`/admin/reports?tab=${tab.key}`}
                className={
                  isActive
                    ? 'px-4 py-2 text-sm font-medium border-b-2 border-accent text-foreground'
                    : 'px-4 py-2 text-sm font-medium border-b-2 border-transparent text-muted-foreground hover:text-foreground transition-colors'
                }
              >
                {tab.label}
              </Link>
            )
          })}
        </nav>
      </div>

      {reportsWithUrls.length === 0 ? (
        <div className="card card-body text-center py-12">
          <p className="text-muted-foreground">
            {currentTab === 'pending' ? 'No pending reports.' : 'No resolved reports yet.'}
          </p>
        </div>
      ) : (
        <div className="space-y-4">
          {reportsWithUrls.map((r) => (
            <div key={r.id} className="card card-body">
              <div className="flex flex-col sm:flex-row gap-4">
                {/* Image preview */}
                <div className="shrink-0">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={r.publicUrl}
                    alt="Reported"
                    className="w-32 h-32 sm:w-40 sm:h-40 object-cover rounded-md border border-border"
                  />
                </div>

                {/* Details */}
                <div className="flex-1 space-y-2">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="text-xs px-2 py-0.5 rounded-full bg-secondary text-foreground font-mono">
                      {r.image_kind}
                    </span>
                    <span className="text-xs text-muted-foreground">
                      Reported {formatDate(r.created_at)}
                    </span>
                    {currentTab === 'resolved' && r.resolved_at && (
                      <span className="text-xs text-muted-foreground">
                        · Resolved {formatDate(r.resolved_at)}
                      </span>
                    )}
                  </div>

                  <div>
                    <p className="text-xs text-muted-foreground">Reason given:</p>
                    <p className="text-sm text-foreground whitespace-pre-wrap">{r.reason}</p>
                  </div>

                  {r.admin_notes && (
                    <div>
                      <p className="text-xs text-muted-foreground">Admin notes:</p>
                      <p className="text-sm text-foreground whitespace-pre-wrap">
                        {r.admin_notes}
                      </p>
                    </div>
                  )}

                  <div className="text-xs text-muted-foreground font-mono break-all">
                    {r.bucket}/{r.file_path}
                  </div>

                  {currentTab === 'pending' && (
                    <div className="pt-2">
                      <ReportActions
                        reportId={r.id}
                        bucket={r.bucket}
                        filePath={r.file_path}
                        imageKind={r.image_kind}
                      />
                    </div>
                  )}

                  {currentTab === 'resolved' && (
                    <p className="text-sm font-mono text-foreground pt-1">
                      Status: {r.status}
                    </p>
                  )}
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
