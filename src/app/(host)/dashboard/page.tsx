import { createServerSupabaseClient } from '@/lib/supabase'
import { redirect } from 'next/navigation'
import Link from 'next/link'
import { Plus, QrCode } from 'lucide-react'
import { EventHeroCard } from '@/components/event-hero-card'
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

function getTimeRemaining(closesAt: string | null, eventDate: string): string {
  const deadline = closesAt
    ? new Date(closesAt)
    : new Date(eventDate + 'T23:59:59')
  const now = new Date()
  const diff = deadline.getTime() - now.getTime()
  if (diff <= 0) return ''
  const days = Math.floor(diff / 86400000)
  const hours = Math.floor((diff % 86400000) / 3600000)
  if (days > 0) return `${days}d ${hours}h restantes`
  return `${hours}h restantes`
}

function isActive(event: EventRow): boolean {
  const sevenDaysAgo = new Date()
  sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7)
  const eventDate = new Date(event.event_date + 'T12:00:00')
  if (eventDate < sevenDaysAgo) return false
  if (event.closes_at && new Date(event.closes_at) <= new Date()) return false
  return true
}

function getCoverUrl(supabase: Awaited<ReturnType<typeof createServerSupabaseClient>>, path: string | null): string | null {
  if (!path) return null
  if (path.startsWith('/') || path.startsWith('http')) return path
  return supabase.storage.from('photos').getPublicUrl(path).data.publicUrl
}

export default async function DashboardPage() {
  const supabase = await createServerSupabaseClient()

  const { data: authData } = await supabase.auth.getUser()
  const user = authData?.user
  if (!user) redirect('/login')

  const { data, error } = await supabase
    .from('events')
    .select('id, slug, name, event_date, closes_at, reveal_at, cover_image_path')
    .eq('host_id', user.id)
    .order('event_date', { ascending: false })

  if (error) console.error('[dashboard] supabase error:', error)

  const events = (data ?? []) as EventRow[]

  const { data: participationData } = await supabase
    .from('event_participants')
    .select('events(id, slug, name, event_date, closes_at, reveal_at, cover_image_path)')
    .eq('user_id', user.id)

  const participatedEvents = ((participationData ?? [])
    .map((p: { events: EventRow | null }) => p.events)
    .filter(Boolean)) as EventRow[]

  const active = events.filter(isActive)
  const albums = events.filter(e => !isActive(e))

  const participatedActive = participatedEvents.filter(isActive)
  const participatedAlbums = participatedEvents.filter(e => !isActive(e))

  // Fetch thumbnails for all album events
  const albumEvents = [...albums, ...participatedAlbums]
  const albumEventIds = albumEvents.map(e => e.id)

  const photosByEvent: Record<string, string[]> = {}
  const photoCountByEvent: Record<string, number> = {}

  if (albumEventIds.length > 0) {
    const { data: photosData } = await supabase
      .from('photos')
      .select('event_id, storage_path')
      .in('event_id', albumEventIds)
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

  const allActive = [
    ...active.map(e => ({ ...e, role: 'host' as const })),
    ...participatedActive.map(e => ({ ...e, role: 'guest' as const })),
  ]

  return (
    <div className="px-4 pt-10 pb-4">
      {/* Header */}
      <div className="flex items-center justify-between mb-8">
        <span className="text-white font-bold text-2xl">✳ fluke</span>
        <div className="flex items-center gap-2">
          <Link
            href="/join"
            className="flex items-center gap-1.5 px-3 py-2 bg-zinc-800 hover:bg-zinc-700 rounded-full text-white text-sm font-medium transition-colors"
          >
            <QrCode size={14} />
            Join
          </Link>
          <Link
            href="/events/new"
            className="flex items-center gap-1.5 px-3 py-2 bg-white hover:bg-zinc-100 rounded-full text-black text-sm font-medium transition-colors"
          >
            <Plus size={14} strokeWidth={2.5} />
            New
          </Link>
        </div>
      </div>

      {/* ACTIVE section */}
      {allActive.length > 0 && (
        <section className="mb-8">
          <p className="text-zinc-500 text-xs font-bold uppercase tracking-widest mb-4">Active</p>
          <div className="-mx-4 flex flex-row gap-3 overflow-x-auto snap-x snap-mandatory px-4 pb-3 [&::-webkit-scrollbar]:hidden">
            {allActive.map(event => (
              <EventHeroCard
                key={event.id}
                slug={event.slug}
                name={event.name}
                eventDate={event.event_date}
                closesAt={event.closes_at}
                coverImageUrl={getCoverUrl(supabase, event.cover_image_path)}
                timeRemaining={getTimeRemaining(event.closes_at, event.event_date)}
                role={event.role}
                primaryHref={event.role === 'guest' ? `/e/${event.slug}/gallery` : undefined}
              />
            ))}
          </div>
        </section>
      )}

      {/* ALBUMS section */}
      {(albums.length > 0 || participatedAlbums.length > 0) && (
        <section>
          <p className="text-zinc-500 text-xs font-bold uppercase tracking-widest mb-1">Albums</p>
          <div className="flex flex-col">
            {albums.map(event => (
              <EventAlbumRow
                key={event.id}
                slug={event.slug}
                name={event.name}
                eventDate={event.event_date}
                photos={getEventPhotos(event.id)}
                photoCount={photoCountByEvent[event.id] ?? 0}
              />
            ))}
            {participatedAlbums.map(event => (
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

      {/* Error state */}
      {error && (
        <div className="flex flex-col items-center justify-center py-20 gap-4 text-center">
          <p className="text-red-400 text-sm">Erro ao carregar eventos.</p>
          <p className="text-zinc-600 text-xs font-mono break-all max-w-xs">{error.message}</p>
        </div>
      )}

      {/* Empty state */}
      {!error && events.length === 0 && participatedEvents.length === 0 && (
        <div className="flex flex-col items-center justify-center py-20 gap-4 text-center">
          <p className="text-zinc-600 text-sm">Nenhum evento ainda.</p>
          <Link href="/events/new" className="text-white text-sm underline underline-offset-2">
            Crie seu primeiro evento →
          </Link>
        </div>
      )}
    </div>
  )
}
