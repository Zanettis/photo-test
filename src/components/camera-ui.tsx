'use client'
import { useEffect, useRef, useState, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { nanoid } from 'nanoid'
import { ChevronLeft, QrCode } from 'lucide-react'
import type { Database } from '@/types/database'
import { GuestOnboarding } from './guest-onboarding'

type EventRow = Database['public']['Tables']['events']['Row']

interface Props {
  event: EventRow
  slug: string
  coverImageUrl?: string | null
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

function getTimeLeft(closesAt: string | null, eventDate: string): string {
  const deadline = closesAt ? new Date(closesAt) : new Date(eventDate + 'T23:59:59')
  const diff = deadline.getTime() - Date.now()
  if (diff <= 0) return ''
  const days = Math.floor(diff / 86400000)
  const hours = Math.floor((diff % 86400000) / 3600000)
  const mins = Math.floor((diff % 3600000) / 60000)
  if (days > 0) return `${days}d ${hours}h left`
  if (hours > 0) return `${hours}h ${mins}m left`
  return `${mins}m left`
}

export default function CameraUI({ event, slug, coverImageUrl }: Props) {
  const router = useRouter()
  const inputRef = useRef<HTMLInputElement>(null)
  const videoRef = useRef<HTMLVideoElement>(null)
  const streamRef = useRef<MediaStream | null>(null)
  const [screen, setScreen] = useState<Screen>('camera')
  const [uploaderToken, setUploaderToken] = useState<string | null>(null)
  const [shotsRemaining, setShotsRemaining] = useState<number | null>(null)
  const [shotsTotal, setShotsTotal] = useState(0)
  const [lastPhotoUrl, setLastPhotoUrl] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [countdown, setCountdown] = useState<string | null>(null)
  const [guestEmail, setGuestEmail] = useState('')
  const [emailSaved, setEmailSaved] = useState(false)
  const [cameraReady, setCameraReady] = useState(false)
  const [cameraError, setCameraError] = useState<string | null>(null)
  const [showOnboarding, setShowOnboarding] = useState(false)

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

    if (!localStorage.getItem(`onboarded_${slug}`)) setShowOnboarding(true)
  }, [slug, event.closes_at])

  useEffect(() => {
    if (screen !== 'camera') {
      streamRef.current?.getTracks().forEach(t => t.stop())
      streamRef.current = null
      setCameraReady(false)
      return
    }
    if (!navigator.mediaDevices?.getUserMedia) {
      setCameraError('Câmera não suportada neste browser.')
      return
    }
    navigator.mediaDevices
      .getUserMedia({ video: { facingMode: 'environment' }, audio: false })
      .then(stream => {
        streamRef.current = stream
        if (videoRef.current) videoRef.current.srcObject = stream
        setCameraReady(true)
        setCameraError(null)
      })
      .catch(err => {
        const msg = (err as DOMException).name === 'NotAllowedError'
          ? 'Permissão negada. Use o botão abaixo para selecionar da galeria.'
          : 'Câmera indisponível. Use o botão abaixo para selecionar da galeria.'
        setCameraError(msg)
      })
    return () => {
      streamRef.current?.getTracks().forEach(t => t.stop())
      streamRef.current = null
    }
  }, [screen])

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
    if (cameraReady && videoRef.current) {
      const video = videoRef.current
      const canvas = document.createElement('canvas')
      canvas.width = video.videoWidth
      canvas.height = video.videoHeight
      canvas.getContext('2d')?.drawImage(video, 0, 0)
      canvas.toBlob(blob => {
        if (!blob) return
        const localUrl = URL.createObjectURL(blob)
        setLastPhotoUrl(localUrl)
        handleFileSelected(new File([blob], `photo-${Date.now()}.jpg`, { type: 'image/jpeg' }))
      }, 'image/jpeg', 0.9)
    } else {
      inputRef.current?.click()
    }
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
  const timeLeft = getTimeLeft(event.closes_at ?? null, event.event_date)

  return (
    <div className="h-dvh bg-black flex flex-col relative">
      {showOnboarding && (
        <GuestOnboarding
          eventName={event.name}
          slug={slug}
          revealAt={event.reveal_at ?? null}
          coverImageUrl={coverImageUrl ?? null}
          onComplete={() => setShowOnboarding(false)}
        />
      )}
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

      {/* Header */}
      <div className="flex items-center justify-between px-4 h-16 shrink-0">
        <button
          onClick={() => router.back()}
          className="w-10 h-10 bg-zinc-800/80 backdrop-blur-sm rounded-xl flex items-center justify-center"
          aria-label="Voltar"
        >
          <ChevronLeft size={20} className="text-white" />
        </button>
        <div className="flex flex-col items-center">
          <span className="text-white font-semibold text-sm truncate max-w-[180px]">{event.name}</span>
          {timeLeft && <span className="text-zinc-400 text-xs mt-0.5">{timeLeft}</span>}
        </div>
        <Link
          href={`/events/${slug}/share`}
          className="w-10 h-10 bg-zinc-800/80 backdrop-blur-sm rounded-xl flex items-center justify-center"
          aria-label="QR Code"
        >
          <QrCode size={16} className="text-white" />
        </Link>
      </div>

      {/* Viewfinder */}
      <div className="flex-1 mx-4 my-2 relative rounded-[32px] overflow-hidden bg-zinc-950">
        <video
          ref={videoRef}
          autoPlay
          playsInline
          muted
          className="absolute inset-0 w-full h-full object-cover"
        />
        {isUploading && (
          <div className="absolute inset-0 flex items-center justify-center bg-black/50">
            <div className="w-10 h-10 border-2 border-zinc-600 border-t-white rounded-full animate-spin" />
          </div>
        )}
        {cameraError && (
          <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 p-6">
            <p className="text-zinc-400 text-sm text-center">{cameraError}</p>
            <button
              onClick={() => inputRef.current?.click()}
              className="text-white text-sm underline"
            >
              Selecionar da galeria
            </button>
          </div>
        )}
        {error && (
          <div className="absolute bottom-4 left-4 right-4">
            <p className="text-red-400 text-xs text-center bg-black/70 rounded-xl px-3 py-2">{error}</p>
          </div>
        )}
      </div>

      {/* Bottom controls */}
      <div className="h-28 flex items-center justify-around px-8 shrink-0">
        {/* Shot counter — fotos restantes, estilo rolo de filme */}
        {(() => {
          const displayRemaining = shotsRemaining ?? event.shot_cap
          if (displayRemaining === null) return <div className="w-[80px]" />
          return (
            <div className="bg-zinc-900/80 backdrop-blur-sm rounded-full px-4 py-2 flex items-center gap-2 min-w-[80px] justify-center">
              {displayRemaining < (event.shot_cap ?? displayRemaining + 1) && (
                <span className="text-zinc-600 text-lg font-bold">{displayRemaining + 1}</span>
              )}
              <span className="text-white text-2xl font-bold">{displayRemaining}</span>
              {displayRemaining > 0 && (
                <span className="text-zinc-600 text-lg font-bold">{displayRemaining - 1}</span>
              )}
            </div>
          )
        })()}

        {/* Shutter button */}
        <button
          onClick={handleShutterClick}
          disabled={isUploading}
          aria-label="Tirar foto"
          className={[
            'w-20 h-20 rounded-full',
            'bg-zinc-700 ring-4 ring-zinc-600',
            'shadow-[inset_0_2px_4px_rgba(255,255,255,0.12)]',
            'transition-transform active:scale-90',
            isUploading ? 'opacity-50 cursor-not-allowed' : '',
          ].join(' ')}
        />

        {/* Thumbnail — última foto ou capa, link para galeria */}
        <Link
          href={`/e/${slug}/gallery`}
          className="w-16 h-16 rounded-2xl overflow-hidden bg-zinc-800/80 border border-zinc-700/50 shrink-0"
          aria-label="Ver galeria do evento"
        >
          {(lastPhotoUrl ?? coverImageUrl) && (
            <img
              src={lastPhotoUrl ?? coverImageUrl ?? ''}
              alt="Galeria"
              className="w-full h-full object-cover"
            />
          )}
        </Link>
      </div>
    </div>
  )
}
