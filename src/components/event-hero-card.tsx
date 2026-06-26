'use client'

import Link from 'next/link'
import { Camera, Clock } from 'lucide-react'

interface Props {
  slug: string
  name: string
  eventDate: string
  closesAt: string | null
  coverImageUrl: string | null
  timeRemaining: string
  primaryHref?: string
  role?: 'host' | 'guest'
}

export function EventHeroCard({ slug, name, coverImageUrl, timeRemaining, primaryHref, role }: Props) {
  return (
    <div className="relative w-[82vw] max-w-[320px] flex-shrink-0 snap-start aspect-[4/5] rounded-3xl overflow-hidden bg-zinc-900">
      {coverImageUrl ? (
        <img
          src={coverImageUrl}
          alt={name}
          className="absolute inset-0 w-full h-full object-cover"
        />
      ) : (
        <div className="absolute inset-0 bg-gradient-to-br from-zinc-700 to-zinc-950" />
      )}

      {/* gradient overlay */}
      <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/20 to-transparent" />

      {/* top badge */}
      {role && (
        <div className="absolute top-4 left-4">
          {role === 'guest' ? (
            <span className="text-[10px] font-bold tracking-widest text-teal-400 bg-teal-400/15 rounded px-2 py-0.5 uppercase">
              Joined
            </span>
          ) : (
            <span className="text-[10px] font-bold tracking-widest text-zinc-300 bg-zinc-800/80 rounded px-2 py-0.5 uppercase">
              Host
            </span>
          )}
        </div>
      )}

      {/* tap area — links to host gallery or override */}
      <Link href={primaryHref ?? `/events/${slug}`} className="absolute inset-0" aria-label={name} />

      {/* bottom info */}
      <div className="absolute bottom-16 left-4 right-4">
        <p className="text-white font-bold text-2xl leading-tight drop-shadow-sm">{name}</p>
        {timeRemaining && (
          <div className="flex items-center gap-1.5 mt-1">
            <Clock size={12} className="text-zinc-300" />
            <span className="text-zinc-300 text-xs">{timeRemaining}</span>
          </div>
        )}
      </div>

      {/* camera button — links to guest view */}
      <div className="absolute bottom-4 left-1/2 -translate-x-1/2">
        <Link
          href={`/e/${slug}`}
          onClick={e => e.stopPropagation()}
          className="w-12 h-12 rounded-2xl bg-black/70 backdrop-blur-sm border border-white/10 flex items-center justify-center hover:bg-black/90 transition-colors"
          aria-label="Adicionar fotos"
        >
          <Camera size={20} className="text-white" />
        </Link>
      </div>
    </div>
  )
}
