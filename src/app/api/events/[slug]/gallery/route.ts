import { NextRequest, NextResponse } from 'next/server'
import { createServerSupabaseClient, createServiceClient } from '@/lib/supabase'

const DEFAULT_LIMIT = 50
const MAX_LIMIT = 100

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ slug: string }> }
) {
  const { slug } = await params

  const supabase = await createServerSupabaseClient()
  const { data: { user } } = await supabase.auth.getUser()

  const serviceClient = createServiceClient()

  const { data: event } = await serviceClient
    .from('events')
    .select('id, slug, name, event_date, reveal_at, closes_at, host_id, cover_image_path')
    .eq('slug', slug)
    .single()

  if (!event) {
    return NextResponse.json({ error: 'Not Found' }, { status: 404 })
  }

  const now = new Date().toISOString()
  const is_revealed = event.reveal_at === null || event.reveal_at <= now
  const isHost = user !== null && user.id === event.host_id

  if (!isHost && !is_revealed) {
    return NextResponse.json(
      { error: 'not_revealed', reveal_at: event.reveal_at, is_revealed: false },
      { status: 403 }
    )
  }

  const { searchParams } = new URL(request.url)
  const limitParam = parseInt(searchParams.get('limit') ?? String(DEFAULT_LIMIT), 10)
  const limit = Math.max(1, Math.min(isNaN(limitParam) ? DEFAULT_LIMIT : limitParam, MAX_LIMIT))
  const offsetRaw = parseInt(searchParams.get('offset') ?? '0', 10)
  const offset = isNaN(offsetRaw) || offsetRaw < 0 ? 0 : offsetRaw

  const { data: photos, error, count } = await serviceClient
    .from('photos')
    .select('id, storage_path, tags, tagging_status, uploaded_at', { count: 'exact' })
    .eq('event_id', event.id)
    .eq('is_flagged', false)
    .order('uploaded_at', { ascending: false })
    .range(offset, offset + limit - 1)

  if (error) {
    console.error('[gallery] Query error:', error)
    return NextResponse.json({ error: 'Gallery fetch failed' }, { status: 500 })
  }

  const items = (photos ?? []).map((photo) => {
    const { data: { publicUrl } } = serviceClient.storage
      .from('photos')
      .getPublicUrl(photo.storage_path)
    return {
      id: photo.id,
      url: publicUrl,
      tags: photo.tags ?? [],
      tagging_status: photo.tagging_status,
      uploaded_at: photo.uploaded_at,
    }
  })

  return NextResponse.json({
    event: {
      id: event.id,
      slug: event.slug,
      name: event.name,
      event_date: event.event_date,
      reveal_at: event.reveal_at,
      closes_at: event.closes_at,
      cover_image_path: event.cover_image_path ?? null,
    },
    total: count ?? 0,
    offset,
    limit,
    photos: items,
  })
}
