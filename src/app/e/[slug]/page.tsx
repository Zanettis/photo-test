import { notFound } from 'next/navigation'
import { createServiceClient } from '@/lib/supabase'
import CameraUI from '@/components/camera-ui'
import type { Database } from '@/types/database'

type EventRow = Database['public']['Tables']['events']['Row']

export default async function GuestPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params
  const supabase = createServiceClient()

  const { data: event } = await supabase
    .from('events')
    .select('*')
    .eq('slug', slug)
    .single()

  if (!event) notFound()

  return <CameraUI event={event as EventRow} slug={slug} />
}
