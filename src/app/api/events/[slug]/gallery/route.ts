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
    .select('id, slug, name, event_date, reveal_at, closes_at, host_id, cover_image_path, guest_cap, shot_cap, settings')
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

  const eventSettings = (typeof event.settings === 'object' && !Array.isArray(event.settings) && event.settings !== null)
    ? event.settings as Record<string, unknown>
    : {}
  const publicGallery = eventSettings.public_gallery !== false
  const uploaderToken = request.headers.get('X-Uploader-Token')

  let photoQuery = serviceClient
    .from('photos')
    .select('id, storage_path, tags, tagging_status, uploaded_at', { count: 'exact' })
    .eq('event_id', event.id)
    .eq('is_flagged', false)
    .order('uploaded_at', { ascending: false })
    .range(offset, offset + limit - 1)

  if (!isHost && !publicGallery) {
    if (!uploaderToken) {
      return NextResponse.json({
        event: {
          id: event.id, slug: event.slug, name: event.name, event_date: event.event_date,
          reveal_at: event.reveal_at, closes_at: event.closes_at, cover_image_path: event.cover_image_path ?? null,
          guest_cap: event.guest_cap, shot_cap: event.shot_cap, settings: eventSettings,
        },
        cover_image_url: null, unique_uploaders: 0, total: 0, offset, limit, photos: [],
      })
    }
    photoQuery = photoQuery.eq('uploader_token', uploaderToken)
  }

  const [photosResult, uploaderRows] = await Promise.all([
    photoQuery,
    serviceClient
      .from('photos')
      .select('uploader_token')
      .eq('event_id', event.id)
      .eq('is_flagged', false),
  ])

  if (photosResult.error) {
    console.error('[gallery] Query error:', photosResult.error)
    return NextResponse.json({ error: 'Gallery fetch failed' }, { status: 500 })
  }

  const unique_uploaders = uploaderRows.data
    ? new Set(uploaderRows.data.map(r => r.uploader_token)).size
    : 0

  const cover_image_url = event.cover_image_path
    ? serviceClient.storage.from('photos').getPublicUrl(event.cover_image_path).data.publicUrl
    : null

  const items = await Promise.all(
    (photosResult.data ?? []).map(async (photo) => {
      let url: string
      if (!publicGallery) {
        const { data: signed } = await serviceClient.storage
          .from('photos')
          .createSignedUrl(photo.storage_path, 3600)
        url = signed?.signedUrl ?? ''
      } else {
        url = serviceClient.storage
          .from('photos')
          .getPublicUrl(photo.storage_path).data.publicUrl
      }
      return {
        id: photo.id,
        url,
        tags: photo.tags ?? [],
        tagging_status: photo.tagging_status,
        uploaded_at: photo.uploaded_at,
      }
    })
  )

  return NextResponse.json({
    event: {
      id: event.id,
      slug: event.slug,
      name: event.name,
      event_date: event.event_date,
      reveal_at: event.reveal_at,
      closes_at: event.closes_at,
      cover_image_path: event.cover_image_path ?? null,
      guest_cap: event.guest_cap,
      shot_cap: event.shot_cap,
      settings: eventSettings,
    },
    cover_image_url,
    unique_uploaders,
    total: photosResult.count ?? 0,
    offset,
    limit,
    photos: items,
  })
}
