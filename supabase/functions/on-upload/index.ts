// Supabase Edge Function: triggered by storage insert on photos bucket
// Pipeline: download image → GPT-4o-mini Vision (tags) → text-embedding-3-small (embedding) → update photos row
import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const VISION_MAX_TOKENS = 200
const TAG_MAX_COUNT = 10
const EMBEDDING_DIMENSIONS = 1536
const STORAGE_BUCKET = 'photos'
const OPENAI_TIMEOUT_MS = 30_000
const OPENAI_MAX_RETRIES = 3

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface StorageWebhookPayload {
  type: 'INSERT' | 'UPDATE' | 'DELETE'
  table: string
  record: {
    id: string
    name: string          // storage path, e.g. "events/my-party/uuid.jpg"
    bucket_id: string
    metadata?: Record<string, unknown>
  }
  old_record: null | Record<string, unknown>
  schema: string
}

interface OpenAIChatResponse {
  choices: Array<{
    message: { content: string | null }
  }>
}

interface OpenAIEmbeddingResponse {
  data: Array<{ embedding: number[] }>
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function getRequiredEnv(key: string): string {
  const value = Deno.env.get(key)
  if (!value) throw new Error(`Missing required environment variable: ${key}`)
  return value
}

/** Extract photo row ID from the storage path (last path segment, strip extension). */
function photoIdFromPath(storagePath: string): string | null {
  const lastSlash = storagePath.lastIndexOf('/')
  const filename = lastSlash === -1 ? storagePath : storagePath.slice(lastSlash + 1)
  const dotIndex = filename.lastIndexOf('.')
  if (dotIndex <= 0) return null
  const id = filename.slice(0, dotIndex)
  return UUID_RE.test(id) ? id : null
}

/** Fetch with AbortController timeout and exponential-backoff retry on 429/5xx. */
async function fetchWithRetry(
  url: string,
  options: RequestInit,
  maxRetries = OPENAI_MAX_RETRIES,
  timeoutMs = OPENAI_TIMEOUT_MS,
): Promise<Response> {
  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    const controller = new AbortController()
    const timer = setTimeout(() => controller.abort(), timeoutMs)
    try {
      const res = await fetch(url, { ...options, signal: controller.signal })
      clearTimeout(timer)
      if ((res.status === 429 || res.status >= 500) && attempt < maxRetries) {
        const wait = (2 ** attempt) * 1_000 + Math.random() * 500
        await new Promise(r => setTimeout(r, wait))
        continue
      }
      return res
    } catch (err) {
      clearTimeout(timer)
      if (attempt === maxRetries) throw err
      const wait = (2 ** attempt) * 1_000
      await new Promise(r => setTimeout(r, wait))
    }
  }
  // Unreachable — loop always returns or throws
  throw new Error('fetchWithRetry: exhausted retries')
}

/** Fetch image bytes from Supabase Storage and base64-encode them. */
async function fetchImageAsBase64(
  supabaseUrl: string,
  storagePath: string,
  serviceRoleKey: string,
): Promise<{ base64: string; mimeType: string }> {
  const url = `${supabaseUrl}/storage/v1/object/${STORAGE_BUCKET}/${storagePath}`
  const res = await fetch(url, {
    headers: { Authorization: `Bearer ${serviceRoleKey}` },
  })
  if (!res.ok) {
    throw new Error(`Storage fetch failed: ${res.status} ${res.statusText}`)
  }
  const contentType = res.headers.get('content-type') ?? 'image/jpeg'
  const mimeType = contentType.split(';')[0].trim()
  const bytes = new Uint8Array(await res.arrayBuffer())
  // Encode in chunks to avoid call-stack overflow on large images
  const chunkSize = 65_536
  let base64 = ''
  for (let i = 0; i < bytes.length; i += chunkSize) {
    base64 += btoa(String.fromCharCode(...bytes.subarray(i, i + chunkSize)))
  }
  return { base64, mimeType }
}

/** Call GPT-4o-mini Vision to generate descriptive tags for the image. */
async function generateTags(
  base64: string,
  mimeType: string,
  openaiApiKey: string,
): Promise<string[]> {
  const res = await fetchWithRetry('https://api.openai.com/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${openaiApiKey}`,
    },
    body: JSON.stringify({
      model: 'gpt-4o-mini',
      max_tokens: VISION_MAX_TOKENS,
      messages: [
        {
          role: 'user',
          content: [
            {
              type: 'text',
              // SECURITY: prompt is static — do NOT interpolate user-provided data here
              text: 'Analyze this event photo. Return ONLY a JSON array of 5-10 descriptive tags in Portuguese (pt-BR). Tags should describe: scene, people, emotions, activities, objects. Example: ["noiva","vela","sorrindo","cerimônia","flores"]. No explanation — just the JSON array.',
            },
            {
              type: 'image_url',
              image_url: { url: `data:${mimeType};base64,${base64}`, detail: 'low' },
            },
          ],
        },
      ],
    }),
  })

  if (!res.ok) {
    throw new Error(`Vision API error: ${res.status} ${res.statusText}`)
  }

  const data: OpenAIChatResponse = await res.json()
  const content = data.choices?.[0]?.message?.content ?? '[]'

  // Strip markdown code fences if present
  const cleaned = content.replace(/```json\s*/g, '').replace(/```\s*/g, '').trim()

  let tags: unknown
  try {
    tags = JSON.parse(cleaned)
  } catch (parseErr) {
    const preview = cleaned.slice(0, 120)
    throw new Error(`Vision API returned invalid JSON: ${preview} — ${parseErr}`)
  }

  if (!Array.isArray(tags)) throw new Error('Vision API did not return an array')
  return (tags as unknown[]).filter((t): t is string => typeof t === 'string').slice(0, TAG_MAX_COUNT)
}

