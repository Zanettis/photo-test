'use client'

import Link from 'next/link'
import { formatDateMedium } from '@/lib/date-utils'

interface Props {
  slug: string
  name: string
  eventDate: string
  photos: { url: string }[]
  photoCount: number
}

export function EventAlbumRow({ slug, name, eventDate, photos, photoCount }: Props) {
  const showOverflow = photoCount > 4
  const overflowCount = showOverflow ? photoCount - 4 : 0

  return (
    <Link href={`/events/${slug}`} className="block group py-5 border-t border-zinc-800/60">
      <div className="flex items-baseline justify-between mb-3">
        <h2 className="text-white font-bold text-xl leading-tight group-hover:opacity-80 transition-opacity">
          {name}
        </h2>
        <span className="text-zinc-500 text-sm shrink-0 ml-3">{formatDateMedium(eventDate)}</span>
      </div>

      {photoCount === 0 ? (
        <p className="text-sm text-zinc-500">No photos yet</p>
      ) : (
        <div className="flex gap-1">
          {photos.map((photo, i) => {
            const isLast = i === 3 && showOverflow
            return (
              <div
                key={i}
                className="relative flex-1 aspect-square rounded-xl overflow-hidden bg-zinc-800 min-w-0"
              >
                <img
                  src={photo.url}
                  alt=""
                  className="w-full h-full object-cover"
                  onError={e => { (e.target as HTMLImageElement).style.display = 'none' }}
                />
                {isLast && (
                  <div className="absolute inset-0 bg-black/60 flex items-center justify-center">
                    <span className="text-white text-sm font-bold">+{overflowCount}</span>
                  </div>
                )}
              </div>
            )
          })}
        </div>
      )}
    </Link>
  )
}
