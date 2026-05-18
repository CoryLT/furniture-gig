import { redirect } from 'next/navigation'

export default function OldWorkerProfileRedirect({
  params,
}: {
  params: { username: string }
}) {
  redirect(`/u/${params.username}`)
}
