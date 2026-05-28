import { describe, it, expect, vi, beforeEach, type Mock } from 'vitest'
import { NextRequest } from 'next/server'

// ---------------------------------------------------------------------------
// Mock external dependencies before any route imports
// ---------------------------------------------------------------------------

vi.mock('@/lib/supabase', () => ({
  createServerSupabaseClient: vi.fn(),
  createServiceClient: vi.fn(),
}))

vi.mock('next/headers', () => ({
  cookies: vi.fn().mockResolvedValue({ getAll: () => [], set: () => {} }),
}))

import { createServerSupabaseClient, createServiceClient } from '@/lib/supabase'
import { DELETE } from '@/app/api/events/[slug]/photos/[photo_id]/route'
import { PATCH } from '@/app/api/events/[slug]/route'

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function makeDeleteRequest(slug: string, photoId: string): NextRequest {
  const url = new URL(`http://localhost/api/events/${slug}/photos/${photoId}`)
  return new NextRequest(url.toString(), { method: 'DELETE' })
}

function makePatchRequest(slug: string, body: object): NextRequest {
  const url = new URL(`http://localhost/api/events/${slug}`)
  return new NextRequest(url.toString(), {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  })
}

// ---------------------------------------------------------------------------
// Test constants
// ---------------------------------------------------------------------------

const FAKE_USER = { id: 'user-123', email: 'host@test.com' }
const FAKE_EVENT = {
  id: 'event-456',
  slug: 'wedding-2026',
  name: 'Casamento',
  host_id: 'user-123',
  event_date: '2026-06-01',
  closes_at: null,
  closes_notified_at: null,
}
const FAKE_PHOTO = {
  id: 'photo-789',
  event_id: 'event-456',
  storage_path: 'events/event-456/photo-789.jpg',
}

// ---------------------------------------------------------------------------
// Shared mock state
// ---------------------------------------------------------------------------

let mockAuth: Mock
let mockFrom: Mock
let mockStorageRemove: Mock

// ---------------------------------------------------------------------------
// Helper: build a chainable .from('events') SELECT mock that returns single()
// ---------------------------------------------------------------------------
function makeEventSingleMock(eventData: object | null) {
  return {
    select: vi.fn().mockReturnThis(),
    eq: vi.fn().mockReturnThis(),
    single: vi.fn().mockResolvedValue({
      data: eventData,
      error: eventData ? null : { code: 'PGRST116' },
    }),
  }
}

// ---------------------------------------------------------------------------
// Helper: build a chainable photos SELECT mock (for IDOR check)
// The route calls: .from('photos').select(...).eq('id', ...).eq('event_id', ...).single()
// ---------------------------------------------------------------------------
function makePhotoSelectMock(photoData: object | null) {
  return {
    select: vi.fn().mockReturnThis(),
    eq: vi.fn().mockReturnThis(),
    single: vi.fn().mockResolvedValue({
      data: photoData,
      error: photoData ? null : { code: 'PGRST116' },
    }),
    // Also expose delete so the same object can handle both calls
    delete: vi.fn().mockReturnValue({
      eq: vi.fn().mockResolvedValue({ error: null }),
    }),
  }
}

// ---------------------------------------------------------------------------
// DELETE /api/events/[slug]/photos/[photo_id]
// ---------------------------------------------------------------------------

