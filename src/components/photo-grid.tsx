'use client'

import { useState } from 'react'
import { Trash2, Download, X } from 'lucide-react'
import { Dialog } from '@base-ui/react/dialog'

interface Photo {
  id: string
  url: string
  tags: string[]
  tagging_status: string
  similarity?: number
  uploaded_at: string
}

interface PhotoGridProps {
  photos: Photo[]
  isLoading?: boolean
  emptyMessage?: string
  onDelete?: (photoId: string) => void
}

export function PhotoGrid({ photos, isLoading = false, emptyMessage = 'Nenhuma foto encontrada.', onDelete }: PhotoGridProps) {
  const [lightboxPhoto, setLightboxPhoto] = useState<Photo | null>(null)
  const [downloadingId, setDownloadingId] = useState<string | null>(null)

  async function handleDownload(photo: Photo, e: React.MouseEvent) {
    e.preventDefault()
    e.stopPropagation()
    if (downloadingId === photo.id) return
    setDownloadingId(photo.id)
    try {
      const res = await fetch(photo.url)
      if (!res.ok) throw new Error('Download failed')
      const blob = await res.blob()
      const blobUrl = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = blobUrl
      a.download = `foto-${photo.id.slice(0, 8)}.${blob.type === 'image/png' ? 'png' : 'jpg'}`
      document.body.appendChild(a)
      a.click()
      a.remove()
      URL.revokeObjectURL(blobUrl)
    } catch {
      // silencia — o arquivo ainda pode ser acessado pelo lightbox
    } finally {
      setDownloadingId(null)
    }
  }

  if (isLoading) {
    return (
      <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3">
        {Array.from({ length: 8 }).map((_, i) => (
          <div key={i} className="aspect-square bg-zinc-800 rounded-lg animate-pulse" />
        ))}
      </div>
    )
  }

  if (photos.length === 0) {
    return (
      <div className="text-center py-16 text-zinc-500">
        <p>{emptyMessage}</p>
      </div>
    )
  }

  return (
    <>
      <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3">
        {photos.map((photo) => (
          <div key={photo.id} className="group relative aspect-square">
            {photo.tagging_status === 'pending' ? (
              <div className="w-full h-full bg-zinc-800 rounded-lg flex items-center justify-center">
                <span className="text-zinc-500 text-xs text-center px-2">Processando...</span>
              </div>
            ) : (
              <button
                type="button"
                onClick={() => setLightboxPhoto(photo)}
                className="block w-full h-full cursor-zoom-in"
                aria-label={`Ver foto${photo.tags.length ? `: ${photo.tags.slice(0, 2).join(', ')}` : ''}`}
              >
                <img
                  src={photo.url}
                  alt={photo.tags.join(', ') || 'Foto do evento'}
                  className="w-full h-full object-cover rounded-lg transition-opacity group-hover:opacity-80"
                  loading="lazy"
                />
                {photo.tags.length > 0 && (
                  <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/70 to-transparent rounded-b-lg p-2 opacity-0 group-hover:opacity-100 transition-opacity">
                    <p className="text-white text-xs truncate">{photo.tags.slice(0, 3).join(', ')}</p>
                  </div>
                )}
              </button>
            )}
            {photo.tagging_status !== 'pending' && (
              <button
                type="button"
                aria-label="Baixar foto"
                onClick={(e) => handleDownload(photo, e)}
                disabled={downloadingId === photo.id}
                className="absolute top-1 right-8 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center w-6 h-6 rounded-full bg-black/70 hover:bg-zinc-600 text-white disabled:opacity-50"
              >
                {downloadingId === photo.id
                  ? <span className="inline-block w-3 h-3 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                  : <Download size={14} />}
              </button>
            )}
            {onDelete && photo.tagging_status !== 'pending' && (
              <button
                type="button"
                aria-label="Remover foto"
                onClick={(e) => { e.preventDefault(); e.stopPropagation(); onDelete(photo.id) }}
                className="absolute top-1 right-1 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center w-6 h-6 rounded-full bg-black/70 hover:bg-red-600 text-white"
              >
                <Trash2 size={14} />
              </button>
            )}
          </div>
        ))}
      </div>

      {lightboxPhoto && (
        <Dialog.Root open onOpenChange={(open) => { if (!open) setLightboxPhoto(null) }}>
          <Dialog.Portal>
            <Dialog.Backdrop className="fixed inset-0 bg-black/90 z-50" />
            <Dialog.Popup className="fixed inset-0 z-50 flex items-center justify-center p-4">
              <div className="relative max-w-5xl w-full flex flex-col items-center">
                <div className="absolute top-0 right-0 -translate-y-10 flex gap-2">
                  <button
                    type="button"
                    aria-label="Baixar foto"
                    onClick={(e) => handleDownload(lightboxPhoto, e)}
                    disabled={downloadingId === lightboxPhoto.id}
                    className="flex items-center justify-center w-8 h-8 rounded-full bg-white/10 hover:bg-white/20 text-white transition-colors disabled:opacity-50"
                  >
                    {downloadingId === lightboxPhoto.id
                      ? <span className="inline-block w-3 h-3 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                      : <Download size={16} />}
                  </button>
                  <button
                    type="button"
                    onClick={() => setLightboxPhoto(null)}
                    aria-label="Fechar"
                    className="flex items-center justify-center w-8 h-8 rounded-full bg-white/10 hover:bg-white/20 text-white transition-colors"
                  >
                    <X size={16} />
                  </button>
                </div>
                <img
                  src={lightboxPhoto.url}
                  alt={lightboxPhoto.tags.join(', ') || 'Foto do evento'}
                  className="max-w-full max-h-[80vh] object-contain rounded-lg"
                />
                {lightboxPhoto.tags.length > 0 && (
                  <div className="mt-3 flex flex-wrap gap-1.5 justify-center">
                    {lightboxPhoto.tags.map((tag) => (
                      <span key={tag} className="text-xs bg-zinc-800 text-zinc-300 px-2 py-0.5 rounded-full">
                        {tag}
                      </span>
                    ))}
                  </div>
                )}
              </div>
            </Dialog.Popup>
          </Dialog.Portal>
        </Dialog.Root>
      )}
    </>
  )
}
