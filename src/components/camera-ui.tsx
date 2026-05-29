'use client'
import { useEffect, useRef, useState, useCallback } from 'react'
import { nanoid } from 'nanoid'
import type { Database } from '@/types/database'

type EventRow = Database['public']['Tables']['events']['Row']

interface Props {
  event: EventRow
  slug: string
}

type Screen = 'camera' | 'uploading' | 'flash' | 'shot_cap' | 'closed' | 'countdown'

function sleep(ms: number) { return new Promise(r => setTimeout(r, ms)) }

function formatCountdown(target: Date): string {
  const diff = Math.max(0, target.getTime() - Date.now())
  const h = Math.floor(diff / 3600000)
  const m = Math.floor((diff % 3600000) / 60000)
  const s = Math.floor((diff % 60000) / 1000)
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`
}

export default function CameraUI({ event, slug }: Props) {
  const inputRef = useRef<HTMLInputElement>(null)
  const [screen, setScreen] = useState<Screen>('camera')
  const [uploaderToken, setUploaderToken] = useState<string | null>(null)
  const [shotsRemaining, setShotsRemaining] = useState<number | null>(null)
  const [shotsTotal, setShotsTotal] = useState(0)
  const [error, setError] = useState<string | null>(null)
  const [countdown, setCountdown] = useState<string | null>(null)
  const [guestEmail, setGuestEmail] = useState('')
  const [emailSaved, setEmailSaved] = useState(false)

  useEffect(() => {
    const TOKEN_KEY = `uploader_token_${slug}`
    let token = localStorage.getItem(TOKEN_KEY)
    if (!token) { token = nanoid(8); localStorage.setItem(TOKEN_KEY, token) }
    setUploaderToken(token)

    const EMAIL_KEY = `reveal_email_${slug}`
    const savedEmail = localStorage.getItem(EMAIL_KEY)
    if (savedEmail) setEmailSaved(true)

    const isOpen = !event.closes_at || new Date(event.closes_at) > new Date()
    if (!isOpen) { setScreen('closed'); return }
  }, [slug, event.closes_at])

  useEffect(() => {
    if (!event.reveal_at) return
    const target = new Date(event.reveal_at)
    if (target <= new Date()) return

    setCountdown(formatCountdown(target))
    const id = setInterval(() => {
      const now = new Date()
      if (target <= now) { setCountdown(null); clearInterval(id); return }
      setCountdown(formatCountdown(target))
    }, 1000)
    return () => clearInterval(id)
  }, [event.reveal_at])

  const handleFileSelected = useCallback(async (file: File) => {
    if (!['image/jpeg', 'image/png'].includes(file.type)) {
      setError('Formato não suportado. Use JPEG ou PNG.')
      return
    }
    if (file.size > 52428800) {
      setError('Foto muito grande. Máximo 50MB.')
      return
    }

    setScreen('uploading')
    setError(null)

    // Step 1: obtain presigned URL (single attempt — retrying this would create duplicate DB rows)
    let upload_url: string
    let shots_remaining: number | null

    const controller = new AbortController()
    const timeoutId = setTimeout(() => controller.abort(), 15000)
    try {
      const res = await fetch(`/api/events/${slug}/upload-url`, {
        method: 'POST',
        signal: controller.signal,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          uploader_token: uploaderToken,
          file_name: file.name,
          mime_type: file.type,
          file_size_bytes: file.size,
          guest_email: localStorage.getItem(`reveal_email_${slug}`) ?? undefined,
        }),
      })

      if (res.status === 429) {
        const body = await res.json()
        if (body.error === 'shot_cap_reached') { setScreen('shot_cap'); return }
        setError('Muitas fotos enviadas. Tente mais tarde.')
        setScreen('camera')
        return
      }

      if (!res.ok) {
        const body = await res.json().catch(() => ({}))
        setError(body.error ?? 'Falha no envio. Tente novamente.')
        setScreen('camera')
        return
      }

      const data = await res.json()
      upload_url = data.upload_url
      shots_remaining = data.shots_remaining ?? null
    } catch (err) {
      if (err instanceof Error && err.name === 'AbortError') {
        setError('Conexão lenta. Tente novamente.')
        setScreen('camera')
        return
      }
      setError('Sem conexão. Tente novamente.')
      setScreen('camera')
      return
    } finally {
      clearTimeout(timeoutId)
    }

    // Step 2: upload to storage with exponential backoff retries
    const retryDelays = [1000, 3000, 7000]
    for (let attempt = 0; attempt < 3; attempt++) {
      if (attempt > 0) await sleep(retryDelays[attempt - 1])

      try {
        const uploadRes = await fetch(upload_url, {
          method: 'PUT',
          headers: { 'Content-Type': file.type },
          body: file,
        })

        if (uploadRes.ok) {
          setShotsRemaining(shots_remaining)
          setShotsTotal(prev => prev + 1)
          setScreen('flash')
          // After flash animation: go to shot_cap if no shots left, otherwise back to camera
          setTimeout(() => setScreen(shots_remaining === 0 ? 'shot_cap' : 'camera'), 800)
          return
        }

        if (attempt === 2) {
          setError('Falha no envio. Tente novamente.')
          setScreen('camera')
        }
      } catch {
        if (attempt === 2) {
          setError('Sem conexão. Tente novamente.')
          setScreen('camera')
        }
      }
    }
  }, [slug, uploaderToken])

  function handleShutterClick() {
    if (screen === 'uploading') return
    inputRef.current?.click()
  }

  function handleEmailSubmit(e: React.FormEvent) {
    e.preventDefault()
    const trimmed = guestEmail.trim()
    if (!trimmed) { setEmailSaved(true); return }
    localStorage.setItem(`reveal_email_${slug}`, trimmed)
    setGuestEmail(trimmed)
    setEmailSaved(true)
  }

  function handleInputChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return
    e.target.value = ''
    handleFileSelected(file)
  }

  if (screen === 'closed') {
    return (
      <div className="min-h-screen bg-black flex flex-col items-center justify-center gap-4 p-6 text-center">
        <div className="text-zinc-600 text-8xl">📷</div>
        <h1 className="text-white text-2xl font-bold">Este evento foi encerrado</h1>
        <p className="text-zinc-400">O período de envio de fotos já foi finalizado.</p>
      </div>
    )
  }

  if (screen === 'shot_cap') {
    return (
      <div className="min-h-screen bg-black flex flex-col items-center justify-center gap-4 p-6 text-center">
        <div className="text-zinc-600 text-8xl">📷</div>
        <h1 className="text-white text-2xl font-bold">Suas fotos acabaram</h1>
        <p className="text-zinc-400">Você já enviou todas as suas fotos para este evento.</p>
      </div>
    )
  }

  const isUploading = screen === 'uploading'
  const isFlash = screen === 'flash'

  return (
    <div className="min-h-screen bg-black flex flex-col items-center justify-between p-4">
      {isFlash && (
        <div className="fixed inset-0 bg-white opacity-100 transition-opacity duration-300 pointer-events-none z-50" />
      )}

      <input
        ref={inputRef}
        type="file"
        accept="image/jpeg,image/png"
        capture="environment"
        className="hidden"
        onChange={handleInputChange}
      />

      <div className="w-full max-w-sm pt-4">
        <h1 className="text-white text-lg font-semibold text-center truncate">{event.name}</h1>
        <div className="mt-1 text-center">
          {shotsRemaining !== null ? (
            <span className="font-mono text-zinc-400 text-sm">{shotsRemaining} poses restantes</span>
          ) : shotsTotal > 0 ? (
            <span className="font-mono text-zinc-400 text-sm">{shotsTotal} fotos enviadas</span>
          ) : null}
        </div>
        {countdown && (
          <p className="font-mono text-zinc-500 text-xs text-center mt-1">Revelação em {countdown}</p>
        )}
      </div>

      <div className="relative w-full max-w-sm aspect-[3/4] my-4">
        <div className="absolute inset-0 rounded-lg overflow-hidden bg-zinc-950 border border-zinc-800">
          {isUploading ? (
            <div className="absolute inset-0 flex items-center justify-center">
              <div className="w-10 h-10 border-2 border-zinc-600 border-t-white rounded-full animate-spin" />
            </div>
          ) : null}
        </div>
        <div className="absolute top-2 left-2 w-6 h-6 border-t-2 border-l-2 border-zinc-600 rounded-tl" />
        <div className="absolute top-2 right-2 w-6 h-6 border-t-2 border-r-2 border-zinc-600 rounded-tr" />
        <div className="absolute bottom-2 left-2 w-6 h-6 border-b-2 border-l-2 border-zinc-600 rounded-bl" />
        <div className="absolute bottom-2 right-2 w-6 h-6 border-b-2 border-r-2 border-zinc-600 rounded-br" />
      </div>

      <div className="w-full max-w-sm flex flex-col items-center gap-3 pb-8">
        {error && <p className="text-red-400 text-sm text-center">{error}</p>}
        {isUploading && (
          <p className="text-zinc-400 text-sm font-mono">Enviando...</p>
        )}
        <button
          onClick={handleShutterClick}
          disabled={isUploading}
          aria-label="Tirar foto"
          className={[
            'w-20 h-20 bg-white rounded-full ring-4 ring-zinc-600',
            'transition-transform active:scale-95',
            isUploading ? 'opacity-50 cursor-not-allowed' : 'hover:bg-zinc-100',
          ].join(' ')}
        />
        {event.reveal_at && !emailSaved && new Date(event.reveal_at) > new Date() && (
          <form onSubmit={handleEmailSubmit} className="w-full mt-2">
            <p className="text-zinc-500 text-xs text-center mb-2">Receber aviso quando as fotos forem reveladas?</p>
            <div className="flex gap-2">
              <input
                type="email"
                value={guestEmail}
                onChange={e => setGuestEmail(e.target.value)}
                placeholder="seu@email.com"
                className="flex-1 px-3 py-2 bg-zinc-900 border border-zinc-700 rounded-lg text-white text-sm placeholder-zinc-600 focus:outline-none focus:border-zinc-500"
              />
              <button
                type="submit"
                className="px-3 py-2 bg-zinc-800 text-white text-sm rounded-lg hover:bg-zinc-700 transition-colors"
              >
                Avisar
              </button>
            </div>
            <button
              type="button"
              onClick={() => setEmailSaved(true)}
              className="w-full mt-1 text-zinc-600 text-xs hover:text-zinc-500"
            >
              Não, obrigado
            </button>
          </form>
        )}
      </div>
    </div>
  )
}
