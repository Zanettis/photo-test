import { NextRequest, NextResponse } from 'next/server'
import { createServerSupabaseClient } from '@/lib/supabase'
import type { Database } from '@/types/database'
import { nanoid } from 'nanoid'

type EventRow = Database['public']['Tables']['events']['Row']
type EventInsert = Database['public']['Tables']['events']['Insert']

const PLAN_LIMITS: Record<string, number> = {
  free: 1,
  basic: 5,
  complete: Infinity,
}

export async function POST(request: NextRequest) {
  const supabase = await createServerSupabaseClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const body = await request.json()
  const { name, event_date, shot_cap, reveal_at } = body

  if (!name || typeof name !== 'string' || name.trim().length === 0) {
    return NextResponse.json({ error: 'name is required' }, { status: 400 })
  }
  if (!event_date || !/^\d{4}-\d{2}-\d{2}$/.test(event_date)) {
    return NextResponse.json({ error: 'event_date must be YYYY-MM-DD' }, { status: 400 })
  }
  if (shot_cap !== null && shot_cap !== undefined && ![5, 10, 20].includes(shot_cap)) {
    return NextResponse.json({ error: 'shot_cap must be 5, 10, 20, or null' }, { status: 400 })
  }

  const { data: hostData } = await supabase.from('hosts').select('*').eq('id', user.id).single()
  const host = hostData as Database['public']['Tables']['hosts']['Row'] | null
  if (!host) return NextResponse.json({ error: 'Host not found' }, { status: 404 })

  const { count } = await supabase
    .from('events')
    .select('id', { count: 'exact', head: true })
    .eq('host_id', user.id)

  const limit = PLAN_LIMITS[host.plan] ?? 1
  if ((count ?? 0) >= limit) {
    return NextResponse.json({ error: 'Plan limit reached' }, { status: 402 })
  }

  const slug = nanoid(8)
  const insertData: EventInsert = {
    host_id: user.id,
    slug,
    name: name.trim(),
    event_date,
    shot_cap: shot_cap ?? null,
    reveal_at: reveal_at ?? null,
    settings: {},
  }

  const { data: eventData, error } = await supabase
    .from('events')
    .insert(insertData)
    .select()
    .single()

  const event = eventData as EventRow | null
  if (error || !event) return NextResponse.json({ error: error?.message ?? 'Insert failed' }, { status: 500 })

  const link = `${process.env.NEXT_PUBLIC_APP_URL}/e/${slug}`
  return NextResponse.json(
    { id: event.id, slug, name: event.name, event_date, shot_cap: event.shot_cap, reveal_at: event.reveal_at, link },
    { status: 201 }
  )
}

export async function GET() {
  const supabase = await createServerSupabaseClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  type EventWithCount = Pick<EventRow, 'id' | 'slug' | 'name' | 'event_date' | 'shot_cap' | 'reveal_at' | 'closes_at' | 'created_at'> & {
    photos: { count: number }[]
  }

  const { data } = await supabase
    .from('events')
    .select('id, slug, name, event_date, shot_cap, reveal_at, closes_at, created_at, photos(count)')
    .eq('host_id', user.id)
    .order('created_at', { ascending: false })

  const events = (data ?? []) as EventWithCount[]
  return NextResponse.json(events)
}
