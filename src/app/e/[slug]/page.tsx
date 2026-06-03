import { notFound } from 'next/navigation'
import { createServiceClient, createServerSupabaseClient } from '@/lib/supabase'
import CameraUI from '@/components/camera-ui'
import type { Database } from '@/types/database'

type EventRow = Database['public']['Tables']['events']['Row']

export default async function GuestPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params

  const serviceClient = createServiceClient()

  let event: EventRow | null = null
  try {
    const { data } = await serviceClient
      .from('events')
      .select('*')
      .eq('slug', slug)
      .single()
    event = data as EventRow | null
  } catch {
    notFound()
  }

  if (!event) notFound()

  let coverImageUrl: string | null = null
  if (event.cover_image_path) {
    if (event.cover_image_path.startsWith('/')) {
      coverImageUrl = event.cover_image_path
    } else {
      coverImageUrl = serviceClient.storage
        .from('photos')
        .getPublicUrl(event.cover_image_path).data.publicUrl
    }
  }

  const supabaseServer = await createServerSupabaseClient()
  const { data: authData } = await supabaseServer.auth.getUser()
  const authUser = authData?.user

  let backUrl: string
  if (authUser) {
    backUrl = '/dashboard'
    if (authUser.id !== event.host_id) {
      await serviceClient.from('event_participants').upsert(
        { event_id: event.id, user_id: authUser.id },
        { onConflict: 'event_id,user_id', ignoreDuplicates: true }
      )
    }
  } else {
    backUrl = `/e/${slug}/gallery`
  }

  return <CameraUI event={event} slug={slug} coverImageUrl={coverImageUrl} backUrl={backUrl} />
}
