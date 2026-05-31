'use client'

import { useEffect, useState, useCallback, useRef } from 'react'
import { useParams, useRouter } from 'next/navigation'
import Link from 'next/link'
import { Settings, Download, Camera, QrCode } from 'lucide-react'
import { PhotoGrid } from '@/components/photo-grid'
import { DeletePhotoDialog } from '@/components/delete-photo-dialog'

interface Photo {
  id: string
  url: string
  tags: string[]
  tagging_status: string
  similarity?: number
  uploaded_at: string
}

interface EventInfo {
  id: string
  slug: string
  name: string
  event_date: string
  reveal_at: string | null
  closes_at: string | null
}

interface GalleryResponse {
  event: EventInfo
  cover_image_url: string | null
  unique_uploaders: number
  total: number
  photos: Photo[]
}

interface SearchResponse {
  photos: Photo[]
  q: string
}

const DEBOUNCE_MS = 300
const POLL_INTERVAL_MS = 5_000

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

export default function EventDetailPage() {
  const params = useParams()
  const router = useRouter()
  const slug = params?.slug as string

  const [event, setEvent] = useState<EventInfo | null>(null)
  const [photos, setPhotos] = useState<Photo[]>([])
  const [total, setTotal] = useState(0)
  const [coverImageUrl, setCoverImageUrl] = useState<string | null>(null)
  const [uniqueUploaders, setUniqueUploaders] = useState(0)
  const [query, setQuery] = useState('')
  const [isLoading, setIsLoading] = useState(true)
  const [isSearching, setIsSearching] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const [deletingId, setDeletingId] = useState<string | null>(null)
  const [showDeleteDialog, setShowDeleteDialog] = useState(false)
  const [isDeleting, setIsDeleting] = useState(false)

  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const abortRef = useRef<AbortController | null>(null)
  const pollingRef = useRef<ReturnType<typeof setInterval> | null>(null)

  const fetchGalleryData = useCallback(async (showLoading: boolean) => {
    if (showLoading) setIsLoading(true)
    setError(null)
    try {
      const res = await fetch(`/api/events/${slug}/gallery`)
      if (res.status === 401) { router.push('/login'); return }
      if (res.status === 403) { router.push('/dashboard'); return }
      if (!res.ok) throw new Error('Falha ao carregar galeria')
      const data: GalleryResponse = await res.json()
      setEvent(data.event)
      setPhotos(data.photos)
      setTotal(data.total)
      setCoverImageUrl(data.cover_image_url ?? null)
      setUniqueUploaders(data.unique_uploaders ?? 0)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erro desconhecido')
    } finally {
      if (showLoading) setIsLoading(false)
    }
  }, [slug, router])

  const fetchGallery = useCallback(() => fetchGalleryData(true), [fetchGalleryData])
  const fetchGallerySilent = useCallback(() => fetchGalleryData(false), [fetchGalleryData])

  const doSearch = useCallback(async (q: string) => {
    if (!q.trim()) {
      fetchGallery()
      return
    }
    if (abortRef.current) abortRef.current.abort()
    abortRef.current = new AbortController()
    setIsSearching(true)
    setError(null)
    try {
      const res = await fetch(
        `/api/events/${slug}/search?q=${encodeURIComponent(q)}`,
        { signal: abortRef.current.signal }
      )
      if (!res.ok) throw new Error('Busca falhou')
      const data: SearchResponse = await res.json()
      setPhotos(data.photos)
      setTotal(data.photos.length)
    } catch (err) {
      if (err instanceof Error && err.name === 'AbortError') return
      setError(err instanceof Error ? err.message : 'Erro na busca')
    } finally {
      setIsSearching(false)
    }
  }, [slug, fetchGallery])

  useEffect(() => {
    fetchGallery()
  }, [fetchGallery])

  const pendingCount = photos.filter(p => p.tagging_status === 'pending').length

  useEffect(() => {
    if (isLoading || pendingCount === 0) {
      if (pollingRef.current) { clearInterval(pollingRef.current); pollingRef.current = null }
      return
    }
    if (!pollingRef.current) {
      pollingRef.current = setInterval(fetchGallerySilent, POLL_INTERVAL_MS)
    }
    return () => {
      if (pollingRef.current) { clearInterval(pollingRef.current); pollingRef.current = null }
    }
  }, [isLoading, pendingCount, fetchGallerySilent])

  function handleQueryChange(e: React.ChangeEvent<HTMLInputElement>) {
    const val = e.target.value
    setQuery(val)
    if (debounceRef.current) clearTimeout(debounceRef.current)
    debounceRef.current = setTimeout(() => doSearch(val), DEBOUNCE_MS)
  }

  function handleDeleteClick(photoId: string) {
    setDeletingId(photoId)
    setShowDeleteDialog(true)
  }

  async function handleDeleteConfirm() {
    if (!deletingId || !event) return
    setIsDeleting(true)
    try {
      const res = await fetch(`/api/events/${event.slug}/photos/${deletingId}`, { method: 'DELETE' })
      if (res.ok) {
        setPhotos(prev => prev.filter(p => p.id !== deletingId))
        setTotal(prev => prev - 1)
      } else {
        setError('Não foi possível remover a foto. Tente novamente.')
      }
    } finally {
      setIsDeleting(false)
      setShowDeleteDialog(false)
      setDeletingId(null)
    }
  }

  const isClosed = event?.closes_at ? new Date(event.closes_at) <= new Date() : false
  const timeLeft = event ? getTimeLeft(event.closes_at, event.event_date) : ''

  return (
    <div>
      {/* Hero */}
      <div className="relative w-full aspect-[4/3] overflow-hidden bg-zinc-900">
        {coverImageUrl ? (
          <img
            src={coverImageUrl}
            alt={event?.name ?? 'Evento'}
            className="absolute inset-0 w-full h-full object-cover"
          />
        ) : (
          <div className="absolute inset-0 bg-gradient-to-br from-zinc-700 to-zinc-950" />
        )}
        <div className="absolute inset-0 bg-gradient-to-t from-black/90 via-black/30 to-black/20" />

        {/* Settings — top right */}
        <div className="absolute top-4 right-4">
          <Link
            href={`/events/${slug}/settings`}
            className="w-9 h-9 bg-black/40 backdrop-blur-sm rounded-xl flex items-center justify-center"
            aria-label="Configurações do evento"
          >
            <Settings size={16} className="text-white" />
          </Link>
        </div>

        {/* Event name — bottom */}
        <div className="absolute bottom-0 left-0 right-0 p-5">
          {isClosed && (
            <span className="text-[10px] font-bold tracking-widest text-white bg-red-500/80 rounded px-2 py-0.5 uppercase mb-2 inline-block">
              Encerrado
            </span>
          )}
          {isLoading && !event ? (
            <div className="h-9 w-48 bg-white/10 rounded-lg animate-pulse" />
          ) : (
            <h1 className="text-3xl font-bold text-white leading-tight">{event?.name}</h1>
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

      {/* Action buttons */}
      <div className="flex items-center gap-3 px-4 py-4">
        <Link
          href={`/e/${slug}`}
          className="flex-1 h-14 bg-white rounded-full flex items-center justify-center hover:bg-zinc-100 transition-colors"
          aria-label="Tirar fotos"
        >
          <Camera size={22} className="text-black" />
        </Link>
        <Link
          href={`/events/${slug}/share`}
          className="w-14 h-14 bg-zinc-800 rounded-2xl flex items-center justify-center hover:bg-zinc-700 transition-colors"
          aria-label="QR Code"
        >
          <QrCode size={20} className="text-white" />
        </Link>
        <a
          href={`/api/events/${slug}/download-zip`}
          download
          className="w-14 h-14 bg-zinc-800 rounded-2xl flex items-center justify-center hover:bg-zinc-700 transition-colors"
          aria-label="Baixar todas as fotos"
        >
          <Download size={20} className="text-white" />
        </a>
      </div>

      {/* Search bar */}
      <div className="px-4 mb-4 relative">
        <input
          type="search"
          value={query}
          onChange={handleQueryChange}
          placeholder="Buscar fotos por conteúdo..."
          className="w-full bg-zinc-900 border border-zinc-700 rounded-lg px-4 py-3 text-white placeholder-zinc-500 focus:outline-none focus:border-zinc-500 transition-colors"
        />
        {isSearching && (
          <span className="absolute right-7 top-1/2 -translate-y-1/2 text-zinc-400 text-sm animate-pulse">
            Buscando...
          </span>
        )}
      </div>

      {/* Pending notice */}
      {pendingCount > 0 && (
        <div className="mx-4 mb-4 px-4 py-3 bg-zinc-800 border border-zinc-700 rounded-lg text-zinc-400 text-sm">
          {pendingCount} foto{pendingCount !== 1 ? 's' : ''} ainda sendo processada{pendingCount !== 1 ? 's' : ''}...
        </div>
      )}

      {/* Error */}
      {error && (
        <div className="mx-4 mb-4 px-4 py-3 bg-red-900/30 border border-red-800 rounded-lg text-red-400 text-sm">
          {error}
        </div>
      )}

      {/* Photo grid */}
      <div className="px-4">
        <PhotoGrid
          photos={photos}
          isLoading={isLoading}
          onDelete={handleDeleteClick}
          emptyMessage={
            query
              ? `Nenhuma foto encontrada para "${query}".`
              : 'Nenhuma foto ainda. Compartilhe o link do evento com seus convidados!'
          }
        />
      </div>

      <DeletePhotoDialog
        open={showDeleteDialog}
        onClose={() => { setShowDeleteDialog(false); setDeletingId(null) }}
        onConfirm={handleDeleteConfirm}
        isDeleting={isDeleting}
      />
    </div>
  )
}
