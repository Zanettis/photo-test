'use client'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import CameraUI from '@/components/camera-ui'
import type { Database } from '@/types/database'

global.fetch = vi.fn()

vi.mock('nanoid', () => ({ nanoid: () => 'test-token-1' }))

type EventRow = Database['public']['Tables']['events']['Row']

function makeEvent(overrides?: Partial<EventRow>): EventRow {
  return {
    id: 'evt-1',
    host_id: 'host-1',
    slug: 'test-slug',
    name: 'Casamento Silva',
    event_date: '2026-06-01',
    shot_cap: null,
    closes_at: null,
    reveal_at: null,
    reveal_notified_at: null,
    settings: {},
    created_at: new Date().toISOString(),
    ...overrides,
  }
}

function simulateFileSelection(file: File) {
  const input = document.querySelector('input[type="file"]') as HTMLInputElement
  Object.defineProperty(input, 'files', { value: [file], configurable: true })
  fireEvent.change(input)
}

function makeJpegFile(sizeBytes = 1024): File {
  const content = 'x'.repeat(sizeBytes)
  return new File([content], 'photo.jpg', { type: 'image/jpeg' })
}

describe('CameraUI', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    localStorage.clear()
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  it('renders shutter button in camera screen', () => {
    render(<CameraUI event={makeEvent()} slug="test-slug" />)
    expect(screen.getByRole('button', { name: /tirar foto/i })).toBeInTheDocument()
  })

  it('shows closed screen when closes_at is in the past', () => {
    render(<CameraUI event={makeEvent({ closes_at: '2020-01-01T00:00:00Z' })} slug="test-slug" />)
    expect(screen.getByText('Este evento foi encerrado')).toBeInTheDocument()
  })

  it('shows error when file type is not JPEG or PNG', async () => {
    render(<CameraUI event={makeEvent()} slug="test-slug" />)
    const gifFile = new File(['gif89a'], 'anim.gif', { type: 'image/gif' })
    simulateFileSelection(gifFile)
    await waitFor(() =>
      expect(screen.getByText('Formato não suportado. Use JPEG ou PNG.')).toBeInTheDocument()
    )
    expect(fetch).not.toHaveBeenCalled()
  })

  it('shows error when file size exceeds 50MB', async () => {
    render(<CameraUI event={makeEvent()} slug="test-slug" />)
    const bigFile = new File(['x'.repeat(100)], 'huge.jpg', { type: 'image/jpeg' })
    Object.defineProperty(bigFile, 'size', { value: 52428801 })
    simulateFileSelection(bigFile)
    await waitFor(() =>
      expect(screen.getByText('Foto muito grande. Máximo 50MB.')).toBeInTheDocument()
    )
    expect(fetch).not.toHaveBeenCalled()
  })

  it('shows shot_cap screen when API returns 429 shot_cap_reached', async () => {
    vi.mocked(fetch).mockResolvedValueOnce({
      ok: false,
      status: 429,
      json: async () => ({ error: 'shot_cap_reached', limit: 5 }),
    } as Response)
    render(<CameraUI event={makeEvent()} slug="test-slug" />)
    simulateFileSelection(makeJpegFile())
    await waitFor(() =>
      expect(screen.getByText('Suas fotos acabaram')).toBeInTheDocument()
    )
  })

  it('shows "Conexão lenta" error when fetch times out (AbortError)', async () => {
    vi.mocked(fetch).mockRejectedValueOnce(
      Object.assign(new Error('aborted'), { name: 'AbortError' })
    )
    render(<CameraUI event={makeEvent()} slug="test-slug" />)
    simulateFileSelection(makeJpegFile())
    await waitFor(() =>
      expect(screen.getByText('Conexão lenta. Tente novamente.')).toBeInTheDocument()
    )
    expect(screen.getByRole('button', { name: /tirar foto/i })).toBeInTheDocument()
  })

  it('shows uploading state during upload, then returns to camera on success', async () => {
    vi.mocked(fetch).mockResolvedValueOnce({
      ok: true,
      status: 200,
      json: async () => ({ upload_url: 'https://storage/upload', photo_id: 'p2', shots_remaining: 3 }),
    } as Response)
    vi.mocked(fetch).mockResolvedValueOnce({ ok: true } as Response)

    render(<CameraUI event={makeEvent()} slug="test-slug" />)
    simulateFileSelection(makeJpegFile())

    // Flash takes 800ms; waitFor with 2s timeout will catch the post-flash state
    await waitFor(
      () => expect(screen.getByRole('button', { name: /tirar foto/i })).not.toBeDisabled(),
      { timeout: 2000 }
    )
    expect(screen.queryByText('Enviando...')).not.toBeInTheDocument()
  })

  it('shows shot_cap screen after upload when shots_remaining === 0', async () => {
    vi.mocked(fetch).mockResolvedValueOnce({
      ok: true,
      status: 200,
      json: async () => ({ upload_url: 'https://storage/upload', photo_id: 'p1', shots_remaining: 0 }),
    } as Response)
    vi.mocked(fetch).mockResolvedValueOnce({ ok: true } as Response)

    render(<CameraUI event={makeEvent()} slug="test-slug" />)
    simulateFileSelection(makeJpegFile())

    // Flash (800ms) then transitions to shot_cap; 2s timeout catches it
    await waitFor(
      () => expect(screen.getByText('Suas fotos acabaram')).toBeInTheDocument(),
      { timeout: 2000 }
    )
  })
})
