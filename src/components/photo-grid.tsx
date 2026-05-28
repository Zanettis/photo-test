'use client'

import { Trash2 } from 'lucide-react'

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
    <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3">
      {photos.map((photo) => (
        <div key={photo.id} className="group relative aspect-square">
          {photo.tagging_status === 'pending' ? (
            <div className="w-full h-full bg-zinc-800 rounded-lg flex items-center justify-center">
              <span className="text-zinc-500 text-xs text-center px-2">Processando...</span>
            </div>
          ) : (
            <a href={photo.url} target="_blank" rel="noopener noreferrer" className="block w-full h-full">
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
            </a>
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
  )
}