describe('DELETE /api/events/[slug]/photos/[photo_id]', () => {
  beforeEach(() => {
    vi.clearAllMocks()

    // Default storage mock — succeeds
    mockStorageRemove = vi.fn().mockResolvedValue({ error: null })
    vi.mocked(createServiceClient).mockReturnValue({
      storage: {
        from: vi.fn().mockReturnValue({ remove: mockStorageRemove }),
      },
    } as any)

    // Default mockFrom: events → FAKE_EVENT, photos → FAKE_PHOTO with working delete
    mockFrom = vi.fn().mockImplementation((table: string) => {
      if (table === 'events') return makeEventSingleMock(FAKE_EVENT)
      if (table === 'photos') return makePhotoSelectMock(FAKE_PHOTO)
      throw new Error(`Unexpected table: ${table}`)
    })

    mockAuth = vi.fn().mockResolvedValue({ data: { user: FAKE_USER } })

    vi.mocked(createServerSupabaseClient).mockResolvedValue({
      auth: { getUser: mockAuth },
      from: mockFrom,
    } as any)
  })

  // -------------------------------------------------------------------------
  // Test 1: Unauthenticated → 401
  // -------------------------------------------------------------------------
  it('unauthenticated: returns 401 when no session exists', async () => {
    mockAuth.mockResolvedValue({ data: { user: null } })

    const res = await DELETE(
      makeDeleteRequest('wedding-2026', 'photo-789'),
      { params: Promise.resolve({ slug: 'wedding-2026', photo_id: 'photo-789' }) }
    )

    expect(res.status).toBe(401)
  })

  // -------------------------------------------------------------------------
  // Test 2: Event not found → 403
  // -------------------------------------------------------------------------
  it('event not found: returns 403 when event query returns null', async () => {
    mockFrom.mockImplementation((table: string) => {
      if (table === 'events') return makeEventSingleMock(null)
      if (table === 'photos') return makePhotoSelectMock(FAKE_PHOTO)
      throw new Error(`Unexpected table: ${table}`)
    })

    const res = await DELETE(
      makeDeleteRequest('wedding-2026', 'photo-789'),
      { params: Promise.resolve({ slug: 'wedding-2026', photo_id: 'photo-789' }) }
    )

    expect(res.status).toBe(403)
  })

  // -------------------------------------------------------------------------
  // Test 3: host_id !== user.id → 403
  // -------------------------------------------------------------------------
  it('wrong owner: returns 403 when event belongs to a different host', async () => {
    const otherOwnerEvent = { ...FAKE_EVENT, host_id: 'outro-user' }
    mockFrom.mockImplementation((table: string) => {
      if (table === 'events') return makeEventSingleMock(otherOwnerEvent)
      if (table === 'photos') return makePhotoSelectMock(FAKE_PHOTO)
      throw new Error(`Unexpected table: ${table}`)
    })

    const res = await DELETE(
      makeDeleteRequest('wedding-2026', 'photo-789'),
      { params: Promise.resolve({ slug: 'wedding-2026', photo_id: 'photo-789' }) }
    )

    expect(res.status).toBe(403)
  })

  // -------------------------------------------------------------------------
  // Test 4: Photo does not belong to event → 404 (IDOR protection)
  // -------------------------------------------------------------------------
  it('IDOR protection: returns 404 when photo does not belong to this event', async () => {
    mockFrom.mockImplementation((table: string) => {
      if (table === 'events') return makeEventSingleMock(FAKE_EVENT)
      if (table === 'photos') return makePhotoSelectMock(null)
      throw new Error(`Unexpected table: ${table}`)
    })

    const res = await DELETE(
      makeDeleteRequest('wedding-2026', 'photo-from-other-event'),
      { params: Promise.resolve({ slug: 'wedding-2026', photo_id: 'photo-from-other-event' }) }
    )

    expect(res.status).toBe(404)
    // Storage must NOT have been touched
    expect(mockStorageRemove).not.toHaveBeenCalled()
  })

  // -------------------------------------------------------------------------
  // Test 5: Storage delete fails → 500 and DB is never touched
  // -------------------------------------------------------------------------
  it('storage failure: returns 500 and does not call DB delete when storage.remove fails', async () => {
    mockStorageRemove.mockResolvedValue({ error: { message: 'storage error' } })

    // Track whether DB delete was called
    const dbDeleteSpy = vi.fn().mockReturnValue({
      eq: vi.fn().mockResolvedValue({ error: null }),
    })

    mockFrom.mockImplementation((table: string) => {
      if (table === 'events') return makeEventSingleMock(FAKE_EVENT)
      if (table === 'photos') {
        return {
          select: vi.fn().mockReturnThis(),
          eq: vi.fn().mockReturnThis(),
          single: vi.fn().mockResolvedValue({ data: FAKE_PHOTO, error: null }),
          delete: dbDeleteSpy,
        }
      }
      throw new Error(`Unexpected table: ${table}`)
    })

    const res = await DELETE(
      makeDeleteRequest('wedding-2026', 'photo-789'),
      { params: Promise.resolve({ slug: 'wedding-2026', photo_id: 'photo-789' }) }
    )

    expect(res.status).toBe(500)
    const body = await res.json()
    expect(body.error).toBe('storage_delete_failed')

    // DB delete must never have been called
    expect(dbDeleteSpy).not.toHaveBeenCalled()
  })

  // -------------------------------------------------------------------------
  // Test 6: DB delete fails → 500
  // -------------------------------------------------------------------------
  it('db failure: returns 500 when DB delete returns an error', async () => {
    const dbDeleteSpy = vi.fn().mockReturnValue({
      eq: vi.fn().mockResolvedValue({ error: { message: 'db error' } }),
    })

    mockFrom.mockImplementation((table: string) => {
      if (table === 'events') return makeEventSingleMock(FAKE_EVENT)
      if (table === 'photos') {
        return {
          select: vi.fn().mockReturnThis(),
          eq: vi.fn().mockReturnThis(),
          single: vi.fn().mockResolvedValue({ data: FAKE_PHOTO, error: null }),
          delete: dbDeleteSpy,
        }
      }
      throw new Error(`Unexpected table: ${table}`)
    })

    const res = await DELETE(
      makeDeleteRequest('wedding-2026', 'photo-789'),
      { params: Promise.resolve({ slug: 'wedding-2026', photo_id: 'photo-789' }) }
    )

    expect(res.status).toBe(500)
    const body = await res.json()
    expect(body.error).toBe('db_delete_failed')
  })

  // -------------------------------------------------------------------------
  // Test 7: Successful delete → 204
  // -------------------------------------------------------------------------
  it('success: returns 204 and calls storage.remove with the correct path', async () => {
    const dbDeleteSpy = vi.fn().mockReturnValue({
      eq: vi.fn().mockResolvedValue({ error: null }),
    })

    mockFrom.mockImplementation((table: string) => {
      if (table === 'events') return makeEventSingleMock(FAKE_EVENT)
      if (table === 'photos') {
        return {
          select: vi.fn().mockReturnThis(),
          eq: vi.fn().mockReturnThis(),
          single: vi.fn().mockResolvedValue({ data: FAKE_PHOTO, error: null }),
          delete: dbDeleteSpy,
        }
      }
      throw new Error(`Unexpected table: ${table}`)
    })

    const res = await DELETE(
      makeDeleteRequest('wedding-2026', 'photo-789'),
      { params: Promise.resolve({ slug: 'wedding-2026', photo_id: 'photo-789' }) }
    )

    expect(res.status).toBe(204)
    expect(mockStorageRemove).toHaveBeenCalledWith([FAKE_PHOTO.storage_path])
    expect(dbDeleteSpy).toHaveBeenCalledOnce()
  })
})

