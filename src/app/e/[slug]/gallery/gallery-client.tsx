'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'

interface Photo {
  id: string
  url: string
  tags: string[]
}

interface Props {
  mode: 'countdown' | 'gallery'
  eventName: string
  revealAt: string | null
  photos: Photo[]
}

function formatCountdown(target: Date): string {
  const diff = Math.max(0, target.getTime() - Date.now())
  const d = Math.floor(diff / 86400000)
  const h = Math.floor((diff % 86400000) / 3600000)
  const m = Math.floor((diff % 3600000) / 60000)
  const s = Math.floor((diff % 60000) / 1000)
  if (d > 0) return `${d}d ${String(h).padStart(2, '0')}h ${String(m).padStart(2, '0')}m`
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`
}

export default function GuestGalleryClient({ mode, eventName, revealAt, photos }: Props) {
  const router = useRouter()
  const [countdown, setCountdown] = useState<string | null>(null)

  useEffect(() => {
    if (mode !== 'countdown' || !revealAt) return
    const target = new Date(revealAt)

    function tick() {
      const now = new Date()
      if (target <= now) {
        router.refresh()
        return
      }
      setCountdown(formatCountdown(target))
    }

    tick()
    const id = setInterval(tick, 1000)
    return () => clearInterval(id)
  }, [mode, revealAt, router])

  if (mode === 'countdown') {
    return (
      <div className="min-h-screen bg-black flex flex-col items-center justify-center gap-4 p-6 text-center">
        <h1 className="text-white text-2xl font-bold">{eventName}</h1>
        <p className="text-zinc-400">As fotos serão reveladas em</p>
        <p className="font-mono text-white text-4xl font-bold">{countdown ?? '...'}</p>
        <p className="text-zinc-600 text-sm">Volte nessa hora para ver as memórias!</p>
      </div>
    )
  }

  if (photos.length === 0) {
    return (
      <div className="min-h-screen bg-black flex flex-col items-center justify-center gap-4 p-6 text-center">
        <h1 className="text-white text-2xl font-bold">{eventName}</h1>
        <p className="text-zinc-400">Nenhuma foto ainda.</p>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-black p-4">
      <h1 className="text-white text-xl font-bold text-center mb-6">{eventName}</h1>
      <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 max-w-2xl mx-auto">
        {photos.map((photo) => (
          <div key={photo.id} className="aspect-square overflow-hidden rounded-lg bg-zinc-900">
            <img
              src={photo.url}
              alt={photo.tags.join(', ') || 'Foto do evento'}
              className="w-full h-full object-cover"
              loading="lazy"
            />
          </div>
        ))}
      </div>
    </div>
  )
}
