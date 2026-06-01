import { NextRequest, NextResponse } from 'next/server'
import { createServerSupabaseClient, createServiceClient } from '@/lib/supabase'
import { VALID_GUEST_CAPS } from '@/lib/pricing'
import type { Json } from '@/types/database'

const VALID_SHOT_CAPS = [5, 10, 20, null] as const

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
    .select('id, slug, name, host_id, event_date, closes_at, closes_notified_at, settings')
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

  const { name, closes_at, reveal_at, cover_image_path, guest_cap, shot_cap, settings } = body as {
    name?: unknown; closes_at?: unknown; reveal_at?: unknown; cover_image_path?: unknown
    guest_cap?: unknown; shot_cap?: unknown; settings?: unknown
  }

  if (name === undefined && closes_at === undefined && reveal_at === undefined && cover_image_path === undefined && guest_cap === undefined && shot_cap === undefined && settings === undefined) {
    return NextResponse.json({ error: 'nothing_to_update' }, { status: 400 })
  }

  const patch: {
    name?: string; closes_at?: string | null; reveal_at?: string | null; cover_image_path?: string | null
    guest_cap?: number | null; shot_cap?: number | null; settings?: Json
  } = {}

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

  if (reveal_at !== undefined) {
    if (reveal_at === null) {
      patch.reveal_at = null
    } else if (typeof reveal_at === 'string' && !isNaN(Date.parse(reveal_at))) {
      patch.reveal_at = reveal_at
    } else {
      return NextResponse.json({ error: 'invalid_reveal_at' }, { status: 400 })
    }
  }

  if (cover_image_path !== undefined) {
    if (cover_image_path === null || typeof cover_image_path === 'string') {
      patch.cover_image_path = cover_image_path as string | null
    } else {
      return NextResponse.json({ error: 'invalid_cover_image_path' }, { status: 400 })
    }
  }

  if (guest_cap !== undefined) {
    if (!VALID_GUEST_CAPS.includes(guest_cap as never)) {
      return NextResponse.json({ error: 'invalid_guest_cap' }, { status: 400 })
    }
    patch.guest_cap = guest_cap as number | null
  }

  if (shot_cap !== undefined) {
    if (!VALID_SHOT_CAPS.includes(shot_cap as never)) {
      return NextResponse.json({ error: 'invalid_shot_cap' }, { status: 400 })
    }
    patch.shot_cap = shot_cap as number | null
  }

  if (settings !== undefined) {
    if (typeof settings !== 'object' || Array.isArray(settings) || settings === null) {
      return NextResponse.json({ error: 'invalid_settings' }, { status: 400 })
    }
    const current = (typeof event.settings === 'object' && !Array.isArray(event.settings) && event.settings !== null)
      ? event.settings as Record<string, Json>
      : {}
    patch.settings = { ...current, ...(settings as Record<string, Json>) }
  }

  const { data: updated, error } = await supabase
    .from('events')
    .update(patch)
    .eq('id', event.id)
    .select('id, slug, name, event_date, closes_at, reveal_at, guest_cap, shot_cap, settings')
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
    reveal_at: updated.reveal_at,
    guest_cap: updated.guest_cap,
    shot_cap: updated.shot_cap,
    settings: updated.settings,
  })
}

export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ slug: string }> }
) {
  const { slug } = await params

  const supabase = await createServerSupabaseClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { data: event } = await supabase
    .from('events')
    .select('id, host_id, cover_image_path')
    .eq('slug', slug)
    .single()

  if (!event) return NextResponse.json({ error: 'not_found' }, { status: 404 })
  if (event.host_id !== user.id) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const serviceClient = createServiceClient()

  const { data: photos } = await serviceClient
    .from('photos')
    .select('storage_path')
    .eq('event_id', event.id)

  const photoPaths = (photos ?? []).map((p: { storage_path: string }) => p.storage_path)

  if (photoPaths.length > 0) {
    const { error: storageError } = await serviceClient.storage
      .from('photos')
      .remove(photoPaths)
    if (storageError) {
      console.error('[delete-event] Storage delete failed:', storageError)
      return NextResponse.json({ error: 'storage_delete_failed' }, { status: 500 })
    }
  }

  if (event.cover_image_path && !event.cover_image_path.startsWith('/')) {
    const { error: coverError } = await serviceClient.storage
      .from('photos')
      .remove([event.cover_image_path])
    if (coverError) {
      console.warn('[delete-event] Cover image delete failed (non-critical):', coverError)
    }
  }

  const { error: dbError } = await supabase
    .from('events')
    .delete()
    .eq('id', event.id)

  if (dbError) {
    console.error('[delete-event] DB delete failed:', dbError)
    return NextResponse.json({ error: 'db_delete_failed' }, { status: 500 })
  }

  return new NextResponse(null, { status: 204 })
}
