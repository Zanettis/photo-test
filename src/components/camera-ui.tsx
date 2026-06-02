'use client'
import { useEffect, useRef, useState, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { ChevronLeft, QrCode } from 'lucide-react'
import type { Database } from '@/types/database'
import { GuestOnboarding } from './guest-onboarding'
import { useCamera } from '@/hooks/use-camera'
import { useUpload } from '@/hooks/use-upload'

type EventRow = Database['public']['Tables']['events']['Row']

interface Props {
  event: EventRow
  slug: string
  coverImageUrl?: string | null
}

type Screen = 'camera' | 'uploading' | 'flash' | 'shot_cap' | 'closed'

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
  const [screen, setScreen] = useState<Screen>('camera')
  const [lastPhotoUrl, setLastPhotoUrl] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [showOnboarding, setShowOnboarding] = useState(false)

  const { videoRef, cameraReady, cameraError } = useCamera(screen)
  const { shotsRemaining, upload } = useUpload(slug)

  useEffect(() => {
    const isOpen = !event.closes_at || new Date(event.closes_at) > new Date()
    if (!isOpen) { setScreen('closed'); return }

    if (!localStorage.getItem(`onboarded_${slug}`)) setShowOnboarding(true)
  }, [slug, event.closes_at])

  const handleFileSelected = useCallback(async (file: File) => {
    setScreen('uploading')
    setError(null)
    const result = await upload(file)
    if (result.status === 'success') {
      setScreen('flash')
      setTimeout(() => setScreen(result.shotsRemaining === 0 ? 'shot_cap' : 'camera'), 220)
    } else if (result.status === 'shot_cap') {
      setScreen('shot_cap')
    } else {
      setError(result.message)
      setScreen('camera')
    }
  }, [upload])

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
        setLastPhotoUrl(URL.createObjectURL(blob))
        handleFileSelected(new File([blob], `photo-${Date.now()}.jpg`, { type: 'image/jpeg' }))
      }, 'image/jpeg', 0.9)
    } else {
      inputRef.current?.click()
    }
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
        <div className="fixed inset-0 pointer-events-none z-50" style={{ animation: 'camera-flash 220ms ease-out forwards' }} />
      )}
      <input ref={inputRef} type="file" accept="image/jpeg,image/png" capture="environment" className="hidden" onChange={handleInputChange} />

      {/* Header */}
      <div className="flex items-center justify-between px-4 h-16 shrink-0">
        <button onClick={() => router.back()} className="w-10 h-10 bg-zinc-800/80 backdrop-blur-sm rounded-xl flex items-center justify-center" aria-label="Voltar">
          <ChevronLeft size={20} className="text-white" />
        </button>
        <div className="flex flex-col items-center">
          <span className="text-white font-semibold text-sm truncate max-w-[180px]">{event.name}</span>
          {timeLeft && <span className="text-zinc-400 text-xs mt-0.5">{timeLeft}</span>}
        </div>
        <Link href={`/events/${slug}/share`} className="w-10 h-10 bg-zinc-800/80 backdrop-blur-sm rounded-xl flex items-center justify-center" aria-label="QR Code">
          <QrCode size={16} className="text-white" />
        </Link>
      </div>

      {/* Viewfinder */}
      <div className="flex-1 mx-4 my-2 relative rounded-[32px] overflow-hidden bg-zinc-950">
        <video ref={videoRef} autoPlay playsInline muted className="absolute inset-0 w-full h-full object-cover" />
        {isUploading && (
          <div className="absolute inset-0 flex items-center justify-center bg-black/50">
            <div className="w-10 h-10 border-2 border-zinc-600 border-t-white rounded-full animate-spin" />
          </div>
        )}
        {cameraError && (
          <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 p-6">
            <p className="text-zinc-400 text-sm text-center">{cameraError}</p>
            <button onClick={() => inputRef.current?.click()} className="text-white text-sm underline">Selecionar da galeria</button>
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
        {(() => {
          const displayRemaining = shotsRemaining ?? event.shot_cap
          if (displayRemaining === null) return <div className="w-[80px]" />
          return (
            <div className="bg-zinc-900/80 backdrop-blur-sm rounded-full px-4 py-2 flex items-center gap-2 min-w-[80px] justify-center">
              {displayRemaining < (event.shot_cap ?? displayRemaining + 1) && (
                <span className="text-zinc-600 text-lg font-bold">{displayRemaining + 1}</span>
              )}
              <span key={displayRemaining} className="text-white text-2xl font-bold" style={{ animation: 'number-slide-in 200ms ease-out' }}>{displayRemaining}</span>
              {displayRemaining > 0 && <span className="text-zinc-600 text-lg font-bold">{displayRemaining - 1}</span>}
            </div>
          )
        })()}

        <button
          onClick={handleShutterClick}
          disabled={isUploading}
          aria-label="Tirar foto"
          className={['w-20 h-20 rounded-full', 'bg-zinc-700 ring-4 ring-zinc-600', 'shadow-[inset_0_2px_4px_rgba(255,255,255,0.12)]', 'transition-transform active:scale-90', isUploading ? 'opacity-50 cursor-not-allowed' : ''].join(' ')}
        />

        <Link href={`/e/${slug}/gallery`} className="w-16 h-16 rounded-2xl overflow-hidden bg-zinc-800/80 border border-zinc-700/50 shrink-0" aria-label="Ver galeria do evento">
          {(lastPhotoUrl ?? coverImageUrl) && (
            <img key={lastPhotoUrl ?? coverImageUrl ?? 'empty'} src={lastPhotoUrl ?? coverImageUrl ?? ''} alt="Galeria" className="w-full h-full object-cover" style={{ animation: 'photo-fade-in 300ms ease-out' }} />
          )}
        </Link>
      </div>
    </div>
  )
}
