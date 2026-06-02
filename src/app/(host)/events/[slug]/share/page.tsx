import { notFound, redirect } from 'next/navigation'
import Link from 'next/link'
import { ShareCard } from '@/components/wizard/share-card'
import { createServerSupabaseClient } from '@/lib/supabase'

interface Props { params: Promise<{ slug: string }> }

export default async function SharePage({ params }: Props) {
  const { slug } = await params
  const supabase = await createServerSupabaseClient()

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: event } = await supabase
    .from('events')
    .select('id, name, slug, host_id')
    .eq('slug', slug)
    .single()

  if (!event || event.host_id !== user.id) notFound()

  return (
    <div className="min-h-screen bg-[#0a0a0a] flex flex-col items-center justify-center px-6 py-12">
      <div className="w-full max-w-sm flex flex-col items-center gap-8">
        {/* success mark */}
        <div className="flex flex-col items-center gap-3 text-center">
          <div className="w-16 h-16 rounded-full bg-zinc-800 flex items-center justify-center text-3xl">✓</div>
          <h1 className="text-2xl font-bold text-white">{event.name} está pronto!</h1>
          <p className="text-zinc-500 text-sm">Compartilhe com os convidados</p>
        </div>

        <ShareCard eventName={event.name} slug={event.slug} />

        <div className="flex flex-col gap-3 w-full pt-2">
          <Link
            href={`/events/${slug}`}
            className="w-full text-center py-3 bg-zinc-900 text-white font-medium rounded-2xl hover:bg-zinc-800 transition-colors text-sm"
          >
            Ver meu evento
          </Link>
          <Link
            href="/dashboard"
            className="w-full text-center py-3 text-zinc-500 hover:text-zinc-300 transition-colors text-sm"
          >
            Ir para o Dashboard
          </Link>
        </div>
      </div>
    </div>
  )
}
