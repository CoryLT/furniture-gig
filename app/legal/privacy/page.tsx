import LegalDocPage from '@/components/shared/LegalDocPage'

// Always load fresh from DB in case admin updates the agreement
export const dynamic = 'force-dynamic'
export const revalidate = 0

export const metadata = {
  title: 'Privacy Policy · FlipWork',
  description: 'FlipWork Privacy Policy.',
}

export default function PrivacyPage() {
  return <LegalDocPage title="Privacy Policy" />
}
