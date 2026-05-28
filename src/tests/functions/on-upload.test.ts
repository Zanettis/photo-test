/**
 * Tests for the on-upload Edge Function (Épico 3 — AI Tagging)
 *
 * NOTE ON DENO IMPORTS
 * --------------------
 * The real Edge Function lives at supabase/functions/on-upload/index.ts and
 * uses Deno-specific URL imports (https://deno.land/std/...) plus the npm:
 * protocol (npm:openai, npm:@supabase/supabase-js).  Vitest runs in Node and
 * cannot resolve those specifiers directly.
 *
 * This file tests the *logic contract* by:
 *   1. Defining the handleOnUpload() function inline — mirroring exactly the
 *      shape the real implementation must have.
 *   2. Mocking the two external dependencies (openai, @supabase/supabase-js)
 *      via vi.mock() so Vitest intercepts the Node-package versions.
 *
 * If you see "Cannot resolve 'npm:...' " errors when running `npm test`, it
 * means the real Deno Edge Function was imported directly — the tests should
 * be run against the extracted handler module (see CONTRIBUTING).
 */

import { describe, it, expect, vi, beforeEach, type Mock } from 'vitest'

// ---------------------------------------------------------------------------
// Mock external dependencies before any import that resolves them
// ---------------------------------------------------------------------------
vi.mock('openai', () => {
  const OpenAI = vi.fn()
  return { default: OpenAI }
})

vi.mock('@supabase/supabase-js', () => ({
  createClient: vi.fn(),
}))

import OpenAI from 'openai'
import { createClient } from '@supabase/supabase-js'

// ---------------------------------------------------------------------------
// Inline handler — mirrors the contract the real Edge Function must satisfy.
// When the real implementation is extracted into a shared module, replace this
// with: import { handleOnUpload } from '@/lib/on-upload-handler'
// ---------------------------------------------------------------------------

interface StoragePayload {
  type: string
  table: string
  record: {
    bucket_id: string
    name: string
    /** The id column from the storage.objects row */
    id: string
  }
}

interface HandlerDeps {
  openaiClient: InstanceType<typeof OpenAI>
  supabaseClient: ReturnType<typeof createClient>
  /** Public URL of the uploaded file (derived from storage_path in real fn) */
  publicUrl: string
}

/**
 * Core logic of the on-upload Edge Function, extracted for testability.
 *
 * Business rules:
 * - Only handle payloads from the 'photos' bucket; return 200 for others.
 * - Resolve the photo row from `storage.objects.name` (storage_path).
 * - If no photo row found, return 200 (idempotent — already deleted or never inserted).
 * - Call OpenAI Vision (gpt-4o-mini) to generate tags from the image URL.
 * - Call OpenAI Embeddings to generate a 1536-dim embedding from the tags.
 * - Update the photos row: tags, embedding, tagging_status = 'done'.
 * - On any OpenAI error: update tagging_status = 'failed'; do NOT throw.
 */
