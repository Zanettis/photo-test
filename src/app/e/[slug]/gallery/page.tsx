import { notFound } from 'next/navigation'
import { createServiceClient, createServerSupabaseClient } from '@/lib/supabase'
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
    return (
      <GuestGalleryClient
        mode="countdown"
        slug={slug}
        eventName={event.name}
        revealAt={event.reveal_at!}
        eventDate={event.event_date}
        closesAt={event.closes_at}
        isAuthenticated={false}
      />
    )
  }

  const supabaseServer = await createServerSupabaseClient()
  const { data: authData } = await supabaseServer.auth.getUser()

  return (
    <GuestGalleryClient
      mode="gallery"
      slug={slug}
      eventName={event.name}
      revealAt={event.reveal_at}
      eventDate={event.event_date}
      closesAt={event.closes_at}
      isAuthenticated={!!authData?.user}
    />
  )
}
