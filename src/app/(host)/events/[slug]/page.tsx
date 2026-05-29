'use client'

import { useEffect, useState, useCallback, useRef } from 'react'
import { useParams, useRouter } from 'next/navigation'
import Link from 'next/link'
import { Settings, Download } from 'lucide-react'
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
  total: number
  photos: Photo[]
}

interface SearchResponse {
  photos: Photo[]
  q: string
}

const DEBOUNCE_MS = 300

export default function EventDetailPage() {
  const params = useParams()
  const router = useRouter()
  const slug = params?.slug as string

  const [event, setEvent] = useState<EventInfo | null>(null)
  const [photos, setPhotos] = useState<Photo[]>([])
  const [total, setTotal] = useState(0)
  const [query, setQuery] = useState('')
  const [isLoading, setIsLoading] = useState(true)
  const [isSearching, setIsSearching] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const [deletingId, setDeletingId] = useState<string | null>(null)
  const [showDeleteDialog, setShowDeleteDialog] = useState(false)
  const [isDeleting, setIsDeleting] = useState(false)

  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const abortRef = useRef<AbortController | null>(null)

  const fetchGallery = useCallback(async () => {
    setIsLoading(true)
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
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erro desconhecido')
    } finally {
      setIsLoading(false)
    }
  }, [slug, router])

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

  const pendingCount = photos.filter(p => p.tagging_status === 'pending').length
  const dateFormatted = event
    ? new Date(event.event_date + 'T12:00:00').toLocaleDateString('pt-BR', { day: '2-digit', month: 'long', year: 'numeric' })
    : ''
  const isClosed = event?.closes_at ? new Date(event.closes_at) <= new Date() : false

  return (
    <div>
      {/* Header */}
      <div className="flex items-start justify-between gap-3 mb-6">
        <div className="flex items-center gap-3">
          <Link href="/dashboard" className="text-zinc-400 hover:text-white text-sm transition-colors">
            ← Dashboard
          </Link>
          {event && (
            <>
              <span className="text-zinc-600">/</span>
              <div>
                <div className="flex items-center gap-2">
                  <h1 className="text-xl font-bold text-white">{event.name}</h1>
                  {isClosed && (
                    <span className="text-xs bg-red-900/50 text-red-400 px-2 py-0.5 rounded">Encerrado</span>
                  )}
                </div>
                <p className="text-zinc-400 text-sm">{dateFormatted} · {total} foto{total !== 1 ? 's' : ''}</p>
              </div>
            </>
          )}
        </div>
        {event && (
          <div className="flex items-center gap-3 shrink-0 mt-0.5">
            <a
              href={`/api/events/${slug}/download-zip`}
              download
              className="flex items-center gap-1.5 border border-zinc-700 text-zinc-400 hover:text-white hover:border-zinc-500 text-sm transition-colors rounded-md px-3 py-1.5"
              title="Baixar todas as fotos"
            >
              <Download size={16} />
              <span className="hidden sm:inline">Baixar ZIP</span>
            </a>
            <Link
              href={`/events/${slug}/settings`}
              className="flex items-center gap-1.5 text-zinc-400 hover:text-white text-sm transition-colors"
              title="Configurações do evento"
            >
              <Settings size={16} />
              <span className="hidden sm:inline">Configurações</span>
            </Link>
          </div>
        )}
      </div>

      {/* Search bar */}
      <div className="mb-6 relative">
        <input
          type="search"
          value={query}
          onChange={handleQueryChange}
          placeholder="Buscar fotos por conteúdo... (ex: vela, brinde, noiva)"
          className="w-full bg-zinc-900 border border-zinc-700 rounded-lg px-4 py-3 text-white placeholder-zinc-500 focus:outline-none focus:border-zinc-500 transition-colors"
        />
        {isSearching && (
          <span className="absolute right-3 top-1/2 -translate-y-1/2 text-zinc-400 text-sm animate-pulse">
            Buscando...
          </span>
        )}
      </div>

      {/* Pending notice */}
      {pendingCount > 0 && (
        <div className="mb-4 px-4 py-3 bg-zinc-800 border border-zinc-700 rounded-lg text-zinc-400 text-sm">
          {pendingCount} foto{pendingCount !== 1 ? 's' : ''} ainda sendo processada{pendingCount !== 1 ? 's' : ''}...
        </div>
      )}

      {/* Error */}
      {error && (
        <div className="mb-4 px-4 py-3 bg-red-900/30 border border-red-800 rounded-lg text-red-400 text-sm">
          {error}
        </div>
      )}

      {/* Grid */}
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

      <DeletePhotoDialog
        open={showDeleteDialog}
        onClose={() => { setShowDeleteDialog(false); setDeletingId(null) }}
        onConfirm={handleDeleteConfirm}
        isDeleting={isDeleting}
      />
    </div>
  )
}
