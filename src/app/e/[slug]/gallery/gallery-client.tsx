'use client'

import { useEffect, useState, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { ChevronLeft, Camera } from 'lucide-react'
import { PhotoGrid } from '@/components/photo-grid'

interface Photo {
  id: string
  url: string
  tags: string[]
  tagging_status: string
  uploaded_at: string
}

interface GalleryResponse {
  cover_image_url: string | null
  unique_uploaders: number
  total: number
  photos: Photo[]
}

interface Props {
  mode: 'countdown' | 'gallery'
  slug: string
  eventName: string
  revealAt: string | null
  eventDate: string
  closesAt: string | null
  isAuthenticated: boolean
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

function getTimeLeft(closesAt: string | null, eventDate: string): string {
  const deadline = closesAt
    ? new Date(closesAt)
    : new Date(eventDate + 'T23:59:59')
  const diff = deadline.getTime() - Date.now()
  if (diff <= 0) return ''
  const days = Math.floor(diff / 86400000)
  const hours = Math.floor((diff % 86400000) / 3600000)
  const mins = Math.floor((diff % 3600000) / 60000)
  if (days > 0) return `${days}d ${hours}h`
  if (hours > 0) return `${hours}h ${mins}m`
  return `${mins}m`
}

export default function GuestGalleryClient({
  mode,
  slug,
  eventName,
  revealAt,
  eventDate,
  closesAt,
  isAuthenticated,
}: Props) {
  const router = useRouter()
  const [countdown, setCountdown] = useState<string | null>(null)
  const [photos, setPhotos] = useState<Photo[]>([])
  const [total, setTotal] = useState(0)
  const [uniqueUploaders, setUniqueUploaders] = useState(0)
  const [coverImageUrl, setCoverImageUrl] = useState<string | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [query, setQuery] = useState('')

  useEffect(() => {
    if (mode !== 'countdown' || !revealAt) return
    const target = new Date(revealAt)
    function tick() {
      if (target <= new Date()) { router.refresh(); return }
      setCountdown(formatCountdown(target))
    }
    tick()
    const id = setInterval(tick, 1000)
    return () => clearInterval(id)
  }, [mode, revealAt, router])

  const fetchGallery = useCallback(async () => {
    if (mode !== 'gallery') return
    setIsLoading(true)
    try {
      const res = await fetch(`/api/events/${slug}/gallery`)
      if (res.ok) {
        const data: GalleryResponse = await res.json()
        setPhotos(data.photos)
        setTotal(data.total)
        setUniqueUploaders(data.unique_uploaders ?? 0)
        setCoverImageUrl(data.cover_image_url ?? null)
      }
    } finally {
      setIsLoading(false)
    }
  }, [mode, slug])

  useEffect(() => {
    fetchGallery()
  }, [fetchGallery])

  const filtered = query.trim()
    ? photos.filter(p =>
        p.tags.some(t => t.toLowerCase().includes(query.toLowerCase()))
      )
    : photos

  const isClosed = closesAt ? new Date(closesAt) <= new Date() : false
  const timeLeft = getTimeLeft(closesAt, eventDate)

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

  return (
    <div>
      {/* Hero */}
      <div className="relative w-full aspect-[4/3] overflow-hidden bg-zinc-900">
        {coverImageUrl ? (
          <img
            src={coverImageUrl}
            alt={eventName}
            className="absolute inset-0 w-full h-full object-cover"
          />
        ) : (
          <div className="absolute inset-0 bg-gradient-to-br from-zinc-700 to-zinc-950" />
        )}
        <div className="absolute inset-0 bg-gradient-to-t from-black/90 via-black/30 to-black/20" />

        {isAuthenticated && (
          <div className="absolute top-4 left-4">
            <button
              onClick={() => router.push('/dashboard')}
              className="w-9 h-9 bg-black/40 backdrop-blur-sm rounded-xl flex items-center justify-center"
              aria-label="Voltar ao dashboard"
            >
              <ChevronLeft size={18} className="text-white" />
            </button>
          </div>
        )}

        <div className="absolute bottom-0 left-0 right-0 p-5">
          {isClosed && (
            <span className="text-[10px] font-bold tracking-widest text-white bg-red-500/80 rounded px-2 py-0.5 uppercase mb-2 inline-block">
              Encerrado
            </span>
          )}
          {isLoading ? (
            <div className="h-9 w-48 bg-white/10 rounded-lg animate-pulse" />
          ) : (
            <h1 className="text-3xl font-bold text-white leading-tight">{eventName}</h1>
          )}
        </div>
      </div>

      {/* Stats row */}
      <div className="flex items-center justify-around py-5 px-4 border-b border-zinc-800">
        <div className="text-center">
          <p className="text-2xl font-bold text-white">{total}</p>
          <p className="text-[10px] text-zinc-500 uppercase tracking-widest mt-0.5">Moments</p>
        </div>
        <div className="w-px h-8 bg-zinc-800" />
        <div className="text-center">
          <p className="text-2xl font-bold text-white">{timeLeft || '—'}</p>
          <p className="text-[10px] text-zinc-500 uppercase tracking-widest mt-0.5">
            {isClosed ? 'Encerrado' : 'Restante'}
          </p>
        </div>
        <div className="w-px h-8 bg-zinc-800" />
        <div className="text-center">
          <p className="text-2xl font-bold text-white">{uniqueUploaders}</p>
          <p className="text-[10px] text-zinc-500 uppercase tracking-widest mt-0.5">Pessoas</p>
        </div>
      </div>

      {/* Camera button */}
      <div className="flex items-center px-4 py-4">
        <Link
          href={`/e/${slug}`}
          className="flex-1 h-14 bg-white rounded-full flex items-center justify-center hover:bg-zinc-100 transition-colors"
          aria-label="Tirar fotos"
        >
          <Camera size={22} className="text-black" />
        </Link>
      </div>

      {/* Search bar */}
      <div className="px-4 mb-4">
        <input
          type="search"
          value={query}
          onChange={e => setQuery(e.target.value)}
          placeholder="Buscar fotos por conteúdo..."
          className="w-full bg-zinc-900 border border-zinc-700 rounded-lg px-4 py-3 text-white placeholder-zinc-500 focus:outline-none focus:border-zinc-500 transition-colors"
        />
      </div>

      {/* Photo grid */}
      <div className="px-4 pb-4">
        <PhotoGrid
          photos={filtered}
          isLoading={isLoading}
          emptyMessage={
            query
              ? `Nenhuma foto encontrada para "${query}".`
              : 'Nenhuma foto ainda.'
          }
        />
      </div>
    </div>
  )
}
