import { describe, it, expect, vi, beforeEach, type Mock } from 'vitest'
import { NextRequest } from 'next/server'

vi.mock('@/lib/supabase', () => ({
  createServerSupabaseClient: vi.fn(),
  createServiceClient: vi.fn(),
}))

vi.mock('next/headers', () => ({
  cookies: vi.fn().mockResolvedValue({ getAll: () => [], set: () => {} }),
}))

import { createServerSupabaseClient, createServiceClient } from '@/lib/supabase'
import { GET } from '@/app/api/events/[slug]/download-zip/route'

// --- Constants ---
const FAKE_USER = { id: 'user-host-1' }
const FAKE_EVENT = { id: 'event-uuid-1', name: 'Casamento 2026', host_id: 'user-host-1' }
const FAKE_PHOTOS = [
  { id: 'p1', storage_path: 'events/s1/p1.jpg', mime_type: 'image/jpeg', uploaded_at: '2026-06-01T10:00:00Z' },
  { id: 'p2', storage_path: 'events/s1/p2.png', mime_type: 'image/png', uploaded_at: '2026-06-01T10:01:00Z' },
]

function makeRequest(slug = 'casamento-2026') {
  return new NextRequest(`http://localhost/api/events/${slug}/download-zip`)
}

describe('GET /api/events/[slug]/download-zip', () => {
  let mockServerClient: any
  let mockServiceClient: any

  beforeEach(() => {
    vi.clearAllMocks()

    mockServerClient = {
      auth: { getUser: vi.fn().mockResolvedValue({ data: { user: FAKE_USER } }) },
      from: vi.fn().mockReturnValue({
        select: vi.fn().mockReturnThis(),
        eq: vi.fn().mockReturnThis(),
        single: vi.fn().mockResolvedValue({ data: FAKE_EVENT }),
      }),
    }
    ;(createServerSupabaseClient as Mock).mockResolvedValue(mockServerClient)

    mockServiceClient = {
      from: vi.fn().mockReturnValue({
        select: vi.fn().mockReturnThis(),
        eq: vi.fn().mockReturnThis(),
        order: vi.fn().mockResolvedValue({ data: FAKE_PHOTOS, error: null }),
      }),
      storage: {
        from: vi.fn().mockReturnValue({
          download: vi.fn().mockResolvedValue({
            data: new Blob(['fake-image-bytes']),
            error: null,
          }),
        }),
      },
    }
    ;(createServiceClient as Mock).mockReturnValue(mockServiceClient)
  })

  it('returns 401 when user is not authenticated', async () => {
    mockServerClient.auth.getUser.mockResolvedValue({ data: { user: null } })
    const res = await GET(makeRequest(), { params: Promise.resolve({ slug: 'casamento-2026' }) })
    expect(res.status).toBe(401)
    expect(await res.json()).toEqual({ error: 'Unauthorized' })
  })

  it('returns 404 when event slug does not exist', async () => {
    mockServerClient.from.mockReturnValue({
      select: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
      single: vi.fn().mockResolvedValue({ data: null }),
    })
    const res = await GET(makeRequest(), { params: Promise.resolve({ slug: 'not-found' }) })
    expect(res.status).toBe(404)
  })

  it('returns 403 when authenticated user is not the event host', async () => {
    mockServerClient.from.mockReturnValue({
      select: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
      single: vi.fn().mockResolvedValue({ data: { ...FAKE_EVENT, host_id: 'other-user' } }),
    })
    const res = await GET(makeRequest(), { params: Promise.resolve({ slug: 'casamento-2026' }) })
    expect(res.status).toBe(403)
  })

  it('returns 500 when photos DB query fails', async () => {
    mockServiceClient.from.mockReturnValue({
      select: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
      order: vi.fn().mockResolvedValue({ data: null, error: { message: 'db error' } }),
    })
    const res = await GET(makeRequest(), { params: Promise.resolve({ slug: 'casamento-2026' }) })
    expect(res.status).toBe(500)
    expect(await res.json()).toEqual({ error: 'query_failed' })
  })

  it('returns 200 with ZIP headers for valid host', async () => {
    // archiver runs for real — test only verifies response headers, not body
    const res = await GET(makeRequest(), { params: Promise.resolve({ slug: 'casamento-2026' }) })
    expect(res.status).toBe(200)
    expect(res.headers.get('Content-Type')).toBe('application/zip')
    const disposition = res.headers.get('Content-Disposition') ?? ''
    expect(disposition).toContain('attachment')
    expect(disposition).toContain('.zip')
  })

  it('returns 200 for event with no photos and filename contains event name', async () => {
    mockServiceClient.from.mockReturnValue({
      select: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
      order: vi.fn().mockResolvedValue({ data: [], error: null }),
    })
    const res = await GET(makeRequest(), { params: Promise.resolve({ slug: 'casamento-2026' }) })
    expect(res.status).toBe(200)
    const disposition = res.headers.get('Content-Disposition') ?? ''
    expect(disposition).toContain('Casamento-2026.zip')
  })
})
