interface Props {
  eventName: string
  eventDate: string
  shotCap: number | null
  coverPreview: string | null
}

function formatDateShort(iso: string): string {
  try {
    return new Date(iso + 'T12:00:00').toLocaleDateString('pt-BR', {
      day: 'numeric', month: 'short',
    })
  } catch { return '' }
}

export function PhoneMockup({ eventName, eventDate, shotCap, coverPreview }: Props) {
  const dateStr = eventDate ? formatDateShort(eventDate) : ''
  const shotStr = shotCap ? `${shotCap} fotos por pessoa` : 'Fotos ilimitadas'

  return (
    <div className="mx-auto" style={{ width: 220, height: 390 }}>
      <div className="relative w-full h-full rounded-[2rem] border-[3px] border-zinc-700 bg-zinc-900 overflow-hidden shadow-2xl">
        {/* Notch */}
        <div className="absolute top-2 left-1/2 -translate-x-1/2 w-10 h-1 bg-zinc-700 rounded-full z-10" />

        {/* Cover image or placeholder */}
        {coverPreview ? (
          <img
            src={coverPreview}
            className="absolute inset-0 w-full h-full object-cover"
            alt=""
          />
        ) : (
          <div className="absolute inset-0 bg-gradient-to-br from-zinc-700 to-zinc-950" />
        )}

        {/* Bottom gradient overlay */}
        <div className="absolute inset-x-0 bottom-0 h-3/5 bg-gradient-to-t from-black/95 via-black/60 to-transparent" />

        {/* Top: invited chip */}
        <div className="absolute top-5 left-0 right-0 flex justify-center">
          <span className="text-[8px] text-zinc-300 bg-black/50 rounded-full px-2 py-0.5">
            Convidado por você
          </span>
        </div>

        {/* Bottom: event info */}
        <div className="absolute inset-x-3 bottom-3 flex flex-col gap-1">
          <p className="text-white text-[11px] font-bold leading-tight truncate">
            {eventName || 'Nome do evento'}
          </p>
          <p className="text-zinc-400 text-[8px]">
            {dateStr}{dateStr && ' · '}{shotStr}
          </p>
          <div className="mt-1 w-full py-1.5 rounded-lg bg-white/15 border border-white/10 text-center">
            <span className="text-white text-[8px] font-medium">Tirar foto →</span>
          </div>
        </div>
      </div>
    </div>
  )
}
