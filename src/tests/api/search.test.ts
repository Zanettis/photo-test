import { describe, it, expect, vi, beforeEach, afterEach, type Mock } from 'vitest'
import { NextRequest } from 'next/server'

// ---------------------------------------------------------------------------
// Mock external dependencies before any route imports
// ---------------------------------------------------------------------------

// Mock @/lib/openai (default export is the singleton openai client instance)
vi.mock('@/lib/openai', () => {
  const mockClient = {
    embeddings: {
      create: vi.fn(),
    },
  }
  return {
    default: mockClient,
    EMBEDDING_MODEL: 'text-embedding-3-small',
    EMBEDDING_DIMENSIONS: 1536,
  }
})

// Mock @/lib/supabase — both server (auth + RLS) and service (storage) clients
vi.mock('@/lib/supabase', () => ({
  createServerSupabaseClient: vi.fn(),
  createServiceClient: vi.fn(),
}))

// Stub next/headers to prevent cookie resolution blowing up in jsdom
vi.mock('next/headers', () => ({
  cookies: vi.fn().mockResolvedValue({ getAll: () => [], set: () => {} }),
}))

import openai from '@/lib/openai'
import { createServerSupabaseClient, createServiceClient } from '@/lib/supabase'
import { GET } from '@/app/api/events/[slug]/search/route'

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Build a fake 1536-dim embedding vector */
function fakeEmbedding(): number[] {
  return Array.from({ length: 1536 }, (_, i) => i / 1536)
}

/** Build a NextRequest for the search route */
function makeSearchRequest(slug: string, query: string | null, limit?: number): NextRequest {
  const url = new URL(`http://localhost/api/events/${slug}/search`)
  if (query !== null) url.searchParams.set('q', query)
  if (limit !== undefined) url.searchParams.set('limit', String(limit))
  return new NextRequest(url.toString())
}

/** Produce a chainable Supabase .from() mock for the events table */
function makeEventFromMock(eventData: object | null) {
  return {
    select: () => ({
      eq: () => ({
        single: () =>
          Promise.resolve({
            data: eventData,
            error: eventData ? null : { code: 'PGRST116' },
          }),
      }),
    }),
  }
}

// ---------------------------------------------------------------------------
// Shared mock state
// ---------------------------------------------------------------------------

let mockAuth: Mock
let mockFrom: Mock
let mockRpc: Mock
let mockEmbeddingsCreate: Mock
let mockGetPublicUrl: Mock

const FAKE_USER = { id: 'user-host-1' }
const FAKE_EVENT = { id: 'event-uuid-1', slug: 'wedding-2026', name: 'Wedding 2026', host_id: 'user-host-1' }

const FAKE_RPC_RESULTS = [
  {
    id: 'photo-1',
    storage_path: 'events/wedding-2026/photo-1.jpg',
    tags: ['wedding', 'ceremony'],
    tagging_status: 'done',
    similarity: 0.92,
    uploaded_at: '2026-05-27T10:00:00Z',
  },
  {
    id: 'photo-2',
    storage_path: 'events/wedding-2026/photo-2.jpg',
    tags: ['cake'],
    tagging_status: 'done',
    similarity: 0.85,
    uploaded_at: '2026-05-27T10:01:00Z',
  },
]

// ---------------------------------------------------------------------------
// Test suite
// ---------------------------------------------------------------------------

