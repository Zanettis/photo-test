import { NextRequest, NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase'

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
