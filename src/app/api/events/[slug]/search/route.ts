import { NextRequest, NextResponse } from 'next/server'
import { createServerSupabaseClient, createServiceClient } from '@/lib/supabase'
import openai, { EMBEDDING_MODEL, EMBEDDING_DIMENSIONS } from '@/lib/openai'

const MAX_QUERY_LENGTH = 200
const DEFAULT_LIMIT = 20
const MAX_LIMIT = 50

const searchRateLimiter = new Map<string, { count: number; resetAt: number }>()
const RATE_LIMIT_WINDOW_MS = 60_000
const RATE_LIMIT_MAX = 30

function isRateLimited(userId: string): boolean {
  const now = Date.now()
  const entry = searchRateLimiter.get(userId)
  if (!entry || entry.resetAt <= now) {
    searchRateLimiter.set(userId, { count: 1, resetAt: now + RATE_LIMIT_WINDOW_MS })
    return false
  }
  if (entry.count >= RATE_LIMIT_MAX) return true
  entry.count++
  return false
}

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ slug: string }> }
) {
  const { slug } = await params

  const supabase = await createServerSupabaseClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  // Server client honors RLS — only returns event if owned by authenticated user
  const { data: event } = await supabase
    .from('events')
    .select('id, host_id, name')
    .eq('slug', slug)
    .single()

  if (!event) return NextResponse.json({ error: 'not_found' }, { status: 403 })
  if (event.host_id !== user.id) return NextResponse.json({ error: 'forbidden' }, { status: 403 })

  if (isRateLimited(user.id)) {
    return NextResponse.json({ error: 'Too many requests' }, { status: 429 })
  }

  const { searchParams } = new URL(request.url)
  const q = searchParams.get('q')?.trim() ?? ''
  const limitParam = parseInt(searchParams.get('limit') ?? String(DEFAULT_LIMIT), 10)
  const limit = Math.max(1, Math.min(isNaN(limitParam) ? DEFAULT_LIMIT : limitParam, MAX_LIMIT))

  if (!q) return NextResponse.json({ error: 'q is required' }, { status: 400 })
  if (q.length > MAX_QUERY_LENGTH) return NextResponse.json({ error: 'q is too long' }, { status: 400 })

  let embedding: number[]
  try {
    const embeddingResponse = await openai.embeddings.create({
      model: EMBEDDING_MODEL,
      input: q,
      dimensions: EMBEDDING_DIMENSIONS,
    })
    if (!embeddingResponse.data || embeddingResponse.data.length === 0) {
      throw new Error('Empty embedding response')
    }
    const first = embeddingResponse.data[0]
    if (!first?.embedding) throw new Error('Missing embedding in response')
    embedding = first.embedding
  } catch (err) {
    console.error('[search] OpenAI embedding error:', err)
    return NextResponse.json({ error: 'Embedding failed' }, { status: 502 })
  }

  const { data: results, error } = await supabase.rpc('search_photos', {
    event_id_param: event.id,
    query_embedding: embedding,
    match_count: limit,
  })

  if (error) {
    console.error('[search] RPC error:', error)
    return NextResponse.json({ error: 'Search failed' }, { status: 500 })
  }

  // Service client used only for Storage public URLs (no auth needed for public bucket)
  const serviceClient = createServiceClient()
  const photos = (results ?? []).map((row: {
    id: string
    storage_path: string
    tags: string[] | null
    tagging_status: string
    similarity: number
    uploaded_at: string
  }) => {
    const { data: { publicUrl } } = serviceClient.storage
      .from('photos')
      .getPublicUrl(row.storage_path)
    return {
      id: row.id,
      url: publicUrl,
      tags: row.tags ?? [],
      tagging_status: row.tagging_status,
      similarity: row.similarity,
      uploaded_at: row.uploaded_at,
    }
  })

  return NextResponse.json({ q, photos })
}
