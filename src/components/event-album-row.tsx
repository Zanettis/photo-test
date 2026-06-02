'use client'

import Link from 'next/link'
import { formatDateMedium } from '@/lib/date-utils'

interface Props {
  slug: string
  name: string
  eventDate: string
  photoCount: number
  coverImageUrl: string | null
}

export function EventAlbumRow({ slug, name, eventDate, photoCount, coverImageUrl }: Props) {
  return (
    <Link href={`/events/${slug}`} className="block group">
      <div className="flex items-baseline justify-between mb-3">
        <h2 className="text-white font-bold text-xl leading-tight group-hover:opacity-80 transition-opacity">
          {name}
        </h2>
        <span className="text-zinc-500 text-sm shrink-0 ml-3">{formatDateMedium(eventDate)}</span>
      </div>

      <div className="relative w-full aspect-[4/3] rounded-2xl overflow-hidden bg-zinc-800">
        {coverImageUrl ? (
          <img
            src={coverImageUrl}
            alt={name}
            className="w-full h-full object-cover"
            onError={e => { (e.target as HTMLImageElement).style.display = 'none' }}
          />
        ) : (
          <div className="absolute inset-0 bg-gradient-to-br from-zinc-700 to-zinc-900" />
        )}
        {photoCount > 0 && (
          <div className="absolute bottom-3 left-3">
            <span className="text-xs text-white bg-black/50 backdrop-blur-sm rounded-full px-2.5 py-1">
              {photoCount} {photoCount === 1 ? 'foto' : 'fotos'}
            </span>
          </div>
        )}
      </div>
    </Link>
  )
}
