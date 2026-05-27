import { describe, it, expect, vi, beforeEach } from 'vitest'
import { NextRequest } from 'next/server'

// ---------------------------------------------------------------------------
// Mock Supabase modules before any route imports
// ---------------------------------------------------------------------------
vi.mock('@/lib/supabase', () => ({
  createServerSupabaseClient: vi.fn(),
  createServiceClient: vi.fn(),
}))

// next/headers is used by createServerSupabaseClient internally; stub it so
// the import chain doesn't blow up in jsdom.
vi.mock('next/headers', () => ({
  cookies: vi.fn().mockResolvedValue({ getAll: () => [], set: () => {} }),
}))

import { createServerSupabaseClient, createServiceClient } from '@/lib/supabase'
import { POST as postEvents } from '@/app/api/events/route'
import { GET as getEventSlug } from '@/app/api/events/[slug]/route'
import { POST as postUploadUrl } from '@/app/api/events/[slug]/upload-url/route'

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------
function makeRequest(url: string, options: RequestInit = {}) {
  return new NextRequest(url, options)
}

function jsonRequest(url: string, body: unknown, method = 'POST') {
  return makeRequest(url, {
    method,
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  })
}

// ---------------------------------------------------------------------------
// describe: POST /api/events
// ---------------------------------------------------------------------------
describe('POST /api/events', () => {
  // Shared mocks reused across tests in this block
  let mockAuth: ReturnType<typeof vi.fn>
  let mockFrom: ReturnType<typeof vi.fn>

  beforeEach(() => {
    vi.clearAllMocks()
    process.env.NEXT_PUBLIC_APP_URL = 'http://localhost:3000'

    // Default: authenticated user
    mockAuth = vi.fn().mockResolvedValue({ data: { user: { id: 'user-1' } } })
    mockFrom = vi.fn()

    vi.mocked(createServerSupabaseClient).mockResolvedValue({
      auth: { getUser: mockAuth },
      from: mockFrom,
    } as any)
  })

  it('returns 401 when unauthenticated', async () => {
    mockAuth.mockResolvedValue({ data: { user: null } })

    const req = jsonRequest('http://localhost/api/events', { name: 'Test', event_date: '2026-06-01', shot_cap: null })
    const res = await postEvents(req)
    expect(res.status).toBe(401)
  })

  it('returns 400 when name is empty', async () => {
    const req = jsonRequest('http://localhost/api/events', { name: '', event_date: '2026-06-01', shot_cap: null })
    const res = await postEvents(req)
    expect(res.status).toBe(400)
    const body = await res.json()
    expect(body.error).toMatch(/name/i)
  })

  it('returns 400 when event_date format is wrong', async () => {
    const req = jsonRequest('http://localhost/api/events', { name: 'Test', event_date: '01-06-2026', shot_cap: null })
    const res = await postEvents(req)
    expect(res.status).toBe(400)
    const body = await res.json()
    expect(body.error).toMatch(/event_date/i)
  })

  it('returns 400 when shot_cap is invalid value', async () => {
    const req = jsonRequest('http://localhost/api/events', { name: 'Test', event_date: '2026-06-01', shot_cap: 7 })
    const res = await postEvents(req)
    expect(res.status).toBe(400)
    const body = await res.json()
    expect(body.error).toMatch(/shot_cap/i)
  })

  it('returns 402 when free plan limit of 1 event is reached', async () => {
    // hosts query returns free plan host
    const hostChain = { data: { id: 'user-1', plan: 'free', email: 'a@b.com', created_at: '' }, error: null }
    // events count query returns count = 1 (at limit)
    const countChain = { count: 1, error: null }

    mockFrom.mockImplementation((table: string) => {
      if (table === 'hosts') {
        return { select: () => ({ eq: () => ({ single: () => Promise.resolve(hostChain) }) }) }
      }
      if (table === 'events') {
        return { select: () => ({ eq: () => Promise.resolve(countChain) }) }
      }
    })

    const req = jsonRequest('http://localhost/api/events', { name: 'Test', event_date: '2026-06-01', shot_cap: null })
    const res = await postEvents(req)
    expect(res.status).toBe(402)
  })

  it('returns 500 when NEXT_PUBLIC_APP_URL is not set', async () => {
    delete process.env.NEXT_PUBLIC_APP_URL

    const insertedEvent = { id: 'ev-1', slug: 'abc12345', name: 'Test', event_date: '2026-06-01', shot_cap: null, reveal_at: null }

    mockFrom.mockImplementation((table: string) => {
      if (table === 'hosts') {
        return { select: () => ({ eq: () => ({ single: () => Promise.resolve({ data: { id: 'user-1', plan: 'basic', email: 'a@b.com', created_at: '' } }) }) }) }
      }
      if (table === 'events') {
        // First call: count check (select with head). Second call: insert.
        let callCount = 0
        return {
          select: () => {
            callCount++
            if (callCount === 1) {
              // count query
              return { eq: () => Promise.resolve({ count: 0, error: null }) }
            }
            // should not reach here for this scenario
            return { eq: () => Promise.resolve({ count: 0 }) }
          },
          insert: () => ({ select: () => ({ single: () => Promise.resolve({ data: insertedEvent, error: null }) }) }),
        }
      }
    })

    const req = jsonRequest('http://localhost/api/events', { name: 'Test', event_date: '2026-06-01', shot_cap: null })
    const res = await postEvents(req)
    expect(res.status).toBe(500)
    const body = await res.json()
    expect(body.error).toMatch(/NEXT_PUBLIC_APP_URL/i)
  })

  it('returns 201 with event data on valid input', async () => {
    process.env.NEXT_PUBLIC_APP_URL = 'http://localhost:3000'

    const insertedEvent = { id: 'ev-1', slug: 'abc12345', name: 'Wedding', event_date: '2026-06-01', shot_cap: 10, reveal_at: null }

    mockFrom.mockImplementation((table: string) => {
      if (table === 'hosts') {
        return { select: () => ({ eq: () => ({ single: () => Promise.resolve({ data: { id: 'user-1', plan: 'basic', email: 'a@b.com', created_at: '' } }) }) }) }
      }
      if (table === 'events') {
        return {
          select: () => ({ eq: () => Promise.resolve({ count: 0, error: null }) }),
          insert: () => ({ select: () => ({ single: () => Promise.resolve({ data: insertedEvent, error: null }) }) }),
        }
      }
    })

    const req = jsonRequest('http://localhost/api/events', { name: 'Wedding', event_date: '2026-06-01', shot_cap: 10 })
    const res = await postEvents(req)
    expect(res.status).toBe(201)
    const body = await res.json()
    expect(body.slug).toBeDefined()
    expect(body.link).toMatch(/^http:\/\/localhost:3000\/e\//)
    expect(body.id).toBe('ev-1')
  })
})

// ---------------------------------------------------------------------------
// describe: GET /api/events/[slug]
// ---------------------------------------------------------------------------
describe('GET /api/events/[slug]', () => {
  let mockFrom: ReturnType<typeof vi.fn>

  beforeEach(() => {
    vi.clearAllMocks()

    mockFrom = vi.fn()
    vi.mocked(createServiceClient).mockReturnValue({
      from: mockFrom,
    } as any)
  })

  it('returns 404 for unknown slug', async () => {
    mockFrom.mockReturnValue({
      select: () => ({ eq: () => ({ single: () => Promise.resolve({ data: null, error: { code: 'PGRST116' } }) }) }),
    })

    const req = makeRequest('http://localhost/api/events/unknown-slug')
    const res = await getEventSlug(req, { params: Promise.resolve({ slug: 'unknown-slug' }) })
    expect(res.status).toBe(404)
  })

  it('returns 410 for closed event', async () => {
    const pastDate = new Date(Date.now() - 86400_000).toISOString()
    const event = {
      id: 'ev-1', slug: 'test-slug', name: 'Old Event',
      event_date: '2025-01-01', shot_cap: null,
      reveal_at: null, closes_at: pastDate,
    }

    mockFrom.mockReturnValue({
      select: () => ({ eq: () => ({ single: () => Promise.resolve({ data: event, error: null }) }) }),
    })

    const req = makeRequest('http://localhost/api/events/test-slug')
    const res = await getEventSlug(req, { params: Promise.resolve({ slug: 'test-slug' }) })
    expect(res.status).toBe(410)
  })

  it('returns is_open=true when closes_at is null', async () => {
    const event = {
      id: 'ev-1', slug: 'open-event', name: 'Open Event',
      event_date: '2026-06-01', shot_cap: null,
      reveal_at: null, closes_at: null,
    }

    mockFrom.mockReturnValue({
      select: () => ({ eq: () => ({ single: () => Promise.resolve({ data: event, error: null }) }) }),
    })

    const req = makeRequest('http://localhost/api/events/open-event')
    const res = await getEventSlug(req, { params: Promise.resolve({ slug: 'open-event' }) })
    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body.is_open).toBe(true)
  })

  it('returns is_revealed=false when reveal_at is in the future', async () => {
    const futureDate = new Date(Date.now() + 86400_000).toISOString()
    const event = {
      id: 'ev-1', slug: 'future-reveal', name: 'Reveal Later',
      event_date: '2026-06-01', shot_cap: null,
      reveal_at: futureDate, closes_at: null,
    }

    mockFrom.mockReturnValue({
      select: () => ({ eq: () => ({ single: () => Promise.resolve({ data: event, error: null }) }) }),
    })

    const req = makeRequest('http://localhost/api/events/future-reveal')
    const res = await getEventSlug(req, { params: Promise.resolve({ slug: 'future-reveal' }) })
    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body.is_revealed).toBe(false)
  })

  it('returns is_revealed=true when reveal_at is in the past', async () => {
    const pastDate = new Date(Date.now() - 86400_000).toISOString()
    const event = {
      id: 'ev-1', slug: 'past-reveal', name: 'Already Revealed',
      event_date: '2026-06-01', shot_cap: null,
      reveal_at: pastDate, closes_at: null,
    }

    mockFrom.mockReturnValue({
      select: () => ({ eq: () => ({ single: () => Promise.resolve({ data: event, error: null }) }) }),
    })

    const req = makeRequest('http://localhost/api/events/past-reveal')
    const res = await getEventSlug(req, { params: Promise.resolve({ slug: 'past-reveal' }) })
    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body.is_revealed).toBe(true)
  })

  it('returns shots_used count when X-Uploader-Token header is provided', async () => {
    const event = {
      id: 'ev-1', slug: 'token-event', name: 'Token Event',
      event_date: '2026-06-01', shot_cap: 10,
      reveal_at: null, closes_at: null,
    }

    mockFrom.mockImplementation((table: string) => {
      if (table === 'events') {
        return { select: () => ({ eq: () => ({ single: () => Promise.resolve({ data: event, error: null }) }) }) }
      }
      if (table === 'photos') {
        return {
          select: () => ({
            eq: () => ({
              eq: () => Promise.resolve({ count: 3, error: null }),
            }),
          }),
        }
      }
    })

    const req = makeRequest('http://localhost/api/events/token-event', {
      headers: { 'X-Uploader-Token': 'token-abc' },
    })
    const res = await getEventSlug(req, { params: Promise.resolve({ slug: 'token-event' }) })
    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body.shots_used).toBe(3)
  })
})

