import { redirect } from 'next/navigation'

// The marketplace is the front door for EVERYONE — logged in or out.
// /home is still accessible from the hamburger nav as a personalized dashboard.
export const dynamic = 'force-dynamic'
export const revalidate = 0

export default function HomePage() {
  redirect('/marketplace')
}
