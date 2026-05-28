import { NextRequest, NextResponse } from 'next/server'
import { createServerSupabaseClient, createServiceClient } from '@/lib/supabase'

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ slug: string }> }
) {
  const { slug } = await params
  const serviceClient = createServiceClient()

  const { data: event } = await serviceClient
    .from('events')
    .select('id, slug, name, event_date, shot_cap, reveal_at, closes_at')
    .eq('slug', slug)
    .single()

  if (!event) {
    return NextResponse.json({ error: 'not_found' }, { status: 404 })
  }

  const now = new Date().toISOString()
  const is_open = event.closes_at === null || event.closes_at > now
  const is_revealed = event.reveal_at === null || event.reveal_at <= now

  if (!is_open) {
    return NextResponse.json({ error: 'event_closed' }, { status: 410 })
  }

  const uploaderToken = request.headers.get('X-Uploader-Token')
  let shots_used = 0

  if (uploaderToken) {
    const { count } = await serviceClient
      .from('photos')
      .select('id', { count: 'exact', head: true })
      .eq('event_id', event.id)
      .eq('uploader_token', uploaderToken)

    shots_used = count ?? 0
  }

  return NextResponse.json({
    slug: event.slug,
    name: event.name,
    event_date: event.event_date,
    is_open,
    is_revealed,
    reveal_at: event.reveal_at,
    shot_cap: event.shot_cap,
    shots_used,
  })
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ slug: string }> }
) {
  const { slug } = await params

  const supabase = await createServerSupabaseClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { data: event } = await supabase
    .from('events')
    .select('id, slug, name, host_id, event_date, closes_at, closes_notified_at')
    .eq('slug', slug)
    .single()

  if (!event) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  if (event.host_id !== user.id) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  let body: Record<string, unknown>
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: 'invalid_json' }, { status: 400 })
  }

  const { name, closes_at } = body as { name?: unknown; closes_at?: unknown }

  if (name === undefined && closes_at === undefined) {
    return NextResponse.json({ error: 'nothing_to_update' }, { status: 400 })
  }

  const patch: { name?: string; closes_at?: string | null } = {}

  if (name !== undefined) {
    if (typeof name !== 'string' || name.trim().length === 0 || name.trim().length > 100) {
      return NextResponse.json({ error: 'invalid_name' }, { status: 400 })
    }
    patch.name = name.trim()
  }

  if (closes_at !== undefined) {
    if (closes_at === null) {
      patch.closes_at = null
    } else if (typeof closes_at === 'string' && !isNaN(Date.parse(closes_at))) {
      const closesDate = new Date(closes_at)
      const now = new Date()
      if (closesDate <= now) {
        return NextResponse.json({ error: 'closes_at_must_be_future' }, { status: 400 })
      }
      const eventDate = new Date(event.event_date)
      const maxDate = new Date(eventDate)
      maxDate.setDate(maxDate.getDate() + 90)
      if (closesDate > maxDate) {
        return NextResponse.json({ error: 'closes_at_exceeds_90_days' }, { status: 400 })
      }
      patch.closes_at = closes_at
    } else {
      return NextResponse.json({ error: 'invalid_closes_at' }, { status: 400 })
    }
  }

  const { data: updated, error } = await supabase
    .from('events')
    .update(patch)
    .eq('id', event.id)
    .select('id, slug, name, event_date, closes_at')
    .single()

  if (error || !updated) {
    console.error('[patch-event] Update failed:', error)
    return NextResponse.json({ error: 'update_failed' }, { status: 500 })
  }

  return NextResponse.json({
    id: updated.id,
    slug: updated.slug,
    name: updated.name,
    event_date: updated.event_date,
    closes_at: updated.closes_at,
  })
}
