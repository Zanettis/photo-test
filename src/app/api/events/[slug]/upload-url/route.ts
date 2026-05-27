import { NextRequest, NextResponse } from 'next/server'
import { randomUUID } from 'crypto'
import { createServiceClient } from '@/lib/supabase'

const ALLOWED_MIME_TYPES = ['image/jpeg', 'image/png']
const MAX_FILE_SIZE = 52428800
const RATE_LIMIT = 50

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ slug: string }> }
) {
  const { slug } = await params

  let body: {
    uploader_token?: unknown
    file_name?: unknown
    mime_type?: unknown
    file_size_bytes?: unknown
  }

  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: 'invalid_body' }, { status: 400 })
  }

  const { uploader_token, file_name, mime_type, file_size_bytes } = body

  if (!uploader_token || !file_name || !mime_type || file_size_bytes === undefined) {
    return NextResponse.json({ error: 'missing_fields' }, { status: 400 })
  }

  const serviceClient = createServiceClient()

  const { data: event } = await serviceClient
    .from('events')
    .select('id, slug, shot_cap, closes_at')
    .eq('slug', slug)
    .single()

  if (!event) {
    return NextResponse.json({ error: 'not_found' }, { status: 404 })
  }

  const now = new Date().toISOString()
  const is_open = event.closes_at === null || event.closes_at > now

  if (!is_open) {
    return NextResponse.json({ error: 'event_closed' }, { status: 403 })
  }

  if (!ALLOWED_MIME_TYPES.includes(mime_type as string)) {
    return NextResponse.json({ error: 'invalid_mime_type' }, { status: 400 })
  }

  if (typeof file_size_bytes !== 'number' || file_size_bytes > MAX_FILE_SIZE) {
    return NextResponse.json({ error: 'file_too_large' }, { status: 400 })
  }

  const { count: uploadCount } = await serviceClient
    .from('photos')
    .select('id', { count: 'exact', head: true })
    .eq('event_id', event.id)
    .eq('uploader_token', uploader_token as string)

  const countBefore = uploadCount ?? 0

  // shot_cap check must precede rate_limit so the client gets the correct error
  if (event.shot_cap !== null && countBefore >= event.shot_cap) {
    return NextResponse.json(
      { error: 'shot_cap_reached', limit: event.shot_cap },
      { status: 429 }
    )
  }

  if (countBefore >= RATE_LIMIT) {
    return NextResponse.json({ error: 'rate_limit' }, { status: 429 })
  }

  const photoId = randomUUID()
  const ext = mime_type === 'image/jpeg' ? 'jpg' : 'png'
  const storagePath = `events/${slug}/${photoId}.${ext}`

  const { error: insertError } = await serviceClient.from('photos').insert({
    id: photoId,
    event_id: event.id,
    uploader_token: uploader_token as string,
    storage_path: storagePath,
    file_size_bytes: file_size_bytes as number,
    mime_type: mime_type as string,
    uploader_ip: request.headers.get('x-forwarded-for') ?? null,
    tagging_status: 'pending',
  })

  if (insertError) {
    return NextResponse.json({ error: 'insert_failed' }, { status: 500 })
  }

  const { data: signedData, error: signedError } = await serviceClient.storage
    .from('photos')
    .createSignedUploadUrl(storagePath)

  if (signedError || !signedData) {
    return NextResponse.json({ error: 'signed_url_failed' }, { status: 500 })
  }

  const shots_remaining =
    event.shot_cap !== null ? event.shot_cap - (countBefore + 1) : null

  return NextResponse.json({
    upload_url: signedData.signedUrl,
    photo_id: photoId,
    storage_path: storagePath,
    expires_in: 300,
    shots_remaining,
  })
}
