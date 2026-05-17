import { createClient } from '@/lib/supabase/server'
import { notFound } from 'next/navigation'
import Image from 'next/image'
import Link from 'next/link'
import { ArrowLeft } from 'lucide-react'
import { PublicWorkerProfileClient } from '@/components/worker/PublicWorkerProfileClient'

interface WorkerProfilePageProps {
  params: Promise<{ username: string }>
}

export default async function WorkerProfilePage({ params }: WorkerProfilePageProps) {
  const { username } = await params
  const supabase = await createClient()

  const { data: profile } = await supabase
    .from('worker_profiles')
    .select('*')
    .eq('username', username)
    .single()

  if (!profile) {
    notFound()
  }

  const { data: photos } = await supabase
    .from('worker_photo_galleries')
    .select('*')
    .eq('worker_user_id', profile.user_id)
    .order('created_at', { ascending: false })

  return <PublicWorkerProfileClient profile={profile} photos={photos || []} />
}