describe('GET /api/events/[slug]/search', () => {
  beforeEach(() => {
    vi.clearAllMocks()

    // Default: embeddings.create returns a valid 1536-dim vector
    mockEmbeddingsCreate = vi.mocked(openai.embeddings.create)
    mockEmbeddingsCreate.mockResolvedValue({
      data: [{ embedding: fakeEmbedding() }],
    } as any)

    // Default Supabase mocks
    mockRpc = vi.fn().mockResolvedValue({ data: FAKE_RPC_RESULTS, error: null })
    mockFrom = vi.fn().mockReturnValue(makeEventFromMock(FAKE_EVENT))
    mockAuth = vi.fn().mockResolvedValue({ data: { user: FAKE_USER } })

    vi.mocked(createServerSupabaseClient).mockResolvedValue({
      auth: { getUser: mockAuth },
      from: mockFrom,
      rpc: mockRpc,
    } as any)

    // Service client: storage.from('photos').getPublicUrl(path)
    mockGetPublicUrl = vi.fn().mockReturnValue({
      data: { publicUrl: 'https://cdn.example.com/photos/test.jpg' },
    })
    vi.mocked(createServiceClient).mockReturnValue({
      storage: {
        from: () => ({ getPublicUrl: mockGetPublicUrl }),
      },
    } as any)
  })

  // -------------------------------------------------------------------------
  // Test 1: Valid search — returns results sorted by similarity
  // -------------------------------------------------------------------------
  it('valid search: calls OpenAI embeddings + supabase.rpc and returns photos sorted by similarity', async () => {
    const req = makeSearchRequest('wedding-2026', 'cake cutting')
    const res = await GET(req, { params: Promise.resolve({ slug: 'wedding-2026' }) })

    expect(res.status).toBe(200)
    const body = await res.json()

    // Response shape
    expect(body.q).toBe('cake cutting')
    expect(Array.isArray(body.photos)).toBe(true)
    expect(body.photos).toHaveLength(2)

    // Sorted by similarity descending
    expect(body.photos[0].similarity).toBeGreaterThanOrEqual(body.photos[1].similarity)

    // Each photo has expected fields
    expect(body.photos[0]).toMatchObject({
      id: expect.any(String),
      url: expect.any(String),
      tags: expect.any(Array),
      tagging_status: expect.any(String),
      similarity: expect.any(Number),
      uploaded_at: expect.any(String),
    })

    // OpenAI embeddings was called once with the query text
    expect(mockEmbeddingsCreate).toHaveBeenCalledOnce()
    expect(mockEmbeddingsCreate.mock.calls[0][0].input).toBe('cake cutting')

    // Supabase RPC was called once
    expect(mockRpc).toHaveBeenCalledOnce()
  })

  // -------------------------------------------------------------------------
  // Test 2: Missing `q` param → 400
  // Note: per route implementation, auth + ownership checks happen before
  // the q validation, so Supabase auth IS called but OpenAI is not.
  // -------------------------------------------------------------------------
  it('missing q param: returns 400 Bad Request', async () => {
    const req = makeSearchRequest('wedding-2026', null)
    const res = await GET(req, { params: Promise.resolve({ slug: 'wedding-2026' }) })

    expect(res.status).toBe(400)
    const body = await res.json()
    expect(body.error).toBeDefined()

    // OpenAI must NOT be called when q is missing
    expect(mockEmbeddingsCreate).not.toHaveBeenCalled()
    // RPC must NOT be called either
    expect(mockRpc).not.toHaveBeenCalled()
  })

  // -------------------------------------------------------------------------
  // Test 3: Unauthenticated request → 401
  // -------------------------------------------------------------------------
  it('unauthenticated: returns 401 when no session exists', async () => {
    mockAuth.mockResolvedValue({ data: { user: null } })

    const req = makeSearchRequest('wedding-2026', 'dance floor')
    const res = await GET(req, { params: Promise.resolve({ slug: 'wedding-2026' }) })

    expect(res.status).toBe(401)

    // OpenAI must not be called for unauthenticated users
    expect(mockEmbeddingsCreate).not.toHaveBeenCalled()
    expect(mockRpc).not.toHaveBeenCalled()
  })

  // -------------------------------------------------------------------------
  // Test 4: Host doesn't own event → 403
  // The route relies on RLS to enforce ownership; if the event query returns
  // null, the route returns 403.
  // -------------------------------------------------------------------------
  it("host doesn't own event: returns 403 when event is not found for the authenticated user", async () => {
    // Event query returns null — either non-existent or RLS filtered it out
    mockFrom.mockReturnValue(makeEventFromMock(null))

    const req = makeSearchRequest('wedding-2026', 'bouquet')
    const res = await GET(req, { params: Promise.resolve({ slug: 'wedding-2026' }) })

    expect(res.status).toBe(403)
    const body = await res.json()
    expect(body.error).toBeDefined()

    // Must not proceed to embedding or search
    expect(mockEmbeddingsCreate).not.toHaveBeenCalled()
    expect(mockRpc).not.toHaveBeenCalled()
  })

  // -------------------------------------------------------------------------
  // Test 5: OpenAI API failure → 502
  // The route catches embedding errors and returns 502 (Bad Gateway).
  // -------------------------------------------------------------------------
  it('OpenAI failure: returns 502 with error message when embeddings.create throws', async () => {
    mockEmbeddingsCreate.mockRejectedValue(new Error('OpenAI rate limit exceeded'))

    const req = makeSearchRequest('wedding-2026', 'first dance')
    const res = await GET(req, { params: Promise.resolve({ slug: 'wedding-2026' }) })

    expect(res.status).toBe(502)
    const body = await res.json()
    expect(body.error).toBeDefined()

    // RPC must not be called after embedding failure
    expect(mockRpc).not.toHaveBeenCalled()
  })

  // -------------------------------------------------------------------------
  // Test 6: No tagged photos → returns { photos: [] }
  // -------------------------------------------------------------------------
  it('no tagged photos: returns empty photos array when rpc returns no rows', async () => {
    mockRpc.mockResolvedValue({ data: [], error: null })

    const req = makeSearchRequest('wedding-2026', 'children playing')
    const res = await GET(req, { params: Promise.resolve({ slug: 'wedding-2026' }) })

    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body.photos).toEqual([])
  })

  // -------------------------------------------------------------------------
  // Test 7: limit param defaults to 20
  // -------------------------------------------------------------------------
  it('default limit: calls supabase.rpc with match_count=20 when limit is not specified', async () => {
    const req = makeSearchRequest('wedding-2026', 'ceremony')
    const res = await GET(req, { params: Promise.resolve({ slug: 'wedding-2026' }) })

    expect(res.status).toBe(200)

    expect(mockRpc).toHaveBeenCalledOnce()
    // Second argument is the params object
    const rpcParams = mockRpc.mock.calls[0][1]
    expect(rpcParams).toMatchObject({ match_count: 20 })
  })

  // -------------------------------------------------------------------------
  // Test 8: Custom limit is respected
  // -------------------------------------------------------------------------
  it('custom limit: passes the provided limit value to supabase.rpc as match_count', async () => {
    const req = makeSearchRequest('wedding-2026', 'speech', 5)
    const res = await GET(req, { params: Promise.resolve({ slug: 'wedding-2026' }) })

    expect(res.status).toBe(200)

    expect(mockRpc).toHaveBeenCalledOnce()
    const rpcParams = mockRpc.mock.calls[0][1]
    expect(rpcParams).toMatchObject({ match_count: 5 })
  })

  // -------------------------------------------------------------------------
  // Test 9: RPC error → 500
  // -------------------------------------------------------------------------
  it('RPC error: returns 500 when supabase.rpc returns an error', async () => {
    mockRpc.mockResolvedValue({ data: null, error: { message: 'function not found' } })

    const req = makeSearchRequest('wedding-2026', 'toasts')
    const res = await GET(req, { params: Promise.resolve({ slug: 'wedding-2026' }) })

    expect(res.status).toBe(500)
    const body = await res.json()
    expect(body.error).toBeDefined()
  })

  // -------------------------------------------------------------------------
  // Test 10: Rate limiting → 429
  // Send 31 sequential requests as the same user; the 31st must return 429.
  // Each GET call increments the in-memory rate limiter for this userId.
  // We exhaust the 30-request window then verify the next one is rejected.
  // -------------------------------------------------------------------------
  describe('rate limiting', () => {
    beforeEach(() => {
      vi.useFakeTimers()
      // Use a dedicated user ID so these 31 requests don't pollute the shared
      // 'user-host-1' counter used by all other tests in this suite.
      const RL_USER = { id: 'user-rate-limit-only' }
      mockAuth.mockResolvedValue({ data: { user: RL_USER } })
      mockFrom.mockReturnValue(makeEventFromMock({ ...FAKE_EVENT, host_id: RL_USER.id }))
    })

    afterEach(() => {
      vi.useRealTimers()
    })

    it('rate limited: returns 429 after 30 requests and does not call embeddings on the 31st', async () => {
      // Send 30 requests that should all succeed (or reach embeddings/rpc)
      for (let i = 0; i < 30; i++) {
        await GET(makeSearchRequest('wedding-2026', 'photo'), { params: Promise.resolve({ slug: 'wedding-2026' }) })
      }

      // Reset call counts so we can check the 31st request independently
      mockEmbeddingsCreate.mockClear()

      // 31st request — must be rate limited
      const res = await GET(makeSearchRequest('wedding-2026', 'photo'), { params: Promise.resolve({ slug: 'wedding-2026' }) })

      expect(res.status).toBe(429)
      expect(mockEmbeddingsCreate).not.toHaveBeenCalled()
    })
  })

  // -------------------------------------------------------------------------
  // Test 11: Query too long → 400
  // -------------------------------------------------------------------------
  it('query too long: returns 400 when q exceeds 200 characters', async () => {
    const longQuery = 'a'.repeat(201)
    const req = makeSearchRequest('wedding-2026', longQuery)
    const res = await GET(req, { params: Promise.resolve({ slug: 'wedding-2026' }) })

    expect(res.status).toBe(400)
    expect(mockEmbeddingsCreate).not.toHaveBeenCalled()
  })

  // -------------------------------------------------------------------------
  // Test 12: OpenAI returns empty data array → 502
  // -------------------------------------------------------------------------
  it('empty embedding response: returns 502 when OpenAI returns data: []', async () => {
    mockEmbeddingsCreate.mockResolvedValue({ data: [] } as any)

    const req = makeSearchRequest('wedding-2026', 'cake')
    const res = await GET(req, { params: Promise.resolve({ slug: 'wedding-2026' }) })

    expect(res.status).toBe(502)
    expect(mockRpc).not.toHaveBeenCalled()
  })
})
