import Link from 'next/link'

interface Props {
  slug: string
  name: string
  eventDate: string
  thumbnailUrls: string[]
  coverImageUrl: string | null
}

function formatDate(iso: string): string {
  try {
    return new Date(iso + 'T12:00:00').toLocaleDateString('pt-BR', {
      day: 'numeric', month: 'short', year: 'numeric',
    })
  } catch { return '' }
}

export function EventAlbumRow({ slug, name, eventDate, thumbnailUrls, coverImageUrl }: Props) {
  const previews = thumbnailUrls.length > 0
    ? thumbnailUrls
    : coverImageUrl
      ? [coverImageUrl]
      : []

  return (
    <Link href={`/events/${slug}`} className="block group">
      <div className="flex items-baseline justify-between mb-2">
        <h2 className="text-white font-bold text-xl leading-tight group-hover:opacity-80 transition-opacity">
          {name}
        </h2>
        <span className="text-zinc-500 text-sm shrink-0 ml-3">{formatDate(eventDate)}</span>
      </div>

      {previews.length > 0 ? (
        <div className="flex gap-2">
          {previews.slice(0, 3).map((url, i) => (
            <div
              key={i}
              className="w-28 h-28 rounded-2xl overflow-hidden bg-zinc-800 shrink-0"
              style={{ marginLeft: i > 0 ? -12 : 0 }}
            >
              <img
                src={url}
                alt=""
                className="w-full h-full object-cover"
                onError={e => { (e.target as HTMLImageElement).style.display = 'none' }}
              />
            </div>
          ))}
        </div>
      ) : (
        <div className="w-28 h-28 rounded-2xl bg-zinc-800" />
      )}
    </Link>
  )
}
