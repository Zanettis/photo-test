'use client'
import { useEffect, useState } from 'react'
import QRCode from 'qrcode'

interface EventCardProps {
  id: string
  name: string
  slug: string
  event_date: string
  photo_count: number
  reveal_at: string | null
  shot_cap: number | null
}

export function EventCard({ name, slug, event_date, photo_count, reveal_at, shot_cap }: EventCardProps) {
  const [qrDataUrl, setQrDataUrl] = useState('')
  const [copied, setCopied] = useState(false)
  const link = `${process.env.NEXT_PUBLIC_APP_URL}/e/${slug}`

  useEffect(() => {
    QRCode.toDataURL(link, { width: 160, margin: 1 }).then(setQrDataUrl)
  }, [link])

  function copyLink() {
    navigator.clipboard.writeText(link)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  const dateFormatted = new Date(event_date + 'T12:00:00').toLocaleDateString('pt-BR', { day: '2-digit', month: 'long', year: 'numeric' })

  return (
    <div className="border border-zinc-800 rounded-xl p-5 bg-zinc-900 flex gap-5">
      <div className="shrink-0">
        {qrDataUrl ? <img src={qrDataUrl} alt="QR Code" className="w-24 h-24 rounded" /> : <div className="w-24 h-24 bg-zinc-800 rounded animate-pulse" />}
      </div>
      <div className="flex-1 min-w-0">
        <h3 className="text-white font-semibold truncate">{name}</h3>
        <p className="text-zinc-400 text-sm mt-0.5">{dateFormatted}</p>
        <div className="flex gap-2 mt-2 flex-wrap">
          <span className="text-xs bg-zinc-800 text-zinc-300 px-2 py-0.5 rounded">{photo_count} fotos</span>
          {shot_cap && <span className="text-xs bg-zinc-800 text-zinc-300 px-2 py-0.5 rounded">limite: {shot_cap}/pessoa</span>}
          {reveal_at && <span className="text-xs bg-zinc-800 text-zinc-300 px-2 py-0.5 rounded">revelação agendada</span>}
        </div>
        <button onClick={copyLink} className="mt-3 text-xs text-zinc-500 hover:text-white transition-colors truncate max-w-full text-left">
          {copied ? '✓ Copiado!' : link}
        </button>
      </div>
    </div>
  )
}
