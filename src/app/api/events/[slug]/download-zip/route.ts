import { NextRequest, NextResponse } from 'next/server'
import type { Archiver, ArchiverOptions, Format } from 'archiver'
import { PassThrough, Readable } from 'stream'
import { createServerSupabaseClient, createServiceClient } from '@/lib/supabase'


export const runtime = 'nodejs'

function extFromMime(mime: string | null): string {
  if (mime === 'image/png') return 'png'
  return 'jpg'
}

function safeEventName(name: string): string {
  return name.replace(/[^a-zA-Z0-9À-ÿ _-]/g, '').trim().replace(/\s+/g, '-') || 'event'
}

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ slug: string }> }
) {
  const { slug } = await params

  // Auth check — padrão exato do projeto
  const supabase = await createServerSupabaseClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { data: event } = await supabase
    .from('events')
    .select('id, name, host_id')
    .eq('slug', slug)
    .single()

  if (!event) return NextResponse.json({ error: 'Not Found' }, { status: 404 })
  if (event.host_id !== user.id) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  // Busca fotos não-flagadas
  const serviceClient = createServiceClient()
  const { data: photos, error: photosError } = await serviceClient
    .from('photos')
    .select('id, storage_path, mime_type, uploaded_at')
    .eq('event_id', event.id)
    .eq('is_flagged', false)
    .order('uploaded_at', { ascending: true })

  if (photosError) {
    console.error('[download-zip] Photos query failed:', photosError)
    return NextResponse.json({ error: 'query_failed' }, { status: 500 })
  }

  // Streaming ZIP com archiver — require() lazy para compatibilidade com Vitest mocks
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const _mod = require('archiver')
  const createArchiver: (format: Format, options?: ArchiverOptions) => Archiver =
    typeof _mod === 'function' ? _mod : _mod.default
  const archive = createArchiver('zip', { zlib: { level: 6 } })
  const passThrough = new PassThrough()
  archive.pipe(passThrough)

  archive.on('error', (err: Error) => {
    console.error('[download-zip] Archive error:', err)
    passThrough.destroy(err)
  })

  // IIFE async — roda concorrentemente com o streaming, sem bloquear o Response
  ;(async () => {
    for (const [index, photo] of (photos ?? []).entries()) {
      try {
        const { data: fileData, error: dlError } = await serviceClient.storage
          .from('photos')
          .download(photo.storage_path)

        if (dlError || !fileData) {
          console.error(`[download-zip] Failed to download ${photo.storage_path}:`, dlError)
          continue
        }

        const ext = extFromMime(photo.mime_type)
        const fileName = `${String(index + 1).padStart(4, '0')}-${photo.id}.${ext}`
        const buffer = Buffer.from(await fileData.arrayBuffer())
        archive.append(buffer, { name: fileName })
      } catch (err) {
        console.error(`[download-zip] Unexpected error for photo ${photo.id}:`, err)
      }
    }
    archive.finalize()
  })()

  const webStream = Readable.toWeb(passThrough) as ReadableStream
  const zipFileName = `${safeEventName(event.name)}.zip`

  return new Response(webStream, {
    status: 200,
    headers: {
      'Content-Type': 'application/zip',
      'Content-Disposition': `attachment; filename="${zipFileName}"`,
      'X-Content-Type-Options': 'nosniff',
      'Cache-Control': 'no-store',
    },
  })
}