/** Generate a 1536-dim embedding for the tag list using text-embedding-3-small. */
async function generateEmbedding(
  tags: string[],
  openaiApiKey: string,
): Promise<number[]> {
  const input = tags.join(', ')
  const res = await fetchWithRetry('https://api.openai.com/v1/embeddings', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${openaiApiKey}`,
    },
    body: JSON.stringify({
      model: 'text-embedding-3-small',
      input,
      dimensions: EMBEDDING_DIMENSIONS,
    }),
  })

  if (!res.ok) {
    throw new Error(`Embeddings API error: ${res.status} ${res.statusText}`)
  }

  const data: OpenAIEmbeddingResponse = await res.json()
  const embedding = data.data?.[0]?.embedding
  if (!Array.isArray(embedding) || embedding.length !== EMBEDDING_DIMENSIONS) {
    throw new Error(`Unexpected embedding shape: got ${embedding?.length ?? 'none'} dims`)
  }
  if (!embedding.every(v => typeof v === 'number' && isFinite(v))) {
    throw new Error('Embedding contains NaN or Infinity values')
  }
  return embedding
}

// ---------------------------------------------------------------------------
// Main handler
// ---------------------------------------------------------------------------

serve(async (req: Request) => {
  let photoId: string | null = null

  try {
    let payload: StorageWebhookPayload
    try {
      payload = await req.json()
    } catch {
      console.error('on-upload: invalid JSON in webhook payload')
      return new Response(JSON.stringify({ ok: true, skipped: 'invalid_payload' }), {
        headers: { 'Content-Type': 'application/json' },
      })
    }

    // Only process INSERT events on the photos bucket
    if (payload.type !== 'INSERT' || payload.record?.bucket_id !== STORAGE_BUCKET) {
      return new Response(JSON.stringify({ ok: true, skipped: true }), {
        headers: { 'Content-Type': 'application/json' },
      })
    }

    const storagePath = payload.record.name
    photoId = photoIdFromPath(storagePath)

    if (!photoId) {
      console.error('on-upload: could not parse photo ID from path:', storagePath)
      return new Response(JSON.stringify({ ok: true, skipped: 'invalid_path' }), {
        headers: { 'Content-Type': 'application/json' },
      })
    }

    const supabaseUrl = getRequiredEnv('SUPABASE_URL')
    const serviceRoleKey = getRequiredEnv('SUPABASE_SERVICE_ROLE_KEY')
    const openaiApiKey = getRequiredEnv('OPENAI_API_KEY')

    const supabase = createClient(supabaseUrl, serviceRoleKey)

    console.log(`on-upload: processing photo ${photoId} at ${storagePath}`)

    const { base64, mimeType } = await fetchImageAsBase64(supabaseUrl, storagePath, serviceRoleKey)
    const tags = await generateTags(base64, mimeType, openaiApiKey)
    console.log(`on-upload: tags for ${photoId}:`, tags)

    const embedding = await generateEmbedding(tags, openaiApiKey)

    const { error: updateError } = await supabase
      .from('photos')
      .update({
        tags,
        embedding,
        tagging_status: 'done',
      })
      .eq('id', photoId)

    if (updateError) {
      throw new Error(`DB update failed: ${updateError.message}`)
    }

    console.log(`on-upload: photo ${photoId} tagged successfully (${tags.length} tags)`)
    return new Response(JSON.stringify({ ok: true, photoId, tagCount: tags.length }), {
      headers: { 'Content-Type': 'application/json' },
    })
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err)
    console.error(`on-upload error (photoId=${photoId ?? 'unknown'}):`, msg)

    if (photoId) {
      const supabaseUrl = Deno.env.get('SUPABASE_URL')
      const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')
      if (supabaseUrl && serviceRoleKey) {
        try {
          await createClient(supabaseUrl, serviceRoleKey)
            .from('photos')
            .update({ tagging_status: 'failed' })
            .eq('id', photoId)
        } catch (updateErr) {
          console.error(`on-upload: failed to mark ${photoId} as failed:`, updateErr)
        }
      }
    }

    return new Response(JSON.stringify({ ok: true, error: 'tagging_failed' }), {
      headers: { 'Content-Type': 'application/json' },
    })
  }
})
