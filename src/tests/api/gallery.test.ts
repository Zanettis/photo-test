import { describe, it, expect, vi, beforeEach, type Mock } from 'vitest'
import { NextRequest } from 'next/server'

// ---------------------------------------------------------------------------
// Mock external dependencies before any route imports
// ---------------------------------------------------------------------------

// Mock @/lib/supabase — both server (auth + RLS) and service (storage + DB) clients
vi.mock('@/lib/supabase', () => ({
  createServerSupabaseClient: vi.fn(),
  createServiceClient: vi.fn(),
}))

// Stub next/headers to prevent cookie resolution blowing up in jsdom
vi.mock('next/headers', () => ({
  cookies: vi.fn().mockResolvedValue({ getAll: () => [], set: () => {} }),
}))

import { createServerSupabaseClient, createServiceClient } from '@/lib/supabase'
import { GET } from '@/app/api/events/[slug]/gallery/route'

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Build a NextRequest for the gallery route */
function makeGalleryRequest(slug: string, limit?: number | string, offset?: number | string): NextRequest {
  const url = new URL(`http://localhost/api/events/${slug}/gallery`)
  if (limit !== undefined) url.searchParams.set('limit', String(limit))
  if (offset !== undefined) url.searchParams.set('offset', String(offset))
  return new NextRequest(url.toString())
}

// ---------------------------------------------------------------------------
// Shared constants
// ---------------------------------------------------------------------------

const FAKE_USER = { id: 'user-host-1' }
const FAKE_EVENT = {
  id: 'event-uuid-1',
  slug: 'wedding-2026',
  name: 'Wedding 2026',
  event_date: '2026-06-01',
  reveal_at: null,
  closes_at: null,
  host_id: 'user-host-1',
}

const FAKE_PHOTOS = [
  {
    id: 'photo-1',
    storage_path: 'events/wedding-2026/photo-1.jpg',
    tags: ['ceremony'],
    tagging_status: 'done',
    uploaded_at: '2026-05-27T10:00:00Z',
    is_flagged: false,
  },
  {
    id: 'photo-2',
    storage_path: 'events/wedding-2026/photo-2.jpg',
    tags: [],
    tagging_status: 'pending',
    uploaded_at: '2026-05-27T10:01:00Z',
    is_flagged: false,
  },
]

// ---------------------------------------------------------------------------
// Mock builders
// ---------------------------------------------------------------------------

/** Photos chain — tracks calls so we can assert on them */
function makePhotosChain(photosData: object[], count: number) {
  return {
    select: vi.fn().mockReturnThis(),
    eq: vi.fn().mockReturnThis(),
    order: vi.fn().mockReturnThis(),
    range: vi.fn().mockResolvedValue({ data: photosData, error: null, count }),
  }
}

/**
 * Build a service client mock that handles both DB table queries and storage.
 * The gallery route uses serviceClient for events lookup, photos query, AND storage.
 */
function makeServiceClientMock(opts: {
  eventData: object | null
  photosData?: object[]
  photosCount?: number
  photosChainOverride?: ReturnType<typeof makePhotosChain>
}) {
  const { eventData, photosData = FAKE_PHOTOS, photosCount = FAKE_PHOTOS.length, photosChainOverride } = opts
  const photosChain = photosChainOverride ?? makePhotosChain(photosData, photosCount)

  return {
    _photosChain: photosChain,
    from: vi.fn().mockImplementation((table: string) => {
      if (table === 'events') {
        return {
          select: vi.fn().mockReturnThis(),
          eq: vi.fn().mockReturnValue({
            single: () =>
              Promise.resolve({
                data: eventData,
                error: eventData ? null : { code: 'PGRST116' },
              }),
          }),
        }
      }
      if (table === 'photos') {
        return photosChain
      }
      throw new Error(`Unexpected table in serviceClient: ${table}`)
    }),
    storage: {
      from: () => ({
        getPublicUrl: vi.fn().mockReturnValue({
          data: { publicUrl: 'https://cdn.example.com/photos/test.jpg' },
        }),
      }),
    },
  }
}

// ---------------------------------------------------------------------------
// Shared mock state
// ---------------------------------------------------------------------------

let mockAuth: Mock

// ---------------------------------------------------------------------------
// Test suite
// ---------------------------------------------------------------------------

