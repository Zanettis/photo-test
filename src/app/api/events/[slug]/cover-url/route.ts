import { NextRequest, NextResponse } from 'next/server'
import { createServerSupabaseClient, createServiceClient } from '@/lib/supabase'

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ slug: string }> }
) {
  const { slug } = await params

  const supabase = await createServerSupabaseClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  let body: { file_ext?: unknown }
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: 'invalid_body' }, { status: 400 })
  }

  const { file_ext } = body
  if (file_ext !== 'jpg' && file_ext !== 'png') {
    return NextResponse.json({ error: 'file_ext must be jpg or png' }, { status: 400 })
  }

  const { data: event } = await supabase
    .from('events')
    .select('id, host_id')
    .eq('slug', slug)
    .single()

  if (!event) return NextResponse.json({ error: 'not_found' }, { status: 404 })
  if (event.host_id !== user.id) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const storagePath = `events/${slug}/cover.${file_ext}`

  const serviceClient = createServiceClient()
  const { data: signedData, error: signedError } = await serviceClient.storage
    .from('photos')
    .createSignedUploadUrl(storagePath)

  if (signedError || !signedData) {
    return NextResponse.json({ error: 'signed_url_failed' }, { status: 500 })
  }

  return NextResponse.json({
    upload_url: signedData.signedUrl,
    storage_path: storagePath,
    expires_in: 300,
  })
}
