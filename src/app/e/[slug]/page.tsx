import { notFound } from 'next/navigation'
import { createServiceClient } from '@/lib/supabase'
import CameraUI from '@/components/camera-ui'
import type { Database } from '@/types/database'

type EventRow = Database['public']['Tables']['events']['Row']

export default async function GuestPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params

  let event: EventRow | null = null
  try {
    const supabase = createServiceClient()
    const { data } = await supabase
      .from('events')
      .select('*')
      .eq('slug', slug)
      .single()
    event = data as EventRow | null
  } catch {
    notFound()
  }

  if (!event) notFound()

  return <CameraUI event={event} slug={slug} />
}