describe('GET /api/events/[slug]/gallery', () => {
  beforeEach(() => {
    vi.clearAllMocks()

    mockAuth = vi.fn().mockResolvedValue({ data: { user: FAKE_USER } })

    // Server client only needs auth — DB queries go through serviceClient
    vi.mocked(createServerSupabaseClient).mockResolvedValue({
      auth: { getUser: mockAuth },
    } as any)

    vi.mocked(createServiceClient).mockReturnValue(
      makeServiceClientMock({ eventData: FAKE_EVENT }) as any
    )
  })

  // -------------------------------------------------------------------------
  // Test 1: Valid request returns 200 with event + photos + pagination metadata
  // -------------------------------------------------------------------------
  it('valid request: returns 200 with event + photos + pagination metadata', async () => {
    const req = makeGalleryRequest('wedding-2026')
    const res = await GET(req, { params: Promise.resolve({ slug: 'wedding-2026' }) })

    expect(res.status).toBe(200)
    const body = await res.json()

    // Top-level pagination fields
    expect(body.total).toBe(2)
    expect(body.offset).toBe(0)
    expect(body.limit).toBe(50) // DEFAULT_LIMIT

    // Event shape
    expect(body.event).toMatchObject({
      id: 'event-uuid-1',
      slug: 'wedding-2026',
      name: 'Wedding 2026',
      event_date: '2026-06-01',
    })

    // Photos array
    expect(Array.isArray(body.photos)).toBe(true)
    expect(body.photos).toHaveLength(2)
    expect(body.photos[0]).toMatchObject({
      id: expect.any(String),
      url: expect.any(String),
      tags: expect.any(Array),
      tagging_status: expect.any(String),
      uploaded_at: expect.any(String),
    })
  })

  // -------------------------------------------------------------------------
  // Test 2: Unauthenticated user can see a revealed gallery (reveal_at=null)
  // -------------------------------------------------------------------------
  it('unauthenticated: returns 200 for a revealed event (reveal_at is null)', async () => {
    mockAuth.mockResolvedValue({ data: { user: null } })

    const req = makeGalleryRequest('wedding-2026')
    const res = await GET(req, { params: Promise.resolve({ slug: 'wedding-2026' }) })

    // reveal_at is null => is_revealed = true, so unauthenticated user gets access
    expect(res.status).toBe(200)
  })

  // -------------------------------------------------------------------------
  // Test 3: Unauthenticated user blocked from unrevealed gallery
  // -------------------------------------------------------------------------
  it('unauthenticated: returns 403 for an unrevealed event (reveal_at in the future)', async () => {
    const futureRevealAt = new Date(Date.now() + 86400_000).toISOString()
    const unrevealedEvent = { ...FAKE_EVENT, reveal_at: futureRevealAt }

    vi.mocked(createServiceClient).mockReturnValue(
      makeServiceClientMock({ eventData: unrevealedEvent }) as any
    )
    mockAuth.mockResolvedValue({ data: { user: null } })

    const req = makeGalleryRequest('wedding-2026')
    const res = await GET(req, { params: Promise.resolve({ slug: 'wedding-2026' }) })

    expect(res.status).toBe(403)
    const body = await res.json()
    expect(body.error).toBe('not_revealed')
    expect(body.is_revealed).toBe(false)
  })

  // -------------------------------------------------------------------------
  // Test 4: Host can see own unrevealed gallery
  // -------------------------------------------------------------------------
  it('host: returns 200 for own unrevealed event (reveal_at in the future)', async () => {
    const futureRevealAt = new Date(Date.now() + 86400_000).toISOString()
    const unrevealedEvent = { ...FAKE_EVENT, reveal_at: futureRevealAt, host_id: FAKE_USER.id }

    vi.mocked(createServiceClient).mockReturnValue(
      makeServiceClientMock({ eventData: unrevealedEvent }) as any
    )

    const req = makeGalleryRequest('wedding-2026')
    const res = await GET(req, { params: Promise.resolve({ slug: 'wedding-2026' }) })

    // Authenticated host always bypasses reveal gate
    expect(res.status).toBe(200)
  })

  // -------------------------------------------------------------------------
  // Test 5: Event not found → 404
  // -------------------------------------------------------------------------
  it('event not found: returns 404 when event does not exist', async () => {
    vi.mocked(createServiceClient).mockReturnValue(
      makeServiceClientMock({ eventData: null }) as any
    )

    const req = makeGalleryRequest('no-such-event')
    const res = await GET(req, { params: Promise.resolve({ slug: 'no-such-event' }) })

    expect(res.status).toBe(404)
  })

  // -------------------------------------------------------------------------
  // Test 6: Non-host authenticated user blocked from unrevealed gallery
  // Security check: isHost uses strict === comparison (user.id === event.host_id)
  // -------------------------------------------------------------------------
  it('non-host: returns 403 for unrevealed event owned by another host', async () => {
    const futureRevealAt = new Date(Date.now() + 86400_000).toISOString()
    const otherHostEvent = { ...FAKE_EVENT, reveal_at: futureRevealAt, host_id: 'other-user-id' }

    vi.mocked(createServiceClient).mockReturnValue(
      makeServiceClientMock({ eventData: otherHostEvent }) as any
    )

    const req = makeGalleryRequest('wedding-2026')
    const res = await GET(req, { params: Promise.resolve({ slug: 'wedding-2026' }) })

    // Strict ===: FAKE_USER.id !== 'other-user-id', so not a host
    expect(res.status).toBe(403)
    const body = await res.json()
    expect(body.error).toBe('not_revealed')
  })

  // -------------------------------------------------------------------------
  // Test 7: limit=-1 sanitized to 1 → range called with (0, 0)
  // -------------------------------------------------------------------------
  it('limit=-1 sanitized to 1: range called with (0, 0)', async () => {
    const photosChain = makePhotosChain(FAKE_PHOTOS, 2)
    vi.mocked(createServiceClient).mockReturnValue(
      makeServiceClientMock({ eventData: FAKE_EVENT, photosChainOverride: photosChain }) as any
    )

    const req = makeGalleryRequest('wedding-2026', -1)
    const res = await GET(req, { params: Promise.resolve({ slug: 'wedding-2026' }) })

    expect(res.status).toBe(200)
    // With limit=1 and offset=0: range(0, 0+1-1) = range(0, 0)
    expect(photosChain.range).toHaveBeenCalledWith(0, 0)
  })

  // -------------------------------------------------------------------------
  // Test 8: limit=NaN (non-numeric string) sanitized to DEFAULT 50 → range(0, 49)
  // -------------------------------------------------------------------------
  it('limit=NaN sanitized to DEFAULT 50: range called with (0, 49)', async () => {
    const photosChain = makePhotosChain(FAKE_PHOTOS, 2)
    vi.mocked(createServiceClient).mockReturnValue(
      makeServiceClientMock({ eventData: FAKE_EVENT, photosChainOverride: photosChain }) as any
    )

    const req = makeGalleryRequest('wedding-2026', 'abc')
    const res = await GET(req, { params: Promise.resolve({ slug: 'wedding-2026' }) })

    expect(res.status).toBe(200)
    // With limit=50 (default) and offset=0: range(0, 0+50-1) = range(0, 49)
    expect(photosChain.range).toHaveBeenCalledWith(0, 49)
  })

  // -------------------------------------------------------------------------
  // Test 9: offset=-5 sanitized to 0 → range called with (0, limit-1)
  // -------------------------------------------------------------------------
  it('offset=-5 sanitized to 0: range called with (0, limit-1)', async () => {
    const photosChain = makePhotosChain(FAKE_PHOTOS, 2)
    vi.mocked(createServiceClient).mockReturnValue(
      makeServiceClientMock({ eventData: FAKE_EVENT, photosChainOverride: photosChain }) as any
    )

    const req = makeGalleryRequest('wedding-2026', undefined, -5)
    const res = await GET(req, { params: Promise.resolve({ slug: 'wedding-2026' }) })

    expect(res.status).toBe(200)
    // offset sanitized to 0, limit defaults to 50: range(0, 49)
    expect(photosChain.range).toHaveBeenCalledWith(0, 49)
  })

  // -------------------------------------------------------------------------
  // Test 10: is_flagged filter applied → eq called with ('is_flagged', false)
  // -------------------------------------------------------------------------
  it('is_flagged filter applied: eq called with (is_flagged, false)', async () => {
    const photosChain = makePhotosChain(FAKE_PHOTOS, 2)
    vi.mocked(createServiceClient).mockReturnValue(
      makeServiceClientMock({ eventData: FAKE_EVENT, photosChainOverride: photosChain }) as any
    )

    const req = makeGalleryRequest('wedding-2026')
    const res = await GET(req, { params: Promise.resolve({ slug: 'wedding-2026' }) })

    expect(res.status).toBe(200)
    expect(photosChain.eq).toHaveBeenCalledWith('is_flagged', false)
  })
})
