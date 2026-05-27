import { createServerSupabaseClient } from '@/lib/supabase'
import type { Database } from '@/types/database'
import { redirect } from 'next/navigation'
import Link from 'next/link'
import { EventCard } from '@/components/event-card'

type EventRow = Database['public']['Tables']['events']['Row']
type EventWithCount = Pick<EventRow, 'id' | 'slug' | 'name' | 'event_date' | 'shot_cap' | 'reveal_at'> & {
  photos: { count: number }[]
}

export default async function DashboardPage() {
  const supabase = await createServerSupabaseClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data } = await supabase
    .from('events')
    .select('id, slug, name, event_date, shot_cap, reveal_at, photos(count)')
    .eq('host_id', user.id)
    .order('created_at', { ascending: false })

  const events = (data ?? []) as EventWithCount[]

  return (
    <>
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-xl font-bold text-white">Meus Eventos</h1>
        <Link href="/events/new" className="text-sm bg-white text-black px-4 py-2 rounded-lg font-medium hover:bg-zinc-100 transition-colors">
          + Novo Evento
        </Link>
      </div>
      {events.length === 0 ? (
        <div className="text-center py-16 text-zinc-500">
          <p className="mb-4">Nenhum evento ainda.</p>
          <Link href="/events/new" className="text-white underline">Crie seu primeiro evento</Link>
        </div>
      ) : (
        <div className="space-y-4">
          {events.map(event => (
            <EventCard
              key={event.id}
              id={event.id}
              name={event.name}
              slug={event.slug}
              event_date={event.event_date}
              photo_count={event.photos?.[0]?.count ?? 0}
              reveal_at={event.reveal_at}
              shot_cap={event.shot_cap}
            />
          ))}
        </div>
      )}
    </>
  )
}
