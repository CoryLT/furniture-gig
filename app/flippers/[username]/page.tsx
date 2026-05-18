import { redirect } from 'next/navigation'

export default function OldFlipperProfileRedirect({
  params,
}: {
  params: { username: string }
}) {
  redirect(`/u/${params.username}`)
}
