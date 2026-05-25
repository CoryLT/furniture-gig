import LegalDocPage from '@/components/shared/LegalDocPage'

// Always load fresh from DB in case admin updates the agreement
export const dynamic = 'force-dynamic'
export const revalidate = 0

export const metadata = {
  title: 'Terms of Service · FlipWork',
  description: 'FlipWork Terms of Service.',
}

export default function TermsPage() {
  return <LegalDocPage title="Terms of Service" />
}
