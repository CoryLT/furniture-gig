import { redirect } from 'next/navigation'

// The dashboard has been merged into /play. This route now just forwards there
// so old links, bookmarks, and any leftover internal references still land home.
export default function HomePage() {
  redirect('/play')
}
