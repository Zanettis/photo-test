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

  const supabase = createServiceClient()
  let coverImageUrl: string | null = null
  if (event.cover_image_path) {
    if (event.cover_image_path.startsWith('/')) {
      coverImageUrl = event.cover_image_path
    } else {
      coverImageUrl = supabase.storage
        .from('photos')
        .getPublicUrl(event.cover_image_path).data.publicUrl
    }
  }

  return <CameraUI event={event} slug={slug} coverImageUrl={coverImageUrl} />
}
