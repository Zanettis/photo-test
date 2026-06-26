import { createServerSupabaseClient } from '@/lib/supabase'
import { redirect } from 'next/navigation'
import { EventAlbumRow } from '@/components/event-album-row'

interface EventRow {
  id: string
  slug: string
  name: string
  event_date: string
  closes_at: string | null
  reveal_at: string | null
  cover_image_path: string | null
}

function isActive(event: EventRow): boolean {
  const sevenDaysAgo = new Date()
  sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7)
  const eventDate = new Date(event.event_date + 'T12:00:00')
  if (eventDate < sevenDaysAgo) return false
  if (event.closes_at && new Date(event.closes_at) <= new Date()) return false
  return true
}

export default async function TapesPage() {
  const supabase = await createServerSupabaseClient()

  const { data: authData } = await supabase.auth.getUser()
  const user = authData?.user
  if (!user) redirect('/login')

  const { data: hostedData, error } = await supabase
    .from('events')
    .select('id, slug, name, event_date, closes_at, reveal_at, cover_image_path')
    .eq('host_id', user.id)
    .order('event_date', { ascending: false })

  if (error) console.error('[tapes] supabase error:', error)

  const hostedEvents = (hostedData ?? []) as EventRow[]

  const { data: participationData } = await supabase
    .from('event_participants')
    .select('events(id, slug, name, event_date, closes_at, reveal_at, cover_image_path)')
    .eq('user_id', user.id)

  const participatedEvents = ((participationData ?? [])
    .map((p: { events: EventRow | null }) => p.events)
    .filter(Boolean)) as EventRow[]

  // Tapes shows only past/closed events from both hosted + participated
  const allPastEvents = [
    ...hostedEvents.filter(e => !isActive(e)),
    ...participatedEvents.filter(e => !isActive(e)),
  ]

  // Fetch thumbnails
  const eventIds = allPastEvents.map(e => e.id)
  const photosByEvent: Record<string, string[]> = {}
  const photoCountByEvent: Record<string, number> = {}

  if (eventIds.length > 0) {
    const { data: photosData } = await supabase
      .from('photos')
      .select('event_id, storage_path')
      .in('event_id', eventIds)
      .order('uploaded_at', { ascending: true })

    for (const photo of photosData ?? []) {
      if (!photosByEvent[photo.event_id]) {
        photosByEvent[photo.event_id] = []
        photoCountByEvent[photo.event_id] = 0
      }
      photoCountByEvent[photo.event_id]++
      if (photosByEvent[photo.event_id].length < 4) {
        photosByEvent[photo.event_id].push(photo.storage_path)
      }
    }
  }

  function getEventPhotos(eventId: string): { url: string }[] {
    return (photosByEvent[eventId] ?? []).map(path => ({
      url: supabase.storage.from('photos').getPublicUrl(path).data.publicUrl,
    }))
  }

  return (
    <div className="px-4 pt-10 pb-4">
      {/* Header */}
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-white">✳ fluke</h1>
      </div>

      {allPastEvents.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-20 gap-2 text-center">
          <p className="text-zinc-500 text-sm">Nenhum album ainda.</p>
          <p className="text-zinc-600 text-xs">Seus eventos encerrados aparecerão aqui.</p>
        </div>
      ) : (
        <section>
          <p className="text-zinc-500 text-xs font-bold uppercase tracking-widest mb-1">Tapes</p>
          <div className="flex flex-col">
            {allPastEvents.map(event => (
              <EventAlbumRow
                key={event.id}
                slug={event.slug}
                name={event.name}
                eventDate={event.event_date}
                photos={getEventPhotos(event.id)}
                photoCount={photoCountByEvent[event.id] ?? 0}
              />
            ))}
          </div>
        </section>
      )}
    </div>
  )
}
