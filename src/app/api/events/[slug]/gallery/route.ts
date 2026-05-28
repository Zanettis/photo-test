import { NextRequest, NextResponse } from 'next/server'
import { createServerSupabaseClient, createServiceClient } from '@/lib/supabase'

const DEFAULT_LIMIT = 50
const MAX_LIMIT = 100

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ slug: string }> }
) {
  const { slug } = await params

  // Auth: server client honors RLS
  const supabase = await createServerSupabaseClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  // Ownership check via RLS policy "host_manage_events"
  const { data: event } = await supabase
    .from('events')
    .select('id, slug, name, event_date, reveal_at, closes_at, host_id')
    .eq('slug', slug)
    .single()

  if (!event) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }
  if (event.host_id !== user.id) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const { searchParams } = new URL(request.url)
  const limitParam = parseInt(searchParams.get('limit') ?? String(DEFAULT_LIMIT), 10)
  const limit = Math.max(1, Math.min(isNaN(limitParam) ? DEFAULT_LIMIT : limitParam, MAX_LIMIT))
  const offsetRaw = parseInt(searchParams.get('offset') ?? '0', 10)
  const offset = isNaN(offsetRaw) || offsetRaw < 0 ? 0 : offsetRaw

  // Fetch photos for this event (host sees all, RLS already filters)
  const { data: photos, error, count } = await supabase
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

  // Attach public URLs
  const serviceClient = createServiceClient()
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
    },
    total: count ?? 0,
    offset,
    limit,
    photos: items,
  })
}
