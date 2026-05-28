import { describe, it, expect, vi, beforeEach, afterEach, type Mock } from 'vitest'

// Re-import strategy: vi.resetModules() in beforeEach so each test gets a fresh
// module state with whatever RESEND_API_KEY env is set at that point.

// mockSend is shared so the class field initializer can close over it
let mockSend: Mock

describe('resend helpers', () => {
  beforeEach(() => {
    vi.resetModules()
    mockSend = vi.fn().mockResolvedValue({ data: { id: 'email-1' }, error: null })
  })

  afterEach(() => {
    delete process.env.RESEND_API_KEY
    delete process.env.RESEND_FROM
  })

  describe('sendHostClosureEmail', () => {
    it('returns void and logs warning when RESEND_API_KEY is not set', async () => {
      delete process.env.RESEND_API_KEY
      const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {})

      const { sendHostClosureEmail } = await import('@/lib/resend')
      await expect(
        sendHostClosureEmail('host@test.com', 'Casamento', 'https://app.com/gallery/abc')
      ).resolves.toBeUndefined()

      expect(warnSpy).toHaveBeenCalledWith(expect.stringContaining('RESEND_API_KEY not set'))
      warnSpy.mockRestore()
    })

    it('calls resend.emails.send with correct fields when API key is set', async () => {
      process.env.RESEND_API_KEY = 'test-key'
      // Use a class so `new Resend(...)` works correctly
      vi.doMock('resend', () => ({
        Resend: class {
          emails = { send: mockSend }
        },
      }))

      const { sendHostClosureEmail } = await import('@/lib/resend')
      await sendHostClosureEmail('host@test.com', 'Meu Evento', 'https://app.com/gallery/abc')

      expect(mockSend).toHaveBeenCalledWith(
        expect.objectContaining({
          to: 'host@test.com',
          subject: expect.stringContaining('Meu Evento'),
          html: expect.stringContaining('Meu Evento'),
        })
      )
    })

    it('escapes HTML special chars in eventName to prevent HTML injection', async () => {
      process.env.RESEND_API_KEY = 'test-key'
      vi.doMock('resend', () => ({
        Resend: class {
          emails = { send: mockSend }
        },
      }))

      const { sendHostClosureEmail } = await import('@/lib/resend')
      await sendHostClosureEmail(
        'host@test.com',
        '<script>alert("xss")</script>',
        'https://app.com/gallery/abc'
      )

      const call = mockSend.mock.calls[0][0]
      expect(call.html).not.toContain('<script>')
      expect(call.html).toContain('&lt;script&gt;')
    })
  })

  describe('sendHostNpsEmail', () => {
    it('returns void and logs warning when RESEND_API_KEY is not set', async () => {
      delete process.env.RESEND_API_KEY
      const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {})

      const { sendHostNpsEmail } = await import('@/lib/resend')
      await expect(
        sendHostNpsEmail('host@test.com', 'Casamento')
      ).resolves.toBeUndefined()

      expect(warnSpy).toHaveBeenCalledWith(expect.stringContaining('RESEND_API_KEY not set'))
      warnSpy.mockRestore()
    })

    it('escapes HTML special chars in eventName', async () => {
      process.env.RESEND_API_KEY = 'test-key'
      vi.doMock('resend', () => ({
        Resend: class {
          emails = { send: mockSend }
        },
      }))

      const { sendHostNpsEmail } = await import('@/lib/resend')
      await sendHostNpsEmail('host@test.com', '"Evento" & <Festa>')

      const call = mockSend.mock.calls[0][0]
      expect(call.html).not.toContain('<Festa>')
      expect(call.html).toContain('&lt;Festa&gt;')
      expect(call.html).toContain('&amp;')
      expect(call.html).toContain('&quot;')
    })
  })
})
