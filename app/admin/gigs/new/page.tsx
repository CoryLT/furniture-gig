import GigForm from '@/components/admin/GigForm'

export default function NewGigPage() {
  return (
    <div className="space-y-6">
      <div>
        <a href="/admin/gigs" className="text-sm text-muted-foreground hover:text-foreground transition-colors">
          ← Back to gigs
        </a>
        <h1 className="text-3xl text-foreground mt-2">New Gig</h1>
      </div>
      <GigForm mode="create" />
    </div>
  )
}
