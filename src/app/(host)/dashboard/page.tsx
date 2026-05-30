import { createServerSupabaseClient } from '@/lib/supabase'
import { redirect } from 'next/navigation'
import Link from 'next/link'
import { QrCode } from 'lucide-react'
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
  photos: { count: number }[]
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

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function getCoverUrl(supabase: any, path: string | null): string | null {
  if (!path) return null
  if (path.startsWith('/')) return path
  return supabase.storage.from('photos').getPublicUrl(path).data.publicUrl
}

export default async function DashboardPage() {
  const supabase = await createServerSupabaseClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data, error } = await supabase
    .from('events')
    .select('id, slug, name, event_date, closes_at, reveal_at, cover_image_path, photos(count)')
    .eq('host_id', user.id)
    .order('event_date', { ascending: false })

  if (error) console.error('[dashboard] supabase error:', error)

  const events = (data ?? []) as EventRow[]

  const active = events.filter(isActive)
  const albums = events.filter(e => !isActive(e))

  return (
    <div className="px-5 pt-10 pb-4">
      {/* Header */}
      <div className="flex items-center justify-between mb-8">
        <span className="text-white font-bold text-2xl">✳ fluke</span>
        <Link
          href="/join"
          className="flex items-center gap-2 px-4 py-2 bg-zinc-800 hover:bg-zinc-700 rounded-full text-white text-sm font-medium transition-colors"
        >
          <QrCode size={15} />
          Join
        </Link>
      </div>

      {/* ACTIVE section */}
      {active.length > 0 && (
        <section className="mb-8">
          <p className="text-zinc-500 text-xs font-semibold uppercase tracking-widest mb-4">Active</p>
          <div className="flex flex-col gap-4">
            {active.map(event => (
              <EventHeroCard
                key={event.id}
                slug={event.slug}
                name={event.name}
                eventDate={event.event_date}
                closesAt={event.closes_at}
                coverImageUrl={getCoverUrl(supabase, event.cover_image_path)}
                timeRemaining={getTimeRemaining(event.closes_at, event.event_date)}
              />
            ))}
          </div>
        </section>
      )}

      {/* ALBUMS section */}
      {albums.length > 0 && (
        <section>
          <p className="text-zinc-500 text-xs font-semibold uppercase tracking-widest mb-4">Albums</p>
          <div className="flex flex-col gap-8">
            {albums.map(event => (
              <EventAlbumRow
                key={event.id}
                slug={event.slug}
                name={event.name}
                eventDate={event.event_date}
                photoCount={event.photos?.[0]?.count ?? 0}
                coverImageUrl={getCoverUrl(supabase, event.cover_image_path)}
              />
            ))}
          </div>
        </section>
      )}

      {/* Empty state */}
      {events.length === 0 && (
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