// ---------------------------------------------------------------------------
// describe: POST /api/events/[slug]/upload-url
// ---------------------------------------------------------------------------
describe('POST /api/events/[slug]/upload-url', () => {
  let mockFrom: ReturnType<typeof vi.fn>
  let mockStorageFrom: ReturnType<typeof vi.fn>
  let mockCreateSignedUploadUrl: ReturnType<typeof vi.fn>

  const baseEvent = {
    id: 'ev-1',
    slug: 'test-slug',
    shot_cap: 5,
    closes_at: null,
  }

  const validBody = {
    uploader_token: 'tok-123',
    file_name: 'photo.jpg',
    mime_type: 'image/jpeg',
    file_size_bytes: 1024,
  }

  beforeEach(() => {
    vi.clearAllMocks()

    mockCreateSignedUploadUrl = vi.fn().mockResolvedValue({
      data: { signedUrl: 'https://storage.example.com/signed' },
      error: null,
    })
    mockStorageFrom = vi.fn().mockReturnValue({
      createSignedUploadUrl: mockCreateSignedUploadUrl,
    })
    mockFrom = vi.fn()

    vi.mocked(createServiceClient).mockReturnValue({
      from: mockFrom,
      storage: { from: mockStorageFrom },
    } as any)
  })

  it('returns 400 for missing uploader_token', async () => {
    const req = jsonRequest('http://localhost/api/events/test-slug/upload-url', {
      file_name: 'photo.jpg',
      mime_type: 'image/jpeg',
      file_size_bytes: 1024,
    })
    const res = await postUploadUrl(req, { params: Promise.resolve({ slug: 'test-slug' }) })
    expect(res.status).toBe(400)
    const body = await res.json()
    expect(body.error).toBe('missing_fields')
  })

  it('returns 404 for unknown event slug', async () => {
    mockFrom.mockReturnValue({
      select: () => ({ eq: () => ({ single: () => Promise.resolve({ data: null, error: { code: 'PGRST116' } }) }) }),
    })

    const req = jsonRequest('http://localhost/api/events/no-such-slug/upload-url', validBody)
    const res = await postUploadUrl(req, { params: Promise.resolve({ slug: 'no-such-slug' }) })
    expect(res.status).toBe(404)
  })

  it('returns 403 for closed event', async () => {
    const pastDate = new Date(Date.now() - 86400_000).toISOString()
    const closedEvent = { ...baseEvent, closes_at: pastDate }

    mockFrom.mockReturnValue({
      select: () => ({ eq: () => ({ single: () => Promise.resolve({ data: closedEvent, error: null }) }) }),
    })

    const req = jsonRequest('http://localhost/api/events/test-slug/upload-url', validBody)
    const res = await postUploadUrl(req, { params: Promise.resolve({ slug: 'test-slug' }) })
    expect(res.status).toBe(403)
    const body = await res.json()
    expect(body.error).toBe('event_closed')
  })

  it('returns 400 for disallowed MIME type', async () => {
    mockFrom.mockReturnValue({
      select: () => ({ eq: () => ({ single: () => Promise.resolve({ data: baseEvent, error: null }) }) }),
    })

    const req = jsonRequest('http://localhost/api/events/test-slug/upload-url', {
      ...validBody,
      mime_type: 'image/gif',
    })
    const res = await postUploadUrl(req, { params: Promise.resolve({ slug: 'test-slug' }) })
    expect(res.status).toBe(400)
    const body = await res.json()
    expect(body.error).toBe('invalid_mime_type')
  })

  it('returns 400 for file exceeding 50MB', async () => {
    mockFrom.mockReturnValue({
      select: () => ({ eq: () => ({ single: () => Promise.resolve({ data: baseEvent, error: null }) }) }),
    })

    const req = jsonRequest('http://localhost/api/events/test-slug/upload-url', {
      ...validBody,
      file_size_bytes: 52428801,
    })
    const res = await postUploadUrl(req, { params: Promise.resolve({ slug: 'test-slug' }) })
    expect(res.status).toBe(400)
    const body = await res.json()
    expect(body.error).toBe('file_too_large')
  })

  it('returns 429 shot_cap_reached when upload count equals shot_cap', async () => {
    mockFrom.mockImplementation((table: string) => {
      if (table === 'events') {
        return { select: () => ({ eq: () => ({ single: () => Promise.resolve({ data: baseEvent, error: null }) }) }) }
      }
      if (table === 'photos') {
        // count equals shot_cap (5)
        return { select: () => ({ eq: () => ({ eq: () => Promise.resolve({ count: 5, error: null }) }) }) }
      }
    })

    const req = jsonRequest('http://localhost/api/events/test-slug/upload-url', validBody)
    const res = await postUploadUrl(req, { params: Promise.resolve({ slug: 'test-slug' }) })
    expect(res.status).toBe(429)
    const body = await res.json()
    expect(body.error).toBe('shot_cap_reached')
  })

  it('returns 429 rate_limit when upload count equals 50', async () => {
    // shot_cap is null so shot_cap check is skipped; rate limit (50) fires
    const noCapEvent = { ...baseEvent, shot_cap: null }

    mockFrom.mockImplementation((table: string) => {
      if (table === 'events') {
        return { select: () => ({ eq: () => ({ single: () => Promise.resolve({ data: noCapEvent, error: null }) }) }) }
      }
      if (table === 'photos') {
        return { select: () => ({ eq: () => ({ eq: () => Promise.resolve({ count: 50, error: null }) }) }) }
      }
    })

    const req = jsonRequest('http://localhost/api/events/test-slug/upload-url', validBody)
    const res = await postUploadUrl(req, { params: Promise.resolve({ slug: 'test-slug' }) })
    expect(res.status).toBe(429)
    const body = await res.json()
    expect(body.error).toBe('rate_limit')
  })

  it('returns 200 with upload_url on valid request', async () => {
    const noCapEvent = { ...baseEvent, shot_cap: null }

    mockFrom.mockImplementation((table: string) => {
      if (table === 'events') {
        return { select: () => ({ eq: () => ({ single: () => Promise.resolve({ data: noCapEvent, error: null }) }) }) }
      }
      if (table === 'photos') {
        return {
          select: () => ({ eq: () => ({ eq: () => Promise.resolve({ count: 0, error: null }) }) }),
          insert: () => Promise.resolve({ data: null, error: null }),
        }
      }
    })

    const req = jsonRequest('http://localhost/api/events/test-slug/upload-url', validBody)
    const res = await postUploadUrl(req, { params: Promise.resolve({ slug: 'test-slug' }) })
    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body.upload_url).toBe('https://storage.example.com/signed')
    expect(body.photo_id).toBeDefined()
    expect(body.storage_path).toMatch(/^events\/test-slug\//)
    expect(body.expires_in).toBe(300)
    expect(body.shots_remaining).toBeNull()
  })

  it('does not insert DB row if createSignedUploadUrl fails', async () => {
    const insertMock = vi.fn().mockResolvedValue({ data: null, error: null })
    const noCapEvent = { ...baseEvent, shot_cap: null }

    mockFrom.mockImplementation((table: string) => {
      if (table === 'events') {
        return { select: () => ({ eq: () => ({ single: () => Promise.resolve({ data: noCapEvent, error: null }) }) }) }
      }
      if (table === 'photos') {
        return {
          select: () => ({ eq: () => ({ eq: () => Promise.resolve({ count: 0, error: null }) }) }),
          insert: insertMock,
        }
      }
    })

    // Make signed URL generation fail
    mockCreateSignedUploadUrl.mockResolvedValue({ data: null, error: { message: 'storage error' } })

    const req = jsonRequest('http://localhost/api/events/test-slug/upload-url', validBody)
    const res = await postUploadUrl(req, { params: Promise.resolve({ slug: 'test-slug' }) })
    expect(res.status).toBe(500)
    expect(insertMock).not.toHaveBeenCalled()
  })
})