// ---------------------------------------------------------------------------
// PATCH /api/events/[slug]
// ---------------------------------------------------------------------------

describe('PATCH /api/events/[slug]', () => {
  // The PATCH route calls supabase.from('events') TWICE:
  //   1st: SELECT to verify ownership
  //   2nd: UPDATE with the patch
  // We use a call-counter to return different chains per call.

  function makePatchFromMock(
    selectData: object | null,
    updateResult: { data: object | null; error: object | null }
  ) {
    let callIndex = 0
    return vi.fn().mockImplementation((table: string) => {
      if (table !== 'events') throw new Error(`Unexpected table: ${table}`)
      callIndex++
      if (callIndex === 1) {
        // First call: SELECT for ownership check
        return {
          select: vi.fn().mockReturnThis(),
          eq: vi.fn().mockReturnThis(),
          single: vi.fn().mockResolvedValue({
            data: selectData,
            error: selectData ? null : { code: 'PGRST116' },
          }),
        }
      }
      // Second call: UPDATE
      return {
        update: vi.fn().mockReturnThis(),
        eq: vi.fn().mockReturnThis(),
        select: vi.fn().mockReturnThis(),
        single: vi.fn().mockResolvedValue(updateResult),
      }
    })
  }

  beforeEach(() => {
    vi.clearAllMocks()

    mockAuth = vi.fn().mockResolvedValue({ data: { user: FAKE_USER } })

    // Default: SELECT returns FAKE_EVENT, UPDATE returns updated event
    mockFrom = makePatchFromMock(FAKE_EVENT, {
      data: {
        id: FAKE_EVENT.id,
        slug: FAKE_EVENT.slug,
        name: FAKE_EVENT.name,
        event_date: FAKE_EVENT.event_date,
        closes_at: null,
      },
      error: null,
    })

    vi.mocked(createServerSupabaseClient).mockResolvedValue({
      auth: { getUser: mockAuth },
      from: mockFrom,
    } as any)

    vi.mocked(createServiceClient).mockReturnValue({} as any)
  })

  // -------------------------------------------------------------------------
  // Test 1: Unauthenticated → 401
  // -------------------------------------------------------------------------
  it('unauthenticated: returns 401 when no session exists', async () => {
    mockAuth.mockResolvedValue({ data: { user: null } })

    const res = await PATCH(
      makePatchRequest('wedding-2026', { name: 'New Name' }),
      { params: Promise.resolve({ slug: 'wedding-2026' }) }
    )

    expect(res.status).toBe(401)
  })

  // -------------------------------------------------------------------------
  // Test 2: Event does not belong to authenticated host → 403
  // -------------------------------------------------------------------------
  it('wrong owner: returns 403 when event belongs to a different host', async () => {
    const otherOwnerEvent = { ...FAKE_EVENT, host_id: 'outro-user' }
    mockFrom = makePatchFromMock(otherOwnerEvent, { data: null, error: null })
    vi.mocked(createServerSupabaseClient).mockResolvedValue({
      auth: { getUser: mockAuth },
      from: mockFrom,
    } as any)

    const res = await PATCH(
      makePatchRequest('wedding-2026', { name: 'Hack Attempt' }),
      { params: Promise.resolve({ slug: 'wedding-2026' }) }
    )

    expect(res.status).toBe(403)
  })

  // -------------------------------------------------------------------------
  // Test 3: Body with no updatable fields → 400
  // -------------------------------------------------------------------------
  it('empty body: returns 400 when body has no recognized fields', async () => {
    const res = await PATCH(
      makePatchRequest('wedding-2026', {}),
      { params: Promise.resolve({ slug: 'wedding-2026' }) }
    )

    expect(res.status).toBe(400)
    const body = await res.json()
    expect(body.error).toBe('nothing_to_update')
  })

  // -------------------------------------------------------------------------
  // Test 4: closes_at with invalid (non-ISO) string → 400
  // -------------------------------------------------------------------------
  it('invalid closes_at: returns 400 when closes_at is not a valid date string', async () => {
    const res = await PATCH(
      makePatchRequest('wedding-2026', { closes_at: 'not-a-date' }),
      { params: Promise.resolve({ slug: 'wedding-2026' }) }
    )

    expect(res.status).toBe(400)
    const body = await res.json()
    expect(body.error).toBe('invalid_closes_at')
  })

  // -------------------------------------------------------------------------
  // Test 5: name is empty/blank string → 400
  // -------------------------------------------------------------------------
  it('empty name: returns 400 when name is a blank string', async () => {
    const res = await PATCH(
      makePatchRequest('wedding-2026', { name: '   ' }),
      { params: Promise.resolve({ slug: 'wedding-2026' }) }
    )

    expect(res.status).toBe(400)
    const body = await res.json()
    expect(body.error).toBe('invalid_name')
  })

  // -------------------------------------------------------------------------
  // Test 6: Valid PATCH → 200 with updated data
  // -------------------------------------------------------------------------
  it('valid patch: returns 200 with updated event data', async () => {
    const updatedEvent = {
      id: FAKE_EVENT.id,
      slug: FAKE_EVENT.slug,
      name: 'Novo Nome',
      event_date: FAKE_EVENT.event_date,
      closes_at: '2026-06-02T00:00:00.000Z',
    }

    mockFrom = makePatchFromMock(FAKE_EVENT, { data: updatedEvent, error: null })
    vi.mocked(createServerSupabaseClient).mockResolvedValue({
      auth: { getUser: mockAuth },
      from: mockFrom,
    } as any)

    const res = await PATCH(
      makePatchRequest('wedding-2026', {
        name: 'Novo Nome',
        closes_at: '2026-06-02T00:00:00.000Z',
      }),
      { params: Promise.resolve({ slug: 'wedding-2026' }) }
    )

    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body.name).toBe('Novo Nome')
    expect(body.closes_at).toBe('2026-06-02T00:00:00.000Z')
    expect(body.slug).toBe(FAKE_EVENT.slug)
    expect(body.id).toBe(FAKE_EVENT.id)
  })

  // -------------------------------------------------------------------------
  // Test 7: Event slug not found → 403
  // -------------------------------------------------------------------------
  it('event not found: returns 403 when slug does not match any event', async () => {
    mockFrom = makePatchFromMock(null, { data: null, error: null })
    vi.mocked(createServerSupabaseClient).mockResolvedValue({
      auth: { getUser: mockAuth },
      from: mockFrom,
    } as any)

    const res = await PATCH(
      makePatchRequest('slug-inexistente', { name: 'Test' }),
      { params: Promise.resolve({ slug: 'slug-inexistente' }) }
    )
    expect(res.status).toBe(403)
  })

  // -------------------------------------------------------------------------
  // Test 8: closes_at in the past → 400
  // -------------------------------------------------------------------------
  it('closes_at in past: returns 400 when closes_at is a past date', async () => {
    const res = await PATCH(
      makePatchRequest('wedding-2026', { closes_at: '2020-01-01T00:00:00.000Z' }),
      { params: Promise.resolve({ slug: 'wedding-2026' }) }
    )
    expect(res.status).toBe(400)
    const body = await res.json()
    expect(body.error).toBe('closes_at_must_be_future')
  })

  // -------------------------------------------------------------------------
  // Test 9: closes_at beyond 90 days from event_date → 400
  // -------------------------------------------------------------------------
  it('closes_at beyond 90 days from event_date: returns 400', async () => {
    // FAKE_EVENT.event_date = '2026-06-01'
    // 91 days after 2026-06-01 = 2026-08-31; use 2026-09-01 to be clearly over
    const res = await PATCH(
      makePatchRequest('wedding-2026', { closes_at: '2026-09-01T00:00:00.000Z' }),
      { params: Promise.resolve({ slug: 'wedding-2026' }) }
    )
    expect(res.status).toBe(400)
    const body = await res.json()
    expect(body.error).toBe('closes_at_exceeds_90_days')
  })
})