async function handleOnUpload(
  payload: StoragePayload,
  deps: HandlerDeps
): Promise<Response> {
  const { openaiClient, supabaseClient, publicUrl } = deps

  // Guard: only process the 'photos' bucket
  if (payload.record.bucket_id !== 'photos') {
    return new Response(JSON.stringify({ ok: true, skipped: 'wrong_bucket' }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    })
  }

  const storagePath = payload.record.name

  // Look up the photo row by storage_path
  const { data: photo } = await (supabaseClient as any)
    .from('photos')
    .select('id')
    .eq('storage_path', storagePath)
    .single()

  if (!photo) {
    return new Response(JSON.stringify({ ok: true, skipped: 'photo_not_found' }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    })
  }

  try {
    // Step 1: Generate tags via GPT-4o-mini Vision
    const visionResponse = await (openaiClient as any).chat.completions.create({
      model: 'gpt-4o-mini',
      messages: [
        {
          role: 'user',
          content: [
            {
              type: 'image_url',
              image_url: { url: publicUrl },
            },
            {
              type: 'text',
              text: 'List up to 10 descriptive tags for this photo. Reply with a JSON array of lowercase strings only.',
            },
          ],
        },
      ],
      max_tokens: 200,
    })

    const tagsRaw: string[] = JSON.parse(
      visionResponse.choices[0].message.content ?? '[]'
    )

    // Step 2: Generate embedding from tags string
    const embeddingResponse = await (openaiClient as any).embeddings.create({
      model: 'text-embedding-3-small',
      input: tagsRaw.join(', '),
    })

    const embedding: number[] = embeddingResponse.data[0].embedding

    if (!Array.isArray(embedding) || embedding.length !== 1536) {
      throw new Error(`Unexpected embedding shape: got ${embedding?.length ?? 'none'} dims`)
    }

    // Step 3: Persist tags + embedding, mark done
    await (supabaseClient as any)
      .from('photos')
      .update({ tags: tagsRaw, embedding, tagging_status: 'done' })
      .eq('id', photo.id)

    return new Response(JSON.stringify({ ok: true }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    })
  } catch {
    // Graceful degradation: mark failed, never throw (keep function returning 200)
    await (supabaseClient as any)
      .from('photos')
      .update({ tagging_status: 'failed' })
      .eq('id', photo.id)

    return new Response(JSON.stringify({ ok: true, error: 'tagging_failed' }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    })
  }
}

// ---------------------------------------------------------------------------
// Test helpers
// ---------------------------------------------------------------------------

function makePayload(overrides: Partial<StoragePayload['record']> = {}): StoragePayload {
  return {
    type: 'INSERT',
    table: 'objects',
    record: {
      bucket_id: 'photos',
      name: 'events/wedding-2026/photo-001.jpg',
      id: 'obj-uuid-001',
      ...overrides,
    },
  }
}

// ---------------------------------------------------------------------------
// Test suite
// ---------------------------------------------------------------------------

