import { describe, it, expect, vi, beforeEach, type Mock } from 'vitest'

vi.mock('@/lib/supabase', () => ({
  createServerSupabaseClient: vi.fn(),
  createServiceClient: vi.fn(),
}))

vi.mock('next/headers', () => ({
  cookies: vi.fn().mockResolvedValue({ getAll: () => [], set: () => {} }),
}))

vi.mock('@/lib/resend', () => ({
  sendHostClosureEmail: vi.fn().mockResolvedValue(undefined),
  sendHostNpsEmail: vi.fn().mockResolvedValue(undefined),
}))

import { createServerSupabaseClient, createServiceClient } from '@/lib/supabase'
import { sendHostClosureEmail, sendHostNpsEmail } from '@/lib/resend'
import { GET } from '@/app/api/events/route'

const FAKE_USER = { id: 'user-123', email: 'host@test.com' }

// Use clearly past dates so no fake timers are needed
const CLOSED_EVENT = {
  id: 'event-1',
  slug: 'closed-event',
  name: 'Casamento',
  event_date: '2020-01-01',              // well in the past → NPS 48h check passes
  closes_at: '2020-01-31T00:00:00.000Z', // in the past → closure check passes
  closes_notified_at: null,
  nps_notified_at: null,
  shot_cap: null,
  reveal_at: null,
  created_at: '2020-01-01T00:00:00.000Z',
  photos: [{ count: 5 }],
}

// Returns a service-client mock where UPDATE.select() resolves with configurable rows
function makeServiceClientMock(opts: {
  closureUpdateRows?: object[]
  npsUpdateRows?: object[]
} = {}) {
  const { closureUpdateRows = [{ id: 'event-1' }], npsUpdateRows = [{ id: 'event-1' }] } = opts
  let callCount = 0
  return {
    from: vi.fn().mockImplementation((table: string) => {
      if (table !== 'events') throw new Error(`Unexpected table in serviceClient: ${table}`)
      callCount++
      const rows = callCount === 1 ? closureUpdateRows : npsUpdateRows
      return {
        update: vi.fn().mockReturnThis(),
        eq: vi.fn().mockReturnThis(),
        is: vi.fn().mockReturnThis(),
        select: vi.fn().mockResolvedValue({ data: rows, error: null }),
      }
    }),
  }
}

// Builds the user-context Supabase mock (events list + host email lookup)
function makeSupabaseMock(auth: Mock, events: object[]) {
  return {
    auth: { getUser: auth },
    from: vi.fn().mockImplementation((table: string) => {
      if (table === 'events') {
        return {
          select: vi.fn().mockReturnThis(),
          eq: vi.fn().mockReturnThis(),
          order: vi.fn().mockResolvedValue({ data: events }),
        }
      }
      if (table === 'hosts') {
        return {
          select: vi.fn().mockReturnThis(),
          eq: vi.fn().mockReturnThis(),
          single: vi.fn().mockResolvedValue({ data: { email: FAKE_USER.email } }),
        }
      }
      throw new Error(`Unexpected table in supabase: ${table}`)
    }),
  }
}

// Flush the void async IIFE inside GET without fake timers
async function flush() {
  await new Promise(resolve => setImmediate(resolve))
  await new Promise(resolve => setImmediate(resolve))
}

describe('GET /api/events — email trigger', () => {
  let mockAuth: Mock

  beforeEach(() => {
    vi.clearAllMocks()
    mockAuth = vi.fn().mockResolvedValue({ data: { user: FAKE_USER } })
    vi.mocked(createServiceClient).mockReturnValue(makeServiceClientMock() as any)
  })

  it('sends closure email when event is closed and closes_notified_at is null', async () => {
    vi.mocked(createServerSupabaseClient).mockResolvedValue(
      makeSupabaseMock(mockAuth, [CLOSED_EVENT]) as any
    )

    await GET()
    await flush()

    expect(sendHostClosureEmail).toHaveBeenCalledWith(
      FAKE_USER.email,
      CLOSED_EVENT.name,
      expect.stringContaining(CLOSED_EVENT.slug)
    )
  })

  it('does NOT send closure email when closes_notified_at is already set (idempotency)', async () => {
    const alreadyNotified = { ...CLOSED_EVENT, closes_notified_at: '2020-01-31T01:00:00.000Z' }
    vi.mocked(createServerSupabaseClient).mockResolvedValue(
      makeSupabaseMock(mockAuth, [alreadyNotified]) as any
    )

    await GET()
    await flush()

    expect(sendHostClosureEmail).not.toHaveBeenCalled()
  })

  it('does NOT send closure email when UPDATE claims 0 rows (race condition guard)', async () => {
    vi.mocked(createServiceClient).mockReturnValue(
      makeServiceClientMock({ closureUpdateRows: [], npsUpdateRows: [] }) as any
    )
    vi.mocked(createServerSupabaseClient).mockResolvedValue(
      makeSupabaseMock(mockAuth, [CLOSED_EVENT]) as any
    )

    await GET()
    await flush()

    expect(sendHostClosureEmail).not.toHaveBeenCalled()
  })

  it('sends NPS email when event_date + 48h has passed and nps_notified_at is null', async () => {
    const eventForNps = {
      ...CLOSED_EVENT,
      closes_notified_at: '2020-01-31T01:00:00.000Z',
      nps_notified_at: null,
    }
    vi.mocked(createServerSupabaseClient).mockResolvedValue(
      makeSupabaseMock(mockAuth, [eventForNps]) as any
    )

    await GET()
    await flush()

    expect(sendHostNpsEmail).toHaveBeenCalledWith(FAKE_USER.email, eventForNps.name)
  })

  it('does NOT send NPS email when nps_notified_at is already set', async () => {
    const alreadyNps = {
      ...CLOSED_EVENT,
      closes_notified_at: '2020-01-31T01:00:00.000Z',
      nps_notified_at: '2020-01-03T12:00:00.000Z',
    }
    vi.mocked(createServerSupabaseClient).mockResolvedValue(
      makeSupabaseMock(mockAuth, [alreadyNps]) as any
    )

    await GET()
    await flush()

    expect(sendHostNpsEmail).not.toHaveBeenCalled()
  })
})
