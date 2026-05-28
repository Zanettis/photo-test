import { NextRequest, NextResponse } from 'next/server'
import { createServerSupabaseClient, createServiceClient } from '@/lib/supabase'

export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ slug: string; photo_id: string }> }
) {
  const { slug, photo_id } = await params

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

  // IDOR protection: confirm photo belongs to this event before touching anything
  const { data: photo } = await supabase
    .from('photos')
    .select('id, storage_path')
    .eq('id', photo_id)
    .eq('event_id', event.id)
    .single()

  if (!photo) return NextResponse.json({ error: 'not_found' }, { status: 404 })

  // Storage first — do not touch DB if storage removal fails
  const serviceClient = createServiceClient()
  const { error: storageError } = await serviceClient.storage
    .from('photos')
    .remove([photo.storage_path])

  if (storageError) {
    console.error('[delete-photo] Storage delete failed:', storageError)
    return NextResponse.json({ error: 'storage_delete_failed' }, { status: 500 })
  }

  const { error: dbError } = await supabase
    .from('photos')
    .delete()
    .eq('id', photo.id)

  if (dbError) {
    console.error('[delete-photo] DB delete failed:', dbError)
    return NextResponse.json({ error: 'db_delete_failed' }, { status: 500 })
  }

  return new NextResponse(null, { status: 204 })
}