describe('on-upload Edge Function handler', () => {
  // Shared mock references
  let mockOpenAI: { chat: { completions: { create: Mock } }; embeddings: { create: Mock } }
  let mockSupabase: { from: Mock }
  let mockUpdate: Mock
  let mockEq: Mock

  beforeEach(() => {
    vi.clearAllMocks()

    // Build a chainable Supabase mock: from().update().eq() and from().select().eq().single()
    mockEq = vi.fn().mockResolvedValue({ data: null, error: null })
    mockUpdate = vi.fn().mockReturnValue({ eq: mockEq })

    const mockSingle = vi.fn().mockResolvedValue({
      data: { id: 'photo-uuid-001' },
      error: null,
    })
    const mockSelectEq = vi.fn().mockReturnValue({ single: mockSingle })
    const mockSelect = vi.fn().mockReturnValue({ eq: mockSelectEq })

    mockSupabase = {
      from: vi.fn().mockReturnValue({
        select: mockSelect,
        update: mockUpdate,
      }),
    }

    // OpenAI mock — successful path by default
    mockOpenAI = {
      chat: {
        completions: {
          create: vi.fn().mockResolvedValue({
            choices: [
              {
                message: {
                  content: JSON.stringify(['wedding', 'cake', 'celebration', 'candles']),
                },
              },
            ],
          }),
        },
      },
      embeddings: {
        create: vi.fn().mockResolvedValue({
          data: [{ embedding: Array.from({ length: 1536 }, () => 0.01) }],
        }),
      },
    }

    // Wire mocked constructors
    vi.mocked(OpenAI).mockImplementation(() => mockOpenAI as any)
    vi.mocked(createClient).mockReturnValue(mockSupabase as any)
  })

  // -------------------------------------------------------------------------
  // Test 1: Successful tagging
  // -------------------------------------------------------------------------
  it('successful tagging: updates photos row with tags, embedding, and tagging_status="done"', async () => {
    const payload = makePayload()
    const deps: HandlerDeps = {
      openaiClient: mockOpenAI as any,
      supabaseClient: mockSupabase as any,
      publicUrl: 'https://storage.example.com/photos/events/wedding-2026/photo-001.jpg',
    }

    const res = await handleOnUpload(payload, deps)

    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body.ok).toBe(true)

    // OpenAI Vision was called
    expect(mockOpenAI.chat.completions.create).toHaveBeenCalledOnce()
    const visionCall = mockOpenAI.chat.completions.create.mock.calls[0][0]
    expect(visionCall.model).toBe('gpt-4o-mini')

    // OpenAI Embeddings was called
    expect(mockOpenAI.embeddings.create).toHaveBeenCalledOnce()

    // DB update was called with tagging_status='done'
    expect(mockUpdate).toHaveBeenCalledOnce()
    const updateArg = mockUpdate.mock.calls[0][0]
    expect(updateArg.tagging_status).toBe('done')
    expect(Array.isArray(updateArg.tags)).toBe(true)
    expect(updateArg.tags).toContain('wedding')
    expect(Array.isArray(updateArg.embedding)).toBe(true)
    expect(updateArg.embedding).toHaveLength(1536)
  })

  // -------------------------------------------------------------------------
  // Test 2: OpenAI failure → tagging_status='failed', function returns 200
  // -------------------------------------------------------------------------
  it('OpenAI failure: sets tagging_status="failed" and returns 200 without throwing', async () => {
    // Make Vision call throw
    mockOpenAI.chat.completions.create.mockRejectedValue(
      new Error('OpenAI API timeout')
    )

    const payload = makePayload()
    const deps: HandlerDeps = {
      openaiClient: mockOpenAI as any,
      supabaseClient: mockSupabase as any,
      publicUrl: 'https://storage.example.com/photos/events/wedding-2026/photo-001.jpg',
    }

    // Must NOT throw — Edge Function must always return a Response
    const res = await handleOnUpload(payload, deps)

    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body.ok).toBe(true)

    // DB update called with 'failed' status
    expect(mockUpdate).toHaveBeenCalledOnce()
    const updateArg = mockUpdate.mock.calls[0][0]
    expect(updateArg.tagging_status).toBe('failed')

    // Embeddings should NOT have been called after Vision failure
    expect(mockOpenAI.embeddings.create).not.toHaveBeenCalled()
  })

  // -------------------------------------------------------------------------
  // Test 3: Wrong bucket → 200, OpenAI never called
  // -------------------------------------------------------------------------
  it('wrong bucket: returns 200 immediately without calling OpenAI', async () => {
    const payload = makePayload({ bucket_id: 'other-bucket' })
    const deps: HandlerDeps = {
      openaiClient: mockOpenAI as any,
      supabaseClient: mockSupabase as any,
      publicUrl: 'https://storage.example.com/other-bucket/some-file.jpg',
    }

    const res = await handleOnUpload(payload, deps)

    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body.skipped).toBe('wrong_bucket')

    // OpenAI must never be touched
    expect(mockOpenAI.chat.completions.create).not.toHaveBeenCalled()
    expect(mockOpenAI.embeddings.create).not.toHaveBeenCalled()

    // DB must not be queried at all
    expect(mockSupabase.from).not.toHaveBeenCalled()
  })

  // -------------------------------------------------------------------------
  // Test 4: Photo not found in DB → 200, OpenAI never called
  // -------------------------------------------------------------------------
  it('photo not found: returns 200 without calling OpenAI when DB SELECT returns null', async () => {
    // Override the single() mock to return null data (photo row deleted or never inserted)
    const mockSingleNull = vi.fn().mockResolvedValue({ data: null, error: null })
    const mockSelectEqNull = vi.fn().mockReturnValue({ single: mockSingleNull })
    const mockSelectNull = vi.fn().mockReturnValue({ eq: mockSelectEqNull })

    mockSupabase.from.mockReturnValue({
      select: mockSelectNull,
      update: mockUpdate,
    })

    const payload = makePayload()
    const deps: HandlerDeps = {
      openaiClient: mockOpenAI as any,
      supabaseClient: mockSupabase as any,
      publicUrl: 'https://storage.example.com/photos/events/wedding-2026/photo-001.jpg',
    }

    const res = await handleOnUpload(payload, deps)

    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body.skipped).toBe('photo_not_found')

    // OpenAI must never be called
    expect(mockOpenAI.chat.completions.create).not.toHaveBeenCalled()
    expect(mockOpenAI.embeddings.create).not.toHaveBeenCalled()

    // No update should have been issued
    expect(mockUpdate).not.toHaveBeenCalled()
  })

  // -------------------------------------------------------------------------
  // Test 5: Vision API returns invalid JSON → tagging_status='failed', returns 200
  // -------------------------------------------------------------------------
  it('invalid Vision JSON: sets tagging_status="failed" when GPT returns non-JSON', async () => {
    mockOpenAI.chat.completions.create.mockResolvedValue({
      choices: [{ message: { content: 'Sorry, I cannot process this image.' } }],
    })

    const payload = makePayload()
    const deps: HandlerDeps = {
      openaiClient: mockOpenAI as any,
      supabaseClient: mockSupabase as any,
      publicUrl: 'https://storage.example.com/photos/events/wedding-2026/photo-001.jpg',
    }

    const res = await handleOnUpload(payload, deps)

    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body.ok).toBe(true)

    // Must mark as failed, not crash
    expect(mockUpdate).toHaveBeenCalledOnce()
    expect(mockUpdate.mock.calls[0][0].tagging_status).toBe('failed')

    // Embeddings must NOT be called after Vision parse failure
    expect(mockOpenAI.embeddings.create).not.toHaveBeenCalled()
  })

  // -------------------------------------------------------------------------
  // Test 6: Embedding has wrong dimensions → tagging_status='failed', returns 200
  // -------------------------------------------------------------------------
  it('wrong embedding dimensions: sets tagging_status="failed" when embedding is not 1536-dim', async () => {
    mockOpenAI.embeddings.create.mockResolvedValue({
      data: [{ embedding: Array.from({ length: 384 }, () => 0.01) }], // wrong size
    })

    const payload = makePayload()
    const deps: HandlerDeps = {
      openaiClient: mockOpenAI as any,
      supabaseClient: mockSupabase as any,
      publicUrl: 'https://storage.example.com/photos/events/wedding-2026/photo-001.jpg',
    }

    const res = await handleOnUpload(payload, deps)

    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body.ok).toBe(true)
    expect(body.error).toBe('tagging_failed')

    expect(mockUpdate).toHaveBeenCalledOnce()
    expect(mockUpdate.mock.calls[0][0].tagging_status).toBe('failed')
  })

  // -------------------------------------------------------------------------
  // Test 7: Idempotência — segunda execução com mesma foto sobrescreve OK
  // -------------------------------------------------------------------------
  it('idempotent: processing the same photo twice succeeds both times', async () => {
    const payload = makePayload()
    const deps: HandlerDeps = {
      openaiClient: mockOpenAI as any,
      supabaseClient: mockSupabase as any,
      publicUrl: 'https://storage.example.com/photos/events/wedding-2026/photo-001.jpg',
    }

    const res1 = await handleOnUpload(payload, deps)
    const res2 = await handleOnUpload(payload, deps)

    expect(res1.status).toBe(200)
    expect(res2.status).toBe(200)
    expect((await res1.json()).ok).toBe(true)
    expect((await res2.json()).ok).toBe(true)

    // Both runs should call Vision and Embeddings
    expect(mockOpenAI.chat.completions.create).toHaveBeenCalledTimes(2)
    expect(mockOpenAI.embeddings.create).toHaveBeenCalledTimes(2)
  })

  // -------------------------------------------------------------------------
  // Test 8: Embedding armazenado como number[], não como string
  // -------------------------------------------------------------------------
  it('embedding is stored as number[], not as a JSON string', async () => {
    const payload = makePayload()
    const deps: HandlerDeps = {
      openaiClient: mockOpenAI as any,
      supabaseClient: mockSupabase as any,
      publicUrl: 'https://storage.example.com/photos/events/wedding-2026/photo-001.jpg',
    }

    await handleOnUpload(payload, deps)

    const updateArg = mockUpdate.mock.calls[0][0]
    expect(Array.isArray(updateArg.embedding)).toBe(true)
    expect(typeof updateArg.embedding).not.toBe('string')
    expect(updateArg.embedding).toHaveLength(1536)
  })
})
