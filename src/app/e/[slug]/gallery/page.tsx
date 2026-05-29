import { notFound } from 'next/navigation'
import { createServiceClient } from '@/lib/supabase'
import GuestGalleryClient from './gallery-client'

export default async function GuestGalleryPage({
  params,
}: {
  params: Promise<{ slug: string }>
}) {
  const { slug } = await params
  const serviceClient = createServiceClient()

  const { data: event } = await serviceClient
    .from('events')
    .select('id, slug, name, event_date, reveal_at, closes_at')
    .eq('slug', slug)
    .single()

  if (!event) notFound()

  const now = new Date().toISOString()
  const is_revealed = event.reveal_at === null || event.reveal_at <= now

  if (!is_revealed) {
    return <GuestGalleryClient mode="countdown" eventName={event.name} revealAt={event.reveal_at!} photos={[]} />
  }

  const { data: photos } = await serviceClient
    .from('photos')
    .select('id, storage_path, tags, uploaded_at')
    .eq('event_id', event.id)
    .eq('is_flagged', false)
    .order('uploaded_at', { ascending: false })

  const items = (photos ?? []).map((photo) => {
    const { data: { publicUrl } } = serviceClient.storage
      .from('photos')
      .getPublicUrl(photo.storage_path)
    return { id: photo.id, url: publicUrl, tags: photo.tags ?? [] }
  })

  return <GuestGalleryClient mode="gallery" eventName={event.name} revealAt={event.reveal_at} photos={items} />
}
