'use client'
import { useState, useRef, useEffect, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import { ArrowLeft, QrCode } from 'lucide-react'
import Link from 'next/link'

export default function JoinPage() {
  const router = useRouter()
  const videoRef = useRef<HTMLVideoElement>(null)
  const [linkInput, setLinkInput] = useState('')
  const [error, setError] = useState('')
  const [scanning, setScanning] = useState(false)
  const [cameraError, setCameraError] = useState(false)
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const detectorRef = useRef<any>(null)
  const rafRef = useRef<number>(0)

  function extractSlug(raw: string): string | null {
    try {
      const url = new URL(raw.startsWith('http') ? raw : 'https://' + raw)
      const match = url.pathname.match(/^\/e\/([^/]+)/)
      if (match) return match[1]
    } catch { /* not a URL */ }
    const bare = raw.trim().replace(/^\/e\//, '')
    if (/^[a-z0-9-]{4,}$/i.test(bare)) return bare
    return null
  }

  function handleManualJoin() {
    const slug = extractSlug(linkInput)
    if (!slug) { setError('Link inválido. Cole o link completo do evento.'); return }
    router.push(`/e/${slug}`)
  }

  const scanFrame = useCallback(async () => {
    const detector = detectorRef.current
    const video = videoRef.current
    if (!detector || !video || video.readyState < 2) {
      rafRef.current = requestAnimationFrame(scanFrame)
      return
    }
    try {
      const results = await detector.detect(video)
      if (results.length > 0) {
        const slug = extractSlug(results[0].rawValue)
        if (slug) {
          cancelAnimationFrame(rafRef.current)
          router.push(`/e/${slug}`)
          return
        }
      }
    } catch { /* continue scanning */ }
    rafRef.current = requestAnimationFrame(scanFrame)
  }, [router])

  useEffect(() => {
    if (typeof window === 'undefined') return
    if (!('BarcodeDetector' in window)) { setCameraError(true); return }

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    detectorRef.current = new (window as any).BarcodeDetector({ formats: ['qr_code'] })

    navigator.mediaDevices.getUserMedia({ video: { facingMode: 'environment' } })
      .then(stream => {
        if (videoRef.current) {
          videoRef.current.srcObject = stream
          videoRef.current.play()
          setScanning(true)
          rafRef.current = requestAnimationFrame(scanFrame)
        }
      })
      .catch(() => setCameraError(true))

    return () => {
      cancelAnimationFrame(rafRef.current)
      if (videoRef.current?.srcObject) {
        (videoRef.current.srcObject as MediaStream).getTracks().forEach(t => t.stop())
      }
    }
  }, [scanFrame])

  return (
    <div className="min-h-screen bg-[#0a0a0a] flex flex-col">
      <div className="flex items-center gap-4 px-4 pt-10 pb-4">
        <Link href="/dashboard" className="w-10 h-10 rounded-xl bg-zinc-800 flex items-center justify-center">
          <ArrowLeft size={18} className="text-white" />
        </Link>
        <h1 className="text-white font-bold text-lg">Entrar em um evento</h1>
      </div>

      <div className="flex-1 flex flex-col px-6 gap-6">
        {/* Camera scanner */}
        {!cameraError ? (
          <div className="relative w-full aspect-square rounded-3xl overflow-hidden bg-zinc-900">
            <video ref={videoRef} className="absolute inset-0 w-full h-full object-cover" muted playsInline />
            <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
              <div className="w-48 h-48 rounded-2xl border-2 border-white/50" />
            </div>
            {!scanning && (
              <div className="absolute inset-0 flex flex-col items-center justify-center gap-2">
                <QrCode size={32} className="text-zinc-500" />
                <p className="text-zinc-500 text-sm">Aguardando câmera…</p>
              </div>
            )}
          </div>
        ) : (
          <div className="w-full aspect-square rounded-3xl bg-zinc-900 flex flex-col items-center justify-center gap-3">
            <QrCode size={36} className="text-zinc-600" />
            <p className="text-zinc-500 text-sm text-center px-4">
              Câmera ou scanner não disponível nesse dispositivo.
            </p>
          </div>
        )}

        {/* Manual link input */}
        <div>
          <p className="text-zinc-500 text-xs uppercase tracking-widest mb-3">Ou cole o link aqui</p>
          <div className="flex gap-2">
            <input
              type="url"
              inputMode="url"
              value={linkInput}
              onChange={e => { setLinkInput(e.target.value); setError('') }}
              onKeyDown={e => e.key === 'Enter' && handleManualJoin()}
              placeholder="https://app.com/e/abc123"
              className="flex-1 px-4 py-3 bg-zinc-900 border border-zinc-700 rounded-2xl text-white text-sm placeholder-zinc-600 focus:outline-none focus:border-zinc-500"
            />
            <button
              onClick={handleManualJoin}
              disabled={!linkInput.trim()}
              className="px-5 py-3 bg-white text-black text-sm font-semibold rounded-2xl disabled:opacity-30"
            >
              Entrar
            </button>
          </div>
          {error && <p className="text-red-400 text-sm mt-2">{error}</p>}
        </div>
      </div>
    </div>
  )
}